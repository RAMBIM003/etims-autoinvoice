const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

const merchantForUser = async userId => {
  const row = (
    await db.query(
      `SELECT m.*
       FROM merchants m
       JOIN merchant_users mu ON mu.merchant_id=m.id
       WHERE mu.user_id=$1
       AND mu.status='ACTIVE'
       LIMIT 1`,
      [userId]
    )
  ).rows[0];

  if (!row) {
    const e = new Error('Merchant account not found');
    e.status = 404;
    throw e;
  }

  return row;
};

r.get('/dashboard', auth, wrap(async (q, s) => {
  const merchant = await merchantForUser(q.user.sub);
  const merchantId = merchant.id;

  const [
    stats,
    todaySales,
    recentSales,
    recentPayments,
    recentInvoices,
    branches,
    connections
  ] = await Promise.all([

    db.query(
      `SELECT
        (SELECT COUNT(*) FROM items
         WHERE merchant_id=$1 AND status='ACTIVE') AS items,

        (SELECT COUNT(*) FROM sales
         WHERE merchant_id=$1) AS orders,

        (SELECT COALESCE(SUM(total_amount),0)
         FROM sales
         WHERE merchant_id=$1
         AND status='CLOSED'
         AND created_at >= CURRENT_DATE
         AND created_at < CURRENT_DATE + INTERVAL '1 day') AS today_sales,

        (SELECT COUNT(*)
         FROM payments
         WHERE merchant_id=$1
         AND status='MATCHED') AS matched_payments,

        (SELECT COUNT(*)
         FROM payments
         WHERE merchant_id=$1
         AND status='UNMATCHED') AS unmatched_payments,

        (SELECT COUNT(*)
         FROM invoices
         WHERE merchant_id=$1) AS invoices,

        (SELECT COUNT(*)
         FROM invoices
         WHERE merchant_id=$1
         AND fiscalization_status='FISCALIZED') AS fiscalized_invoices`,
      [merchantId]
    ),

    db.query(
      `SELECT
        COUNT(*) AS count,
        COALESCE(SUM(total_amount),0) AS total
       FROM sales
       WHERE merchant_id=$1
       AND status='CLOSED'
       AND created_at >= CURRENT_DATE
       AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [merchantId]
    ),

    db.query(
      `SELECT
        s.id,
        s.order_reference,
        s.status,
        s.currency,
        s.total_amount,
        s.created_at,
        COALESCE(buyer_user.full_name,'Walk-in customer') AS customer_name
       FROM sales s
       LEFT JOIN buyers b
         ON b.id=s.buyer_id
       LEFT JOIN users buyer_user
         ON buyer_user.id=b.user_id
       WHERE s.merchant_id=$1
       ORDER BY s.created_at DESC
       LIMIT 8`,
      [merchantId]
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
         ON mt.id=p.mpesa_transaction_id
       WHERE p.merchant_id=$1
       ORDER BY COALESCE(p.paid_at,p.created_at) DESC
       LIMIT 8`,
      [merchantId]
    ),

    db.query(
      `SELECT
        id,
        sale_id,
        invoice_number,
        invoice_type,
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
       WHERE merchant_id=$1
       ORDER BY created_at DESC
       LIMIT 8`,
      [merchantId]
    ),

    db.query(
      `SELECT
        id,
        branch_name,
        branch_code AS branch_id,
        address,
        status,
        created_at
       FROM merchant_branches
       WHERE merchant_id=$1
       ORDER BY branch_code`,
      [merchantId]
    ),

    db.query(
      `SELECT
        (SELECT status
         FROM kra_connections
         WHERE merchant_id=$1
         LIMIT 1) AS kra_status,

        (SELECT last_verified_at
         FROM kra_connections
         WHERE merchant_id=$1
         LIMIT 1) AS kra_last_verified,

        (SELECT json_agg(x)
         FROM (
           SELECT
             connection_type,
             business_shortcode,
             status,
             callback_registration_status
           FROM mpesa_connections
           WHERE merchant_id=$1
           ORDER BY connection_type
         ) x) AS mpesa`,
      [merchantId]
    )
  ]);

  s.json({
    merchant: {
      id: merchant.id,
      trading_name: merchant.trading_name,
      kra_pin: merchant.kra_pin
    },

    stats: {
      items: Number(stats.rows[0].items || 0),
      orders: Number(stats.rows[0].orders || 0),
      today_sales: Number(stats.rows[0].today_sales || 0),
      matched_payments: Number(stats.rows[0].matched_payments || 0),
      unmatched_payments: Number(stats.rows[0].unmatched_payments || 0),
      invoices: Number(stats.rows[0].invoices || 0),
      fiscalized_invoices: Number(stats.rows[0].fiscalized_invoices || 0)
    },

    today: {
      count: Number(todaySales.rows[0].count || 0),
      total: Number(todaySales.rows[0].total || 0)
    },

    orders: recentSales.rows,
    payments: recentPayments.rows,
    invoices: recentInvoices.rows,
    branches: branches.rows,

    connections: {
      kra_status: connections.rows[0]?.kra_status || null,
      kra_last_verified: connections.rows[0]?.kra_last_verified || null,
      mpesa: connections.rows[0]?.mpesa || []
    }
  });
}));

module.exports = r;
