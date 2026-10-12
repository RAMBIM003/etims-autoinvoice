const crypto = require('crypto');
const db = require('../db');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

const secret = () => process.env.HMAC_KEY || 'dev-only-receipt-secret';

// The link token is derived from the invoice id with a server secret, so it
// cannot be guessed but can always be regenerated. Only its hash is stored.
const tokenFor = invoiceId =>
    crypto
        .createHmac('sha256', secret())
        .update(`receipt:${invoiceId}`)
        .digest('base64url');

const hashToken = token =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

const frontendUrl = () =>
    (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

const linkFor = token => `${frontendUrl()}/receipt?t=${token}`;

async function ensureReceipt(invoiceId) {
    const invoice = (
        await db.query(
            `SELECT id, merchant_id, sale_id, fiscalization_status
             FROM invoices
             WHERE id = $1`,
            [invoiceId]
        )
    ).rows[0];

    if (!invoice) {
        throw fail('Invoice not found', 404);
    }

    if (invoice.fiscalization_status !== 'FISCALIZED') {
        throw fail('Receipts are only available for fiscalized invoices', 409);
    }

    const token = tokenFor(invoice.id);

    await db.query(
        `INSERT INTO receipts (
            merchant_id, invoice_id, sale_id, receipt_token_hash
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (invoice_id) DO UPDATE
            SET receipt_token_hash = EXCLUDED.receipt_token_hash,
                updated_at = now()
            WHERE receipts.status = 'ACTIVE'`,
        [invoice.merchant_id, invoice.id, invoice.sale_id, hashToken(token)]
    );

    return { token, url: linkFor(token) };
}

async function getPublicReceipt(token) {
    const receipt = (
        await db.query(
            `SELECT *
             FROM receipts
             WHERE receipt_token_hash = $1
               AND status = 'ACTIVE'
               AND (expires_at IS NULL OR expires_at > now())`,
            [hashToken(token)]
        )
    ).rows[0];

    if (!receipt) {
        throw fail('Receipt not found', 404);
    }

    const invoice = (
        await db.query(
            `SELECT i.*, m.trading_name
             FROM invoices i
             JOIN merchants m ON m.id = i.merchant_id
             WHERE i.id = $1`,
            [receipt.invoice_id]
        )
    ).rows[0];

    if (!invoice || invoice.fiscalization_status !== 'FISCALIZED') {
        throw fail('Receipt not found', 404);
    }

    const sale = (
        await db.query(
            `SELECT order_reference, currency FROM sales WHERE id = $1`,
            [invoice.sale_id]
        )
    ).rows[0] || {};

    const items = (
        await db.query(
            `SELECT item_name, sku, quantity, unit_code, unit_price,
                    tax_rate, tax_amount, line_subtotal, line_total
             FROM sale_items
             WHERE sale_id = $1
             ORDER BY line_number`,
            [invoice.sale_id]
        )
    ).rows;

    const payment = (
        await db.query(
            `SELECT p.payment_method, p.amount, p.paid_at, mt.trans_id
             FROM payments p
             LEFT JOIN mpesa_transactions mt
                ON mt.id = p.mpesa_transaction_id
             WHERE p.sale_id = $1
               AND p.status = 'MATCHED'
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [invoice.sale_id]
        )
    ).rows[0] || null;

    return {
        merchant: {
            name: invoice.seller_name || invoice.trading_name,
            pin: invoice.seller_pin
        },
        buyer: {
            name: invoice.buyer_name || null,
            pin: invoice.buyer_pin || null
        },
        invoice: {
            number: invoice.invoice_number,
            order_reference: sale.order_reference || null,
            currency: invoice.currency,
            subtotal: invoice.subtotal,
            tax_amount: invoice.tax_amount,
            total_amount: invoice.total_amount,
            kra_receipt_number: invoice.kra_receipt_number,
            kra_invoice_number: invoice.kra_invoice_number,
            cu_serial_number: invoice.cu_serial_number,
            receipt_signature: invoice.receipt_signature,
            kra_internal_data: invoice.kra_internal_data,
            sdc_date_time: invoice.sdc_date_time,
            fiscalized_at: invoice.fiscalized_at
        },
        items,
        payment
    };
}

module.exports = { ensureReceipt, getPublicReceipt, tokenFor, hashToken };
