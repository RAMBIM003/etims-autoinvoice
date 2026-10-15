const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const C = require('../services/cryptoService');
const buyerLink = require('../services/buyerLinkService');

const { nameKey, last3 } = buyerLink;

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

const buyerFor = async userId => {
    const row = (
        await db.query(`SELECT id FROM buyers WHERE user_id = $1`, [userId])
    ).rows[0];

    if (!row) {
        throw fail('Buyer account not found. Sign in with a buyer account.', 404);
    }

    return row.id;
};

const activeLast3 = async buyerId => {
    const row = (
        await db.query(
            `SELECT phone_encrypted
             FROM buyer_phones
             WHERE buyer_id = $1 AND status = 'ACTIVE'
             ORDER BY verified_at DESC NULLS LAST, created_at DESC
             LIMIT 1`,
            [buyerId]
        )
    ).rows[0];

    if (!row) {
        throw fail('Verify your phone number before linking M-Pesa payments', 400);
    }

    return last3(C.dec(row.phone_encrypted));
};

r.use(auth);

r.get('/mpesa', wrap(async (q, s) => {
    const id = await buyerFor(q.user.sub);

    const row = (
        await db.query(
            `SELECT mpesa_name, mpesa_last3, mpesa_consent_at FROM buyers WHERE id = $1`,
            [id]
        )
    ).rows[0];

    s.json({
        linked: !!row.mpesa_consent_at,
        mpesa_name: row.mpesa_name || null,
        phone_last3: row.mpesa_last3 || null
    });
}));

r.put('/mpesa', wrap(async (q, s) => {
    const id = await buyerFor(q.user.sub);
    const body = q.body || {};

    if (body.consent !== true) {
        throw fail('Consent is required to link M-Pesa payments to your account', 400);
    }

    const name = String(body.mpesa_name || '').trim();
    const key = nameKey(name);

    if (key.split(' ').filter(Boolean).length < 2) {
        throw fail('Enter your full name exactly as it appears on M-Pesa', 400);
    }

    const digits = await activeLast3(id);

    await db.tx(async c => {
        await c.query(
            `UPDATE buyers
             SET mpesa_name = $1, mpesa_name_key = $2, mpesa_last3 = $3, mpesa_consent_at = now()
             WHERE id = $4`,
            [name, key, digits, id]
        );

        await c.query(
            `INSERT INTO consent_records
                (user_id, subject_type, subject_id, purpose, policy_version, action)
             SELECT user_id, 'BUYER', $1, 'MPESA_NAME_LINKING', 'v1', 'GRANTED'
             FROM buyers WHERE id = $1`,
            [id]
        );
    });

    // Pick up earlier payments that match this buyer.
    const salesLinked = await buyerLink.relinkForBuyer(id);

    s.json({
        linked: true,
        mpesa_name: name,
        phone_last3: digits,
        sales_linked: salesLinked
    });
}));

r.delete('/mpesa', wrap(async (q, s) => {
    const id = await buyerFor(q.user.sub);

    await db.tx(async c => {
        await c.query(
            `UPDATE buyers
             SET mpesa_name = NULL, mpesa_name_key = NULL, mpesa_last3 = NULL, mpesa_consent_at = NULL
             WHERE id = $1`,
            [id]
        );

        await c.query(
            `INSERT INTO consent_records
                (user_id, subject_type, subject_id, purpose, policy_version, action)
             SELECT user_id, 'BUYER', $1, 'MPESA_NAME_LINKING', 'v1', 'REVOKED'
             FROM buyers WHERE id = $1`,
            [id]
        );
    });

    s.json({ linked: false });
}));

module.exports = r;