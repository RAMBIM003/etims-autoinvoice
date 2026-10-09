const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');
const oscu = require('../services/oscuService');
const mpesa = require('../services/mpesaService');

async function merchantForUser(userId) {
    const result = await db.query(
        `SELECT m.*
         FROM merchants m
         JOIN merchant_users mu ON mu.merchant_id = m.id
         WHERE mu.user_id = $1
           AND mu.status = 'ACTIVE'
         LIMIT 1`,
        [userId]
    );

    const merchant = result.rows[0];

    if (!merchant) {
        throw Object.assign(new Error('Merchant account not found'), {
            status: 404
        });
    }

    return merchant;
}

r.get('/', auth, wrap(async (q, s) => {
    const merchant = await merchantForUser(q.user.sub);

    const [kraResult, mpesaResult, branchesResult] = await Promise.all([
        db.query(
            `SELECT *
             FROM kra_connections
             WHERE merchant_id = $1
             LIMIT 1`,
            [merchant.id]
        ),

        db.query(
            `SELECT
                id,
                connection_type,
                environment,
                business_shortcode,
                status,
                callback_registration_status,
                callback_error,
                callback_registered_at
             FROM mpesa_connections
             WHERE merchant_id = $1
             ORDER BY connection_type`,
            [merchant.id]
        ),

        db.query(
            `SELECT
                id,
                branch_code,
                branch_name,
                kra_bhf_id,
                is_head_office,
                status
             FROM merchant_branches
             WHERE merchant_id = $1
             ORDER BY branch_code`,
            [merchant.id]
        )
    ]);

    s.json({
        merchant: {
            id: merchant.id,
            trading_name: merchant.trading_name,
            kra_pin: merchant.kra_pin
        },
        kra: kraResult.rows[0] || null,
        mpesa: mpesaResult.rows,
        branches: branchesResult.rows
    });
}));

r.post('/kra/check', auth, wrap(async (q, s) => {
    const merchant = await merchantForUser(q.user.sub);
    const pin = q.body?.kra_pin || merchant.kra_pin;

    const result = await oscu.check(pin);

    await db.query(
        `UPDATE kra_connections
         SET status = $1,
             last_verified_at = CASE
                WHEN $1 = 'CONNECTED' THEN now()
                ELSE last_verified_at
             END,
             last_result = $2,
             updated_at = now()
         WHERE merchant_id = $3`,
        [
            result.connected ? 'CONNECTED' : 'ERROR',
            result.message,
            merchant.id
        ]
    );

    s.json(result);
}));

r.post('/mpesa/register', auth, wrap(async (q, s) => {
    const merchant = await merchantForUser(q.user.sub);
    const shortcode = String(q.body?.shortcode || '').trim();

    const result = await db.query(
        `SELECT *
         FROM mpesa_connections
         WHERE merchant_id = $1
           AND business_shortcode = $2
         LIMIT 1`,
        [merchant.id, shortcode]
    );

    const connection = result.rows[0];

    if (!connection) {
        throw Object.assign(new Error('M-Pesa connection not found'), {
            status: 404
        });
    }

    const registration = await mpesa.registerUrls(
        connection.business_shortcode
    );

    await db.query(
        `UPDATE mpesa_connections
         SET callback_registration_status = $1,
             callback_error = $2,
             callback_registered_at = CASE
                WHEN $1 = 'REGISTERED' THEN now()
                ELSE callback_registered_at
             END,
             status = CASE
                WHEN $1 = 'REGISTERED' THEN 'ACTIVE'
                ELSE status
             END,
             updated_at = now()
         WHERE id = $3`,
        [
            registration.ok ? 'REGISTERED' : 'FAILED',
            registration.ok ? null : registration.error,
            connection.id
        ]
    );

    if (!registration.ok) {
        throw Object.assign(
            new Error(registration.error || 'M-Pesa URL registration failed'),
            { status: 502 }
        );
    }

    s.json(registration);
}));

module.exports = r;
