const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const mpesa = require('../services/mpesaService');
const receipts = require('../services/receiptService');
const sms = require('../services/smsService');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

// off (default) | local | daraja
const simulationMode = () =>
    String(process.env.PAYMENT_SIMULATION || 'off').toLowerCase();

// Africa/Nairobi is UTC+3 with no daylight saving.
const eatTimestamp = () =>
    new Date(Date.now() + 3 * 60 * 60 * 1000)
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);

async function buyerIdFor(userId) {
    const row = (
        await db.query(`SELECT id FROM buyers WHERE user_id = $1`, [userId])
    ).rows[0];

    if (!row) {
        throw fail('Buyer account not found. Sign in with a buyer account.', 404);
    }

    return row.id;
}

async function loadOrder(orderId, buyerId) {
    const sale = (
        await db.query(
            `SELECT s.id, s.merchant_id, s.order_reference, s.status,
                    s.total_amount, s.currency, s.created_at,
                    m.trading_name
             FROM sales s
             JOIN merchants m ON m.id = s.merchant_id
             WHERE s.id = $1
               AND s.buyer_id = $2`,
            [orderId, buyerId]
        )
    ).rows[0];

    if (!sale) {
        throw fail('Order not found', 404);
    }

    return sale;
}

async function describe(sale, withPayInfo = false) {
    const payment = (
        await db.query(
            `SELECT p.status, p.amount, mt.trans_id
             FROM payments p
             LEFT JOIN mpesa_transactions mt
                ON mt.id = p.mpesa_transaction_id
             WHERE p.sale_id = $1
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [sale.id]
        )
    ).rows[0] || null;

    const invoice = (
        await db.query(
            `SELECT id, invoice_number, fiscalization_status, kra_receipt_number
             FROM invoices
             WHERE sale_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [sale.id]
        )
    ).rows[0] || null;

    let receiptUrl = null;

    if (invoice && invoice.fiscalization_status === 'FISCALIZED') {
        try {
            receiptUrl = (await receipts.ensureReceipt(invoice.id)).url;
        } catch (error) {
            console.warn('Receipt link unavailable:', error.message);
        }
    }

    let stage = 'AWAITING_PAYMENT';

    if (sale.status === 'CANCELLED') {
        stage = 'CANCELLED';
    } else if (invoice && invoice.fiscalization_status === 'FISCALIZED') {
        stage = 'RECEIPT_READY';
    } else if (invoice && invoice.fiscalization_status === 'FAILED') {
        stage = 'FISCALIZATION_FAILED';
    } else if (payment && payment.status === 'MATCHED') {
        stage = invoice ? 'FISCALIZING' : 'PAYMENT_RECEIVED';
    } else if (payment && payment.status === 'AMOUNT_MISMATCH') {
        stage = 'PAYMENT_MISMATCH';
    }

    const result = {
        order: {
            id: sale.id,
            order_reference: sale.order_reference,
            status: sale.status,
            total_amount: sale.total_amount,
            currency: sale.currency,
            merchant_name: sale.trading_name,
            created_at: sale.created_at
        },
        payment,
        invoice: invoice && {
            id: invoice.id,
            number: invoice.invoice_number,
            status: invoice.fiscalization_status,
            kra_receipt_number: invoice.kra_receipt_number
        },
        receipt_url: receiptUrl,
        stage
    };

    if (withPayInfo) {
        const mp = (
            await db.query(
                `SELECT business_shortcode, connection_type
                 FROM mpesa_connections
                 WHERE merchant_id = $1
                   AND status IN ('ACTIVE', 'PENDING')
                 ORDER BY status
                 LIMIT 1`,
                [sale.merchant_id]
            )
        ).rows[0];

        result.pay = {
            shortcode: mp?.business_shortcode || null,
            type: mp?.connection_type || null,
            reference: sale.order_reference,
            amount: sale.total_amount
        };
    }

    return result;
}

// Public: lets the page know whether to show the sandbox payment button.
r.get('/simulation', (q, s) => {
    s.json({ mode: simulationMode() });
});

