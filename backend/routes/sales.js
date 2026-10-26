
const r = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

r.use(auth);

const merchantForUser = async userId => {
    const result = await db.query(
        `SELECT m.id
         FROM merchants m
         JOIN merchant_users mu ON mu.merchant_id = m.id
         WHERE mu.user_id = $1
           AND mu.status = 'ACTIVE'
         LIMIT 1`,
        [userId]
    );

    if (!result.rows[0]) {
        throw fail('Merchant account not found', 404);
    }

    return result.rows[0].id;
};

/*
|--------------------------------------------------------------------------
| List merchant sales
|--------------------------------------------------------------------------
*/
r.get('/sales', wrap(async (q, s) => {
    const merchantId = await merchantForUser(q.user.sub);

    const result = await db.query(
        `SELECT
            s.*,
            COALESCE(u.full_name, 'Walk-in customer') AS customer_name
         FROM sales s
         LEFT JOIN buyers b ON b.id = s.buyer_id
         LEFT JOIN users u ON u.id = b.user_id
         WHERE s.merchant_id = $1
         ORDER BY s.created_at DESC`,
        [merchantId]
    );

    s.json({
        sales: result.rows
    });
}));

/*
|--------------------------------------------------------------------------
| Get a sale and its related records
|--------------------------------------------------------------------------
*/
r.get('/sales/:id', wrap(async (q, s) => {
    const merchantId = await merchantForUser(q.user.sub);

    const saleResult = await db.query(
        `SELECT *
         FROM sales
         WHERE id = $1
           AND merchant_id = $2`,
        [q.params.id, merchantId]
    );

    const sale = saleResult.rows[0];

    if (!sale) {
        throw fail('Order not found', 404);
    }

    const [items, payments, invoices] = await Promise.all([
        db.query(
            `SELECT *
             FROM sale_items
             WHERE sale_id = $1
             ORDER BY line_number`,
            [sale.id]
        ),

        db.query(
            `SELECT *
             FROM payments
             WHERE sale_id = $1
             ORDER BY created_at DESC`,
            [sale.id]
        ),

        db.query(
            `SELECT *
             FROM invoices
             WHERE sale_id = $1
             ORDER BY created_at DESC`,
            [sale.id]
        )
    ]);

    s.json({
        sale,
        items: items.rows,
        payments: payments.rows,
        invoices: invoices.rows
    });
}));

/*
|--------------------------------------------------------------------------
| Create a merchant sale
|--------------------------------------------------------------------------
*/
r.post('/sales', wrap(async (q, s) => {
    const merchantId = await merchantForUser(q.user.sub);
    const body = q.body || {};
    const lines = Array.isArray(body.items) ? body.items : [];

    if (!lines.length) {
        throw fail('At least one item is required', 400);
    }

    const reference = String(
        body.order_reference ||
        body.orderReference ||
        `ORD-${Date.now()}`
    ).trim();

    if (!reference) {
        throw fail('Order reference is required', 400);
    }

    const currency = String(body.currency || 'KES').trim().toUpperCase();

    if (currency !== 'KES') {
        throw fail('Only KES is currently supported', 400);
    }

    const sale = await db.tx(async c => {
        let subtotal = 0;
        let tax = 0;
        const prepared = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] || {};
            const itemId = line.item_id || line.itemId;
            const quantity = Number(line.quantity);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw fail(`Invalid quantity for item ${i + 1}`, 400);
            }

            if (!itemId) {
                throw fail(`Item ${i + 1} is required`, 400);
            }

            const itemResult = await c.query(
                `SELECT *
                 FROM items
                 WHERE id = $1
                   AND merchant_id = $2
                   AND status = 'ACTIVE'`,
                [itemId, merchantId]
            );

            const item = itemResult.rows[0];

            if (!item) {
                throw fail(
                    `Item ${i + 1} not found or inactive`,
                    400
                );
            }

            const price = Number(item.unit_price);
            const rate = Number(item.tax_rate || 0);

            if (
                !Number.isFinite(price) ||
                price < 0 ||
                !Number.isFinite(rate) ||
                rate < 0
            ) {
                throw fail(
                    `Invalid price or tax configuration for ${item.name}`,
                    400
                );
            }

            const lineSubtotal = Number(
                (quantity * price).toFixed(2)
            );

            const lineTax = Number(
                (lineSubtotal * rate / 100).toFixed(2)
            );

            subtotal += lineSubtotal;
            tax += lineTax;

            prepared.push({
                item,
                quantity,
                lineSubtotal,
                lineTax
            });
        }

        subtotal = Number(subtotal.toFixed(2));
        tax = Number(tax.toFixed(2));

        const exactTotal = Number((subtotal + tax).toFixed(2));
        const total = Math.round(exactTotal);
        tax = Number((tax + (total - exactTotal)).toFixed(2));

        const saleResult = await c.query(
            `INSERT INTO sales (
                merchant_id,
                buyer_id,
                order_reference,
                status,
                currency,
                subtotal,
                tax_amount,
                total_amount,
                notes
            )
            VALUES (
                $1, $2, $3, 'AWAITING_PAYMENT',
                $4, $5, $6, $7, $8
            )
            RETURNING *`,
            [
                merchantId,
                body.buyer_id || body.buyerId || null,
                reference,
                currency,
                subtotal,
                tax,
                total,
                body.notes || null
            ]
        );

        const createdSale = saleResult.rows[0];

        for (let i = 0; i < prepared.length; i++) {
            const line = prepared[i];
            const item = line.item;
            const lineTotal = Number(
                (line.lineSubtotal + line.lineTax).toFixed(2)
            );

            await c.query(
                `INSERT INTO sale_items (
                    sale_id,
                    item_id,
                    line_number,
                    sku,
                    item_name,
                    quantity,
                    unit_code,
                    unit_price,
                    tax_type_code,
                    tax_rate,
                    tax_amount,
                    line_subtotal,
                    line_total,
                    currency
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13, $14
                )`,
                [
                    createdSale.id,
                    item.id,
                    i + 1,
                    item.sku,
                    item.name,
                    line.quantity,
                    item.unit_code,
                    item.unit_price,
                    item.tax_type_code,
                    item.tax_rate,
                    line.lineTax,
                    line.lineSubtotal,
                    lineTotal,
                    currency
                ]
            );
        }

        return createdSale;
    });

    s.status(201).json({
        sale,
        payment_reference: sale.order_reference
    });
}));

/*
|--------------------------------------------------------------------------
| Cancel an unpaid sale
|--------------------------------------------------------------------------
*/
r.post('/sales/:id/cancel', wrap(async (q, s) => {
    const merchantId = await merchantForUser(q.user.sub);

    const result = await db.query(
        `UPDATE sales
         SET status = 'CANCELLED',
             cancelled_at = now(),
             updated_at = now()
         WHERE id = $1
           AND merchant_id = $2
           AND status = 'AWAITING_PAYMENT'
         RETURNING *`,
        [q.params.id, merchantId]
    );

    if (!result.rows[0]) {
        throw fail('Order cannot be cancelled', 400);
    }

    s.json({
        sale: result.rows[0]
    });
}));

module.exports = r;