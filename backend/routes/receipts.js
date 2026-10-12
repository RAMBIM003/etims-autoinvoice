const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const receipts = require('../services/receiptService');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

// Public: anyone holding the private link can view the receipt.
r.get('/public/:token', wrap(async (q, s) => {
    s.set('Cache-Control', 'no-store');
    s.json(await receipts.getPublicReceipt(q.params.token));
}));

// Merchant only: returns the shareable link for one of their invoices.
r.get('/link/:invoiceId', auth, wrap(async (q, s) => {
    const membership = (
        await db.query(
            `SELECT merchant_id
             FROM merchant_users
             WHERE user_id = $1
               AND status = 'ACTIVE'
             LIMIT 1`,
            [q.user.sub]
        )
    ).rows[0];

    if (!membership) {
        throw fail('Merchant account not found', 404);
    }

    const owned = (
        await db.query(
            `SELECT 1 FROM invoices WHERE id = $1 AND merchant_id = $2`,
            [q.params.invoiceId, membership.merchant_id]
        )
    ).rows[0];

    if (!owned) {
        throw fail('Invoice not found', 404);
    }

    const { url } = await receipts.ensureReceipt(q.params.invoiceId);

    s.json({ url });
}));

module.exports = r;
