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

/*
 * Orders that are stuck right now. Computed on each request rather than stored,
 * so the list cannot go out of date.
 */
r.get('/problems', wrap(async (q, s) => {
    const membership = (
        await db.query(
            "SELECT merchant_id FROM merchant_users WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1",
            [q.user.sub]
        )
    ).rows[0];

    if (!membership) {
        throw Object.assign(new Error('Merchant account not found'), { status: 404 });
    }

    const result = await db.query(
        `SELECT s.order_reference,
                s.status AS sale_status,
                s.updated_at,
                i.id AS invoice_id,
                i.fiscalization_status,
                i.updated_at AS invoice_updated_at,
                (SELECT count(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
         FROM sales s
         LEFT JOIN invoices i ON i.sale_id = s.id
         WHERE s.merchant_id = $1
           AND (
             (s.status IN ('PAID', 'FISCALIZATION_PENDING')
              AND s.updated_at < now() - interval '10 minutes'
              AND (i.id IS NULL OR i.fiscalization_status <> 'FISCALIZED'))
             OR
             (i.fiscalization_status = 'PROCESSING'
              AND i.updated_at < now() - interval '5 minutes')
           )
         ORDER BY s.updated_at DESC
         LIMIT 100`,
        [membership.merchant_id]
    );

    const problems = result.rows.map(row => {
        if (row.fiscalization_status === 'PROCESSING') {
            return { order_reference: row.order_reference, problem: 'Stuck while sending to KRA for more than 5 minutes. The server may have restarted during the request.' };
        }
        if (Number(row.item_count) === 0) {
            return { order_reference: row.order_reference, problem: 'Paid, but the order has no items, so fiscalization cannot run.' };
        }
        if (!row.invoice_id) {
            return { order_reference: row.order_reference, problem: 'Paid for more than 10 minutes, but no invoice was created.' };
        }
        return { order_reference: row.order_reference, problem: `Paid for more than 10 minutes, invoice still ${row.fiscalization_status}.` };
    });

    s.json({ problems });
}));

module.exports = r;
