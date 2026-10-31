const r = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const C = require('../services/cryptoService');
const otp = require('../services/otpService');
const kra = require('../services/kraService');
const oscu = require('../services/oscuService');
const mpesa = require('../services/mpesaService');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const need = (ok, message) => { if (!ok) throw fail(message, 400); };

/*
 * One request does the whole sign-up:
 *   owner login + phone OTP + business + KRA PIN + M-Pesa shortcode.
 * The KRA PIN and the eTIMS device are checked before anything is saved, so a
 * failed check creates no account. The M-Pesa callbacks are registered after
 * the save; if Daraja refuses, the account still exists and the callbacks can
 * be retried from the connections page.
 */
r.post('/merchant/register', wrap(async (q, s) => {
    const b = q.body || {};

    const trading = String(b.business || '').trim();
    const businessPhone = String(b.business_phone || '').trim();
    const businessType = String(b.business_type || '').trim();
    const pin = String(b.kra_pin || '').trim().toUpperCase();
    const shortcode = String(b.shortcode || '').trim();
    const connectionType = String(b.connection_type || 'PAYBILL').toUpperCase();

    const email = String(b.email || '').trim().toLowerCase();
    const phone = String(b.phone || '').trim();
    const fullName = String(b.fullName || '').trim();

    need(fullName.length > 1, "Enter the owner's full name");
    need(C.phoneOk(phone), 'Enter a valid phone number');
    need(/^\S+@\S+\.\S+$/.test(email), 'Enter a valid email address');
    need(String(b.password || '').length >= 8, 'Password must be at least 8 characters');
    need(b.consent === true, 'Consent is required');
    need(trading.length > 0, 'Enter the business name');
    need(C.phoneOk(businessPhone), 'Enter a valid business phone number');
    need(businessType.length > 0, 'Choose the business type');
    need(/^[AP]\d{9}[A-Z]$/.test(pin), 'Enter a valid KRA PIN');
    need(/^\d{5,7}$/.test(shortcode), 'Enter a valid M-Pesa shortcode');
    need(['PAYBILL', 'TILL'].includes(connectionType), 'Connection type must be PAYBILL or TILL');

    // KRA checks run before the transaction: they are network calls.
    // KRA_PIN_CHECK=off (POC only) skips the PIN checker; the eTIMS device check still runs.
    const pinCheck = process.env.KRA_PIN_CHECK === 'off'
        ? { valid: true, unavailable: false, name: null, type: null, status: 'NOT_CHECKED' }
        : await kra.validatePin(pin);

    const sandboxUnavailable =
        pinCheck.unavailable &&
        pinCheck.code === '19005' &&
        String(process.env.KRA_ENV || '').toUpperCase() === 'SANDBOX';

    if (!pinCheck.valid && !sandboxUnavailable) {
        throw fail('This KRA PIN is not valid', 400);
    }

    const connection = await oscu.check(pin);

    if (!connection.connected) {
        throw fail(connection.message || 'KRA eTIMS connection could not be established', 502);
    }

    const bhf = process.env.KRA_BRANCH_ID || '00';
    const environment = process.env.KRA_ENV || 'SANDBOX';
    const kraStatus = pinCheck.status || 'UNVERIFIED';
    const mpesaEnv = process.env.MPESA_ENV || 'sandbox';

    const saved = await db.tx(async c => {
        await otp.consume(c, phone, 'SIGNUP_MERCHANT');

        const emailTaken = (await c.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount;
        if (emailTaken) throw fail('That email is already registered. Sign in instead.', 409);

        const pinTaken = (await c.query('SELECT 1 FROM merchants WHERE kra_pin = $1', [pin])).rowCount;
        if (pinTaken) throw fail('This KRA PIN is already linked to another business', 409);

        const shortcodeTaken = (
            await c.query('SELECT merchant_id FROM mpesa_connections WHERE business_shortcode = $1 LIMIT 1', [shortcode])
        ).rows[0];
        if (shortcodeTaken) throw fail('This shortcode is linked to another business', 409);

        const user = (
            await c.query(
                'INSERT INTO users(email, full_name, password_hash, phone_hash, phone_encrypted) VALUES($1, $2, $3, $4, $5) RETURNING id',
                [email, fullName, await bcrypt.hash(b.password, 10), C.phoneHash(phone), C.enc(C.norm(phone))]
            )
        ).rows[0];

        const merchant = (
            await c.query(
                `INSERT INTO merchants
                 (trading_name, kra_pin, taxpayer_name, taxpayer_type, kra_status, business_phone, business_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [trading, pin, pinCheck.name || null, pinCheck.type || null, kraStatus, C.norm(businessPhone), businessType]
            )
        ).rows[0];

        await c.query(
            "INSERT INTO merchant_users (merchant_id, user_id, role) VALUES ($1, $2, 'OWNER')",
            [merchant.id, user.id]
        );

        const branch = (
            await c.query(
                `INSERT INTO merchant_branches (merchant_id, branch_code, branch_name, kra_bhf_id, is_head_office)
                 VALUES ($1, 'HQ', 'Head office', $2, true)
                 RETURNING id`,
                [merchant.id, bhf]
            )
        ).rows[0];

        await c.query(
            `INSERT INTO kra_connections
             (merchant_id, branch_id, environment, kra_pin, bhf_id, status, last_verified_at, last_result)
             VALUES ($1, $2, $3, $4, $5, 'CONNECTED', now(), $6)`,
            [merchant.id, branch.id, environment, pin, bhf, connection.message || null]
        );

        const mpesaRow = (
            await c.query(
                `INSERT INTO mpesa_connections (merchant_id, connection_type, environment, business_shortcode)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [merchant.id, connectionType, mpesaEnv, shortcode]
            )
        ).rows[0];

        await c.query(
            "INSERT INTO merchant_onboarding (merchant_id, current_step, status) VALUES ($1, 'MPESA', 'IN_PROGRESS')",
            [merchant.id]
        );

        await c.query(
            "INSERT INTO consent_records(user_id, subject_type, subject_id, purpose, policy_version, action) VALUES($1, 'USER', $1, 'ACCOUNT_TERMS', 'v1', 'GRANTED')",
            [user.id]
        );

        return { uid: user.id, merchantId: merchant.id, mpesaId: mpesaRow.id };
    });

    // Register the M-Pesa callbacks now that the connection is saved.
    const registration = await mpesa.registerUrls(shortcode);

    await db.query(
        `UPDATE mpesa_connections
         SET callback_registration_status = $1,
             callback_error = $2,
             callback_registered_at = CASE WHEN $1 = 'REGISTERED' THEN now() ELSE callback_registered_at END,
             status = CASE WHEN $1 = 'REGISTERED' THEN 'ACTIVE' ELSE status END,
             updated_at = now()
         WHERE id = $3`,
        [
            registration.ok ? 'REGISTERED' : 'FAILED',
            registration.ok ? null : registration.error,
            saved.mpesaId
        ]
    );

    if (registration.ok) {
        await db.query(
            "UPDATE merchant_onboarding SET current_step = 'DONE', status = 'COMPLETED', updated_at = now() WHERE merchant_id = $1",
            [saved.merchantId]
        );
    }

    s.json({
        token: auth.sign(saved.uid),
        merchant_id: saved.merchantId,
        taxpayer_name: pinCheck.name || null,
        callbacks: {
            registered: !!registration.ok,
            error: registration.ok ? null : registration.error || 'M-Pesa callback registration failed'
        }
    });
}));

/*
 * Checks a KRA PIN for the sign-up form before the code is sent.
 * Uses the same PIN checker as /kra/validate-pin, so the user sees the
 * registered taxpayer name before creating an account.
 */
r.post('/merchant/check-pin', wrap(async (q, s) => {
    const pin = String(q.body?.pin || '').trim().toUpperCase();

    need(/^[AP]\d{9}[A-Z]$/.test(pin), 'Enter a valid KRA PIN');

    const result = process.env.KRA_PIN_CHECK === 'off'
        ? { valid: true, name: null, type: null, status: 'NOT_CHECKED' }
        : await kra.validatePin(pin);

    if (!result.valid) {
        throw fail('This KRA PIN is not valid', 400);
    }

    const taken = (await db.query('SELECT 1 FROM merchants WHERE kra_pin = $1', [pin])).rowCount;
    if (taken) throw fail('This KRA PIN is already linked to another business', 409);

    s.json({ pin, name: result.name || null, type: result.type || null, status: result.status || null });
}));

module.exports = r;
