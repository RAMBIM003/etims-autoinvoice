const crypto = require('crypto');
const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const mpesa = require('../services/mpesaService');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

const enabled = () =>
    ['local', 'daraja'].includes(
        String(process.env.PAYMENT_SIMULATION || 'off').toLowerCase()
    );

const requireEnabled = (q, s, next) => {
    if (!enabled()) {
        return s.status(403).json({ error: 'The M-Pesa simulator is disabled' });
    }

    next();
};

// Africa/Nairobi is UTC+3 with no daylight saving.
const eatTimestamp = () =>
    new Date(Date.now() + 3 * 60 * 60 * 1000)
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);

// M-Pesa codes look like RKL51ZDR4F: 10 uppercase letters and digits.
const makeTransId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let id = 'S';

    for (let i = 0; i < 9; i += 1) {
        id += chars[crypto.randomInt(chars.length)];
    }

    return id;
};

async function scopeFor(userId) {
    const merchant = (
        await db.query(
            `SELECT merchant_id
             FROM merchant_users
             WHERE user_id = $1 AND status = 'ACTIVE'
             LIMIT 1`,
            [userId]
        )
    ).rows[0];

    if (merchant) {
        return { merchantId: merchant.merchant_id };
    }

    const buyer = (
        await db.query(`SELECT id FROM buyers WHERE user_id = $1`, [userId])
    ).rows[0];

    if (buyer) {
        return { buyerId: buyer.id };
    }

    throw fail('No merchant or buyer account found', 404);
}

// Open orders the signed-in user could pay, plus shortcodes to choose from.
r.get('/context', auth, requireEnabled, wrap(async (q, s) => {
    const scope = await scopeFor(q.user.sub);
    const owner = scope.merchantId || scope.buyerId;
    const where = scope.merchantId ? 's.merchant_id = $1' : 's.buyer_id = $1';

    const orders = (
        await db.query(
            `SELECT s.order_reference,
                    s.total_amount,
                    s.currency,
                    m.trading_name,
                    (SELECT mc.business_shortcode
                     FROM mpesa_connections mc
                     WHERE mc.merchant_id = s.merchant_id
                       AND mc.status IN ('ACTIVE', 'PENDING')
                     ORDER BY mc.status
                     LIMIT 1) AS shortcode
             FROM sales s
             JOIN merchants m ON m.id = s.merchant_id
             WHERE ${where}
               AND s.status = 'AWAITING_PAYMENT'
             ORDER BY s.created_at DESC
             LIMIT 25`,
            [owner]
        )
    ).rows;

    let shortcodes;

    if (scope.merchantId) {
        shortcodes = (
            await db.query(
                `SELECT DISTINCT business_shortcode
                 FROM mpesa_connections
                 WHERE merchant_id = $1`,
                [scope.merchantId]
            )
        ).rows.map(row => row.business_shortcode);
    } else {
        shortcodes = [...new Set(orders.map(o => o.shortcode).filter(Boolean))];
    }

    s.json({
        mode: String(process.env.PAYMENT_SIMULATION || 'off').toLowerCase(),
        shortcodes,
        orders
    });
}));

// Sends a payment. "local" posts a Daraja-shaped confirmation to our own
// endpoint; "daraja" asks the Safaricom sandbox to send the real callback.
r.post('/c2b', auth, requireEnabled, wrap(async (q, s) => {
    await scopeFor(q.user.sub);

    const b = q.body || {};
    const shortcode = String(b.shortcode || '').trim();
    const reference = String(b.reference || '').trim();
    const amount = Number(b.amount);
    const mode = b.mode === 'daraja' ? 'daraja' : 'local';

    if (!/^\d{5,7}$/.test(shortcode)) {
        throw fail('Shortcode must be 5 to 7 digits', 400);
    }

    if (!Number.isInteger(amount) || amount < 1) {
        throw fail('M-Pesa C2B amounts are whole shillings (minimum 1)', 400);
    }

    if (reference.length > 20) {
        throw fail('Account reference is at most 20 characters', 400);
    }

    if (mode === 'daraja') {
        const result = await mpesa.simulateC2B({
            shortcode,
            amount,
            billRef: reference
        });

        return s.json({
            mode: 'DARAJA',
            ok: !!result.ok,
            error: result.error || null,
            daraja_response: result.response || null,
            reference
        });
    }

    const transId = makeTransId();

    const payload = {
        TransactionType: 'Pay Bill',
        TransID: transId,
        TransTime: eatTimestamp(),
        TransAmount: `${amount}.00`,
        BusinessShortCode: shortcode,
        BillRefNumber: reference,
        InvoiceNumber: '',
        OrgAccountBalance: '0.00',
        ThirdPartyTransID: '',
        MSISDN: String(b.phone || '2547 ***** 126').slice(0, 100),
        FirstName: String(b.firstName || 'JOHN').slice(0, 30),
        MiddleName: '',
        LastName: String(b.lastName || '').slice(0, 30)
    };

    const response = await fetch(
        `http://127.0.0.1:${process.env.PORT || 5000}${require('../services/mpesaService').callbackPath('confirmation')}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }
    );

    const body = await response.json().catch(() => ({}));

    s.json({
        mode: 'LOCAL',
        ok: response.ok && body.ResultCode === 0,
        trans_id: transId,
        daraja_response: body,
        sent: payload,
        reference
    });
}));

// What happened to a payment: matching, order, invoice and KRA receipt.
r.get('/result', auth, requireEnabled, wrap(async (q, s) => {
    const scope = await scopeFor(q.user.sub);
    const transId = q.query.transId ? String(q.query.transId) : null;
    const reference = q.query.reference ? String(q.query.reference) : null;

    if (!transId && !reference) {
        throw fail('transId or reference is required', 400);
    }

    const filter = scope.merchantId
        ? 'mt.merchant_id = $3'
        : 's.buyer_id = $3';

    const row = (
        await db.query(
            `SELECT mt.trans_id,
                    mt.bill_ref_number,
                    mt.amount,
                    mt.payer_ref,
                    mt.payer_name,
                    p.status AS payment_status,
                    p.match_method,
                    s.order_reference,
                    s.status AS sale_status,
                    i.invoice_number,
                    i.fiscalization_status,
                    i.kra_receipt_number
             FROM mpesa_transactions mt
             LEFT JOIN payments p ON p.mpesa_transaction_id = mt.id
             LEFT JOIN sales s ON s.id = p.sale_id
             LEFT JOIN invoices i ON i.sale_id = s.id
             WHERE (
                    ($1::text IS NOT NULL AND mt.trans_id = $1)
                 OR ($1::text IS NULL AND mt.bill_ref_number = $2)
                   )
               AND ${filter}
             ORDER BY mt.trans_time DESC NULLS LAST
             LIMIT 1`,
            [transId, reference, scope.merchantId || scope.buyerId]
        )
    ).rows[0];

    s.json(row ? { found: true, ...row } : { found: false });
}));

module.exports = r;