r.get('/orders', auth, wrap(async (q, s) => {
    const buyerId = await buyerIdFor(q.user.sub);

    const sales = (
        await db.query(
            `SELECT s.id, s.merchant_id, s.order_reference, s.status,
                    s.total_amount, s.currency, s.created_at,
                    m.trading_name
             FROM sales s
             JOIN merchants m ON m.id = s.merchant_id
             WHERE s.buyer_id = $1
             ORDER BY s.created_at DESC
             LIMIT 50`,
            [buyerId]
        )
    ).rows;

    s.json({ orders: await Promise.all(sales.map(x => describe(x))) });
}));

r.get('/orders/:id/status', auth, wrap(async (q, s) => {
    const buyerId = await buyerIdFor(q.user.sub);
    const sale = await loadOrder(q.params.id, buyerId);

    s.json(await describe(sale, true));
}));

// Buyer asks for their own receipt link by SMS: to their registered phone,
// or to another number they type in.
r.post('/receipts/:invoiceId/sms', auth, wrap(async (q, s) => {
    const buyerId = await buyerIdFor(q.user.sub);

    const owned = (
        await db.query(
            `SELECT i.id
             FROM invoices i
             JOIN sales s ON s.id = i.sale_id
             WHERE i.id = $1
               AND s.buyer_id = $2`,
            [q.params.invoiceId, buyerId]
        )
    ).rows[0];

    if (!owned) {
        throw fail('Receipt not found', 404);
    }

    const phone = q.body && q.body.phone ? String(q.body.phone) : null;

    s.json(await sms.sendReceiptSms(owned.id, { phone }));
}));

r.post('/orders/:id/simulate-payment', auth, wrap(async (q, s) => {
    const mode = simulationMode();

    if (mode !== 'local' && mode !== 'daraja') {
        throw fail('Payment simulation is disabled', 403);
    }

    const buyerId = await buyerIdFor(q.user.sub);
    const sale = await loadOrder(q.params.id, buyerId);

    if (sale.status !== 'AWAITING_PAYMENT') {
        throw fail('This order is not awaiting payment', 409);
    }

    const mp = (
        await db.query(
            `SELECT business_shortcode
             FROM mpesa_connections
             WHERE merchant_id = $1
               AND status IN ('ACTIVE', 'PENDING')
             ORDER BY status
             LIMIT 1`,
            [sale.merchant_id]
        )
    ).rows[0];

    if (!mp) {
        throw fail('This merchant has no M-Pesa shortcode configured', 400);
    }

    if (mode === 'daraja') {
        const result = await mpesa.simulateC2B({
            shortcode: mp.business_shortcode,
            amount: sale.total_amount,
            billRef: sale.order_reference
        });

        if (!result.ok) {
            throw fail(result.error || 'Daraja simulation failed', 502);
        }

        return s.json({
            mode: 'DARAJA_SANDBOX',
            message: 'Simulation sent to Daraja. The callback will arrive shortly.'
        });
    }

    // Local mode: a Daraja-shaped callback sent to our own confirmation
    // endpoint, so the real matching and invoicing code runs.
    const transId = 'SIM' + Math.random().toString(16).slice(2, 10).toUpperCase();

    const response = await fetch(
        `http://127.0.0.1:${process.env.PORT || 5000}/api/pay/c2b/confirmation`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                TransactionType: 'Pay Bill',
                TransID: transId,
                TransTime: eatTimestamp(),
                TransAmount: String(sale.total_amount),
                BusinessShortCode: String(mp.business_shortcode),
                BillRefNumber: sale.order_reference,
                MSISDN: '2547 ***** 126',
                FirstName: 'Sandbox',
                MiddleName: '',
                LastName: 'Buyer'
            })
        }
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.ResultCode !== 0) {
        throw fail(body.ResultDesc || 'Simulated payment was not accepted', 502);
    }

    s.json({
        mode: 'LOCAL_SIMULATION',
        trans_id: transId,
        message: 'Simulated payment sent to the confirmation endpoint.'
    });
}));

module.exports = r;
