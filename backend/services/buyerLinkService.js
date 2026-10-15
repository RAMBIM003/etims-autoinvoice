const db = require('../db');

const tokens = s =>
    String(s || '')
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .toUpperCase()
        .split(/\s+/)
        .filter(Boolean);

const nameKey = s => tokens(s).sort().join(' ');

// "2547 ***** 126" -> "126"
const last3 = value => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 3 ? digits.slice(-3) : null;
};

// LINKED only when exactly one consenting buyer matches. Otherwise AMBIGUOUS, NONE or NO_DATA.
async function findBuyer(c, fullName, msisdn) {
    const key = nameKey(fullName);
    const digits = last3(msisdn);

    if (!key || !digits) {
        return { status: 'NO_DATA', detail: 'payer name or number missing' };
    }

    const rows = (
        await c.query(
            `SELECT id FROM buyers
             WHERE mpesa_name_key = $1
               AND mpesa_last3 = $2
               AND mpesa_consent_at IS NOT NULL`,
            [key, digits]
        )
    ).rows;

    if (rows.length === 1) {
        return {
            status: 'LINKED',
            buyerId: rows[0].id,
            detail: `M-Pesa name and last digits ${digits}`
        };
    }

    if (rows.length > 1) {
        return { status: 'AMBIGUOUS', detail: `${rows.length} buyers match; not linked` };
    }

    return { status: 'NONE', detail: 'no buyer matches' };
}

// Runs after a matched payment, before the KRA invoice is signed.
async function linkSaleFromPayment(paymentId) {
    return db.tx(async c => {
        const row = (
            await c.query(
                `SELECT p.sale_id, s.buyer_id, mt.payer_name, mt.payer_ref
                 FROM payments p
                 JOIN sales s ON s.id = p.sale_id
                 LEFT JOIN mpesa_transactions mt ON mt.id = p.mpesa_transaction_id
                 WHERE p.id = $1
                 FOR UPDATE OF s`,
                [paymentId]
            )
        ).rows[0];

        if (!row) {
            return { status: 'NO_PAYMENT', detail: 'payment not found' };
        }

        if (row.buyer_id) {
            return { status: 'ALREADY_LINKED', detail: 'sale already has a buyer' };
        }

        const m = await findBuyer(c, row.payer_name, row.payer_ref);

        if (m.status === 'LINKED') {
            await c.query(
                `UPDATE sales
                 SET buyer_id = $1,
                     buyer_link_method = 'MPESA_NAME_PHONE',
                     buyer_link_detail = $2,
                     updated_at = now()
                 WHERE id = $3 AND buyer_id IS NULL`,
                [m.buyerId, m.detail, row.sale_id]
            );
        } else {
            await c.query(
                `UPDATE sales
                 SET buyer_link_method = $1,
                     buyer_link_detail = $2,
                     updated_at = now()
                 WHERE id = $3`,
                [m.status, m.detail, row.sale_id]
            );
        }

        return m;
    });
}

// Runs when a buyer registers or sets their M-Pesa name. Links earlier matched
// payments that have no buyer and that match this buyer uniquely.
// Signed invoices get the link for display, but their buyer PIN is not added.
async function relinkForBuyer(buyerId) {
    return db.tx(async c => {
        const candidates = (
            await c.query(
                `SELECT s.id AS sale_id, mt.payer_name, mt.payer_ref,
                        (SELECT i.fiscalization_status
                         FROM invoices i
                         WHERE i.sale_id = s.id
                         ORDER BY i.created_at DESC
                         LIMIT 1) AS invoice_status
                 FROM sales s
                 JOIN payments p ON p.sale_id = s.id AND p.status = 'MATCHED'
                 JOIN mpesa_transactions mt ON mt.id = p.mpesa_transaction_id
                 WHERE s.buyer_id IS NULL
                   AND s.status <> 'CANCELLED'`
            )
        ).rows;

        let linked = 0;

        for (const x of candidates) {
            const m = await findBuyer(c, x.payer_name, x.payer_ref);

            if (m.status !== 'LINKED' || m.buyerId !== buyerId) {
                continue;
            }

            const signed = x.invoice_status === 'FISCALIZED';

            await c.query(
                `UPDATE sales
                 SET buyer_id = $1,
                     buyer_link_method = $2,
                     buyer_link_detail = $3,
                     updated_at = now()
                 WHERE id = $4 AND buyer_id IS NULL`,
                [
                    buyerId,
                    signed ? 'MPESA_NAME_PHONE_AFTER_SIGNING' : 'MPESA_NAME_PHONE',
                    signed
                        ? `${m.detail}; linked after KRA signing, buyer PIN not on invoice`
                        : m.detail,
                    x.sale_id
                ]
            );

            linked += 1;
        }

        return linked;
    });
}

module.exports = { linkSaleFromPayment, relinkForBuyer, findBuyer, nameKey, last3 };