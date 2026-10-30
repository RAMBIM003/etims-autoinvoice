const r = require('express').Router();
const db = require('../db');
const kra = require('../services/kraService');
const oscu = require('../services/oscuService');
const fiscalization = require('../services/fiscalizationService');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

const check = async pinValue => {
    const pin = String(pinValue || '').trim().toUpperCase();

    if (!/^[AP]\d{9}[A-Z]$/.test(pin)) {
        throw fail('Invalid PIN format', 400);
    }

    const result = await kra.validatePin(pin);

    await db.query(
        `INSERT INTO kra_pin_verifications (
            subject_type,
            kra_pin,
            result_code,
            result_message,
            taxpayer_name,
            taxpayer_type,
            pin_status,
            raw_response
         )
         VALUES (
            'PRE_REGISTRATION', $1, $2, $3, $4, $5, $6, $7
         )`,
        [
            pin,
            result.code,
            result.message,
            result.name || null,
            result.type || null,
            result.status || null,
            result.raw
        ]
    );

    return result;
};

r.post('/kra/validate-pin', wrap(async (q, s) => {
    const result = await check(q.body?.pin);

    if (result.unavailable) {
        return s.json({
            pin: q.body?.pin,
            verified: false,
            status: 'UNAVAILABLE',
            code: result.code,
            message: result.message
        });
    }

    if (!result.valid) {
        throw fail('This KRA PIN is not valid', 400);
    }

    return s.json({
        pin: result.pin,
        name: result.name,
        type: result.type,
        status: result.status,
        verified: true
    });
}));

r.post('/kra/connect', auth, wrap(async (q, s) => {
    const pin = String(q.body?.pin || '').trim().toUpperCase();

    if (!/^[AP]\d{9}[A-Z]$/.test(pin)) {
        throw fail('Invalid PIN format', 400);
    }

    const pinCheck = await check(pin);

    const sandboxUnavailable =
        pinCheck.unavailable &&
        pinCheck.code === '19005' &&
        String(process.env.KRA_ENV || '').toUpperCase() === 'SANDBOX';

    if (!pinCheck.valid && !sandboxUnavailable) {
        throw fail('This KRA PIN is not valid', 400);
    }

    // The OSCU device belongs to one PIN, and it reports its own branch.
    const connection = await oscu.check(pin);

    if (!connection.connected) {
        throw fail(connection.message || 'KRA eTIMS connection could not be established', 502);
    }

    const bhf = process.env.KRA_BRANCH_ID || '00';
    const environment = process.env.KRA_ENV || 'SANDBOX';
    const status = pinCheck.status || 'UNVERIFIED';

    let merchantId;

    try {
        merchantId = await db.tx(async c => {
            const pending = (
                await c.query('SELECT * FROM pending_businesses WHERE user_id = $1', [q.user.sub])
            ).rows[0];

            let merchant = (
                await c.query(
                    `SELECT m.* FROM merchants m
                     JOIN merchant_users mu ON mu.merchant_id = m.id
                     WHERE mu.user_id = $1 AND mu.status = 'ACTIVE'
                     LIMIT 1`,
                    [q.user.sub]
                )
            ).rows[0];

            if (!merchant) {
                if (!pending) {
                    throw fail('Create your business account first', 400);
                }

                merchant = (
                    await c.query(
                        `INSERT INTO merchants
                         (trading_name, kra_pin, taxpayer_name, taxpayer_type, kra_status, business_phone, business_type)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         RETURNING *`,
                        [
                            pending.trading_name,
                            pin,
                            pinCheck.name || null,
                            pinCheck.type || null,
                            status,
                            pending.business_phone,
                            pending.business_type
                        ]
                    )
                ).rows[0];

                await c.query(
                    "INSERT INTO merchant_users (merchant_id, user_id, role) VALUES ($1, $2, 'OWNER')",
                    [merchant.id, q.user.sub]
                );

                await c.query('DELETE FROM pending_businesses WHERE user_id = $1', [q.user.sub]);
            } else {
                await c.query(
                    `UPDATE merchants
                     SET kra_pin = $1, taxpayer_name = $2, taxpayer_type = $3, kra_status = $4, updated_at = now()
                     WHERE id = $5`,
                    [pin, pinCheck.name || null, pinCheck.type || null, status, merchant.id]
                );
            }

            const branch = (
                await c.query(
                    `INSERT INTO merchant_branches (merchant_id, branch_code, branch_name, kra_bhf_id, is_head_office)
                     VALUES ($1, 'HQ', 'Head office', $2, true)
                     ON CONFLICT (merchant_id, kra_bhf_id) DO UPDATE SET status = 'ACTIVE'
                     RETURNING id`,
                    [merchant.id, bhf]
                )
            ).rows[0];

            await c.query(
                `INSERT INTO kra_connections
                 (merchant_id, branch_id, environment, kra_pin, bhf_id, status, last_verified_at, last_result)
                 VALUES ($1, $2, $3, $4, $5, 'CONNECTED', now(), $6)
                 ON CONFLICT (merchant_id) DO UPDATE SET
                    branch_id = EXCLUDED.branch_id,
                    environment = EXCLUDED.environment,
                    kra_pin = EXCLUDED.kra_pin,
                    bhf_id = EXCLUDED.bhf_id,
                    status = 'CONNECTED',
                    last_verified_at = now(),
                    last_result = EXCLUDED.last_result,
                    updated_at = now()`,
                [merchant.id, branch.id, environment, pin, bhf, connection.message || null]
            );

            await c.query(
                `INSERT INTO merchant_onboarding (merchant_id, current_step, status)
                 VALUES ($1, 'MPESA', 'IN_PROGRESS')
                 ON CONFLICT (merchant_id) DO NOTHING`,
                [merchant.id]
            );

            return merchant.id;
        });
    } catch (error) {
        if (error.code === '23505') {
            throw fail('This KRA PIN is already linked to another business', 409);
        }
        throw error;
    }

    s.json({
        merchant_id: merchantId,
        pin,
        name: pinCheck.name || null,
        type: pinCheck.type || null,
        status,
        pinChecker: {
            verified: !!pinCheck.valid,
            status: pinCheck.unavailable ? 'UNAVAILABLE' : 'VERIFIED',
            code: pinCheck.code || null,
            message: pinCheck.message || null
        },
        oscu: connection
    });
}));

/*
 * Manual (re)submit of a sale to KRA. Merchant-only: the authenticated
 * user must belong to the merchant that owns the sale. The same service
 * runs automatically after a matched payment.
 */
r.post('/kra/fiscalize/:saleId', auth, wrap(async (q, s) => {
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

    const result = await fiscalization.fiscalizeSale(
        q.params.saleId,
        membership.merchant_id
    );

    s.json(result);
}));

module.exports = r;
