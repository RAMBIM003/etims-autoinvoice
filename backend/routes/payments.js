const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

r.use(auth);

const merchantForUser = async userId => {
    const result = await db.query(
        `SELECT m.id
         FROM merchants m
         JOIN merchant_users mu ON mu.merchant_id = m.id
         WHERE mu.user_id = $1
           AND mu.status = 'ACTIVE'
         LIMIT 1`,
        [userId]
    );

    if (!result.rows[0]) {
        throw Object.assign(new Error('Merchant account not found'), {
            status: 404
        });
    }

    return result.rows[0].id;
};

r.get('/payments', wrap(async (q, s) => {
    const merchantId = await merchantForUser(q.user.sub);

    const result = await db.query(
        `SELECT
            p.*,
            mt.trans_id,
            mt.business_shortcode,
            mt.bill_ref_number,
            mt.payer_name,
            mt.trans_time
         FROM payments p
         LEFT JOIN mpesa_transactions mt
            ON mt.id = p.mpesa_transaction_id
         WHERE p.merchant_id = $1
         ORDER BY p.created_at DESC`,
        [merchantId]
    );

    s.json({
        payments: result.rows
    });
}));

r.get('/payments/:id', wrap(async (q, s) => {
    const merchantId = await merchantForUser(q.user.sub);

    const result = await db.query(
        `SELECT
            p.*,
            mt.trans_id,
            mt.business_shortcode,
            mt.bill_ref_number,
            mt.payer_ref,
            mt.payer_name,
            mt.trans_time,
            mt.raw_callback
         FROM payments p
         LEFT JOIN mpesa_transactions mt
            ON mt.id = p.mpesa_transaction_id
         WHERE p.id = $1
           AND p.merchant_id = $2
         LIMIT 1`,
        [q.params.id, merchantId]
    );

    if (!result.rows[0]) {
        throw Object.assign(new Error('Payment not found'), {
            status: 404
        });
    }

    s.json({
        payment: result.rows[0]
    });
}));

module.exports = r;
