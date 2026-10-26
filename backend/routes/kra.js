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

    const connection = await oscu.check(pin);

    s.json({
        pin,
        name: pinCheck.name || null,
        type: pinCheck.type || null,
        status: pinCheck.status || 'UNVERIFIED',
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
