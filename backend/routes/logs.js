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

/*
 * Read-only views of the workflow tables. Only the tables listed here can be
 * read. Each one is limited to the signed-in merchant and can be searched by
 * order reference. Columns in HIDDEN are never sent to the page.
 */
const TABLE_VIEWS = {
    payments: {
        from: 'payments t',
        scope: 't.merchant_id = $1',
        ref: "(t.payment_reference ILIKE $2 OR t.sale_id IN (SELECT id FROM sales WHERE order_reference ILIKE $2))",
        order: 't.created_at DESC'
    },
    sales: {
        from: 'sales t',
        scope: 't.merchant_id = $1',
        ref: 't.order_reference ILIKE $2',
        order: 't.created_at DESC'
    },
    sale_items: {
        from: 'sale_items t JOIN sales s ON s.id = t.sale_id',
        scope: 's.merchant_id = $1',
        ref: 's.order_reference ILIKE $2',
        order: 's.created_at DESC, t.line_number'
    },
    invoices: {
        from: 'invoices t JOIN sales s ON s.id = t.sale_id',
        scope: 't.merchant_id = $1',
        ref: 's.order_reference ILIKE $2',
        order: 't.created_at DESC'
    },
    fiscalization_attempts: {
        from: 'fiscalization_attempts t JOIN invoices i ON i.id = t.invoice_id JOIN sales s ON s.id = i.sale_id',
        scope: 'i.merchant_id = $1',
        ref: 's.order_reference ILIKE $2',
        order: 't.started_at DESC'
    },
    mpesa_transactions: {
        from: 'mpesa_transactions t',
        scope: 't.merchant_id = $1',
        ref: 't.bill_ref_number ILIKE $2',
        order: 't.callback_received_at DESC'
    },
    receipt_sms_deliveries: {
        from: 'receipt_sms_deliveries t JOIN receipts rc ON rc.id = t.receipt_id JOIN invoices i ON i.id = rc.invoice_id JOIN sales s ON s.id = i.sale_id',
        scope: 'i.merchant_id = $1',
        ref: 's.order_reference ILIKE $2',
        order: 't.created_at DESC',
        hidden: ['phone_encrypted', 'message']
    },
    item_kra_mappings: {
        from: 'item_kra_mappings t JOIN items it ON it.id = t.item_id',
        scope: 'it.merchant_id = $1',
        ref: 't.item_name ILIKE $2',
        order: 't.updated_at DESC'
    }
};

r.get('/tables', wrap(async (q, s) => {
    s.json({ tables: Object.keys(TABLE_VIEWS) });
}));

r.get('/tables/:name', wrap(async (q, s) => {
    const view = TABLE_VIEWS[q.params.name];

    if (!view) {
        throw Object.assign(new Error('That table is not available in the Logs page'), { status: 404 });
    }

    const membership = (
        await db.query(
            "SELECT merchant_id FROM merchant_users WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1",
            [q.user.sub]
        )
    ).rows[0];

    if (!membership) {
        throw Object.assign(new Error('Merchant account not found'), { status: 404 });
    }

    const search = String(q.query.reference || '').trim();
    const pattern = search ? `%${search}%` : '%%';

    const result = await db.query(
        `SELECT t.* FROM ${view.from}
         WHERE ${view.scope}
           AND ($2 = '%%' OR ${view.ref})
         ORDER BY ${view.order}
         LIMIT 200`,
        [membership.merchant_id, pattern]
    );

    const hidden = new Set(view.hidden || []);
    const rows = result.rows.map(row =>
        Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.has(key)))
    );
    const columns = rows.length ? Object.keys(rows[0]) : [];

    s.json({ table: q.params.name, columns, rows });
}));

module.exports = r;
