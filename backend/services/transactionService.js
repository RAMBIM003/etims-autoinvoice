const db = require('../db');

const money = value =>
    Math.round(Number(value || 0) * 100) / 100;

async function processMatchedPayment(paymentId) {
    return db.tx(async c => {
        const result = await c.query(
            `SELECT
                p.*,
                s.order_reference,
                s.buyer_id,
                s.subtotal,
                s.tax_amount,
                s.total_amount,
                s.currency,
                s.status AS sale_status,
                m.trading_name,
                m.kra_pin,
                kc.status AS kra_status,
                kc.branch_id
             FROM payments p
             JOIN sales s ON s.id = p.sale_id
             JOIN merchants m ON m.id = p.merchant_id
             LEFT JOIN kra_connections kc
                ON kc.merchant_id = p.merchant_id
             WHERE p.id = $1
             FOR UPDATE OF p, s`,
            [paymentId]
        );

        const payment = result.rows[0];

        if (!payment) {
            throw Object.assign(new Error('Payment not found'), {
                status: 404
            });
        }

        if (payment.status !== 'MATCHED') {
            return payment;
        }

        const existingResult = await c.query(
            `SELECT *
             FROM invoices
             WHERE sale_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [payment.sale_id]
        );

        const existing = existingResult.rows[0];

        if (existing) {
            if (
                existing.fiscalization_status !== 'FISCALIZED' &&
                payment.sale_status !== 'FISCALIZATION_PENDING'
            ) {
                await c.query(
                    `UPDATE sales
                     SET status = 'FISCALIZATION_PENDING',
                         updated_at = now()
                     WHERE id = $1
                       AND status <> 'CANCELLED'`,
                    [payment.sale_id]
                );
            }

            return existing;
        }

        const sequenceResult = await c.query(
            `SELECT id, next_number
             FROM invoice_sequences
             WHERE merchant_id = $1
               AND branch_id IS NOT DISTINCT FROM $2
             FOR UPDATE`,
            [payment.merchant_id, payment.branch_id || null]
        );

        const sequence = sequenceResult.rows[0];
        let nextNumber;

        if (sequence) {
            nextNumber = Number(sequence.next_number);

            await c.query(
                `UPDATE invoice_sequences
                 SET next_number = next_number + 1,
                     updated_at = now()
                 WHERE id = $1`,
                [sequence.id]
            );
        } else {
            nextNumber = 1;

            await c.query(
                `INSERT INTO invoice_sequences (
                    merchant_id,
                    branch_id,
                    next_number
                 )
                 VALUES ($1, $2, 2)`,
                [payment.merchant_id, payment.branch_id || null]
            );
        }

        const invoiceNumber =
            `INV-${new Date().getFullYear()}-${String(nextNumber).padStart(6, '0')}`;

        let buyer = null;

        if (payment.buyer_id) {
            const buyerResult = await c.query(
                `SELECT kra_pin, kra_taxpayer_name
                 FROM buyers
                 WHERE id = $1`,
                [payment.buyer_id]
            );

            buyer = buyerResult.rows[0] || null;
        }

        const invoiceResult = await c.query(
            `INSERT INTO invoices (
                merchant_id,
                sale_id,
                branch_id,
                invoice_number,
                seller_pin,
                seller_name,
                buyer_id,
                buyer_pin,
                buyer_name,
                currency,
                subtotal,
                tax_amount,
                total_amount,
                fiscalization_status
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, 'PENDING'
             )
             RETURNING *`,
            [
                payment.merchant_id,
                payment.sale_id,
                payment.branch_id || null,
                invoiceNumber,
                payment.kra_pin,
                payment.trading_name,
                payment.buyer_id || null,
                buyer?.kra_pin || null,
                buyer?.kra_taxpayer_name || null,
                payment.currency || 'KES',
                money(payment.subtotal),
                money(payment.tax_amount),
                money(payment.total_amount)
            ]
        );

        await c.query(
            `UPDATE sales
             SET status = 'FISCALIZATION_PENDING',
                 updated_at = now()
             WHERE id = $1
               AND status <> 'CANCELLED'`,
            [payment.sale_id]
        );

        return invoiceResult.rows[0];
    });
}

module.exports = { processMatchedPayment };
