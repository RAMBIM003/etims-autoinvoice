const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

r.use(auth);

const STAGES = ['CALLBACK', 'PAYMENT', 'ORDER', 'KRA_ITEM', 'FISCALIZATION', 'RECEIPT_SMS', 'REGISTRATION', 'ACCOUNT'];
const OUTCOMES = ['OK', 'REJECTED', 'FAILED', 'STUCK'];

/*
 * Events for the signed-in merchant, plus events that could not be tied to a
 * merchant (such as a callback rejected before its shortcode was known).
 * This is a POC page: with several merchants, the unlinked rows should be
 * restricted to platform admins.
 */
r.get('/', wrap(async (q, s) => {
    const membership = (
        await db.query(
            "SELECT merchant_id FROM merchant_users WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1",
            [q.user.sub]
        )
    ).rows[0];

    if (!membership) {
        throw Object.assign(new Error('Merchant account not found'), { status: 404 });
    }

    const stage = STAGES.includes(String(q.query.stage || '')) ? String(q.query.stage) : null;
    const outcome = OUTCOMES.includes(String(q.query.outcome || '')) ? String(q.query.outcome) : null;
    const reference = String(q.query.reference || '').trim();
    const limit = Math.min(Math.max(Number(q.query.limit) || 200, 1), 500);

    const result = await db.query(
        `SELECT id, created_at, stage, outcome, code, reference, sale_id, invoice_id, message, detail
         FROM system_events
         WHERE (merchant_id = $1 OR merchant_id IS NULL)
           AND ($2::text IS NULL OR stage = $2)
           AND ($3::text IS NULL OR outcome = $3)
           AND ($4::text IS NULL OR reference ILIKE '%' || $4 || '%')
         ORDER BY created_at DESC
         LIMIT $5`,
        [membership.merchant_id, stage, outcome, reference || null, limit]
    );

    s.json({ events: result.rows, stages: STAGES, outcomes: OUTCOMES });
}));

module.exports = r;
