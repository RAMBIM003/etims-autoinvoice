
const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

const merchantForUser = async id => {
    const result = await db.query(
        `SELECT m.*
         FROM merchants m
         JOIN merchant_users mu ON mu.merchant_id = m.id
         WHERE mu.user_id = $1
           AND mu.status = 'ACTIVE'
         LIMIT 1`,
        [id]
    );

    const merchant = result.rows[0];

    if (!merchant) {
        throw Object.assign(new Error('Merchant account not found'), {
            status: 404
        });
    }

    return merchant;
};

r.get('/dashboard', auth, wrap(async (q, s) => {
    const merchant = await merchantForUser(q.user.sub);
    const id = merchant.id;

    const [
        statsResult,
        ordersResult,
        paymentsResult,
        invoicesResult,
        branchesResult,
        kraResult,
        mpesaResult
    ] = await Promise.all([
        db.query(
            `SELECT
                (SELECT count(*)
                 FROM items
                 WHERE merchant_id = $1
                   AND status = 'ACTIVE') AS items,

                (SELECT count(*)
                 FROM sales
                 WHERE merchant_id = $1) AS orders,

                (SELECT COALESCE(sum(total_amount), 0)
                 FROM sales
                 WHERE merchant_id = $1
                   AND status IN (
                       'PAID',
                       'FISCALIZATION_PENDING',
                       'CLOSED'
                   )
                   AND created_at >= CURRENT_DATE
                   AND created_at < CURRENT_DATE + INTERVAL '1 day'
                ) AS today_sales,

                (SELECT count(*)
                 FROM payments
                 WHERE merchant_id = $1
                   AND status = 'MATCHED') AS matched_payments,

                (SELECT count(*)
                 FROM payments
                 WHERE merchant_id = $1
                   AND status = 'UNMATCHED') AS unmatched_payments,

                (SELECT count(*)
                 FROM invoices
                 WHERE merchant_id = $1) AS invoices,

                (SELECT count(*)
                 FROM invoices
                 WHERE merchant_id = $1
                   AND fiscalization_status = 'FISCALIZED'
                ) AS fiscalized_invoices`,
            [id]
        ),

        db.query(
            `SELECT
                s.id,
                s.order_reference,
                s.status,
                s.currency,
                s.total_amount,
                s.created_at,
                COALESCE(u.full_name, 'Walk-in customer') AS customer_name
             FROM sales s
             LEFT JOIN buyers b ON b.id = s.buyer_id
             LEFT JOIN users u ON u.id = b.user_id
             WHERE s.merchant_id = $1
             ORDER BY s.created_at DESC
             LIMIT 8`,
            [id]
        ),

        db.query(
            `SELECT
                p.id,
                p.amount,
                p.currency,
                p.status,
                p.match_method,
                p.payment_reference,
                p.paid_at,
                mt.trans_id,
                mt.business_shortcode,
                mt.payer_name
             FROM payments p
             LEFT JOIN mpesa_transactions mt
                ON mt.id = p.mpesa_transaction_id
             WHERE p.merchant_id = $1
             ORDER BY COALESCE(p.paid_at, p.created_at) DESC
             LIMIT 8`,
            [id]
        ),

        db.query(
            `SELECT
                id,
                sale_id,
                invoice_number,
                seller_pin,
                seller_name,
                buyer_pin,
                buyer_name,
                currency,
                subtotal,
                tax_amount,
                total_amount,
                fiscalization_status,
                kra_receipt_number,
                kra_invoice_number,
                cu_serial_number,
                fiscalized_at,
                created_at
             FROM invoices
             WHERE merchant_id = $1
             ORDER BY created_at DESC
             LIMIT 8`,
            [id]
        ),

        db.query(
            `SELECT
                id,
                branch_code,
                branch_name,
                kra_bhf_id,
                is_head_office,
                status,
                created_at
             FROM merchant_branches
             WHERE merchant_id = $1
             ORDER BY branch_code`,
            [id]
        ),

        db.query(
            `SELECT status, last_verified_at, last_result
             FROM kra_connections
             WHERE merchant_id = $1
             LIMIT 1`,
            [id]
        ),

        db.query(
            `SELECT
                connection_type,
                business_shortcode,
                status,
                callback_registration_status,
                callback_error
             FROM mpesa_connections
             WHERE merchant_id = $1
             ORDER BY connection_type`,
            [id]
        )
    ]);

    const stats = statsResult.rows[0];

    s.json({
        merchant: {
            id: merchant.id,
            trading_name: merchant.trading_name,
            kra_pin: merchant.kra_pin
        },

        stats: {
            items: Number(stats.items),
            orders: Number(stats.orders),
            today_sales: Number(stats.today_sales),
            matched_payments: Number(stats.matched_payments),
            unmatched_payments: Number(stats.unmatched_payments),
            invoices: Number(stats.invoices),
            fiscalized_invoices: Number(stats.fiscalized_invoices)
        },

        orders: ordersResult.rows,
        payments: paymentsResult.rows,
        invoices: invoicesResult.rows,
        branches: branchesResult.rows,

        connections: {
            kra: kraResult.rows[0] || null,
            mpesa: mpesaResult.rows
        }
    });
}));

module.exports = r;