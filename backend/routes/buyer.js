
const r = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const C = require('../services/cryptoService');
const otp = require('../services/otpService');
const kra = require('../services/kraService');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

/*
|--------------------------------------------------------------------------
| Buyer registration
|--------------------------------------------------------------------------
*/
r.post('/buyer/register', wrap(async (q, s) => {
    const b = q.body || {};
    const pin = String(b.pin || '').trim().toUpperCase();
    const email = String(b.email || '').trim().toLowerCase() || null;
    const password = String(b.password || '');

    if (
        !C.phoneOk(b.phone) ||
        b.consent !== true ||
        !/^[AP]\d{9}[A-Z]$/.test(pin) ||
        password.length < 8
    ) {
        throw fail('Invalid buyer registration details', 400);
    }

    let k = await kra.validatePin(pin);

    if (
        !k.valid &&
        k.unavailable &&
        String(process.env.KRA_ENV || '').toUpperCase() === 'SANDBOX'
    ) {
        k = {
            valid: true,
            status: 'Active',
            name: String((typeof b !== 'undefined' && b && b.name) || 'Sandbox Buyer').trim(),
            type: 'UNVERIFIED'
        };
    }

    if (!k.valid || k.status !== 'Active') {
        throw fail('The KRA PIN is not valid and active', 400);
    }

    const userId = await db.tx(async c => {
        await otp.consume(c, b.phone, 'SIGNUP_BUYER');

        const phoneHash = C.phoneHash(b.phone);
        const encryptedPhone = C.enc(C.norm(b.phone));
        const passwordHash = await bcrypt.hash(password, 10);

        const user = (
            await c.query(
                `INSERT INTO users (
                    email,
                    full_name,
                    password_hash,
                    phone_hash,
                    phone_encrypted
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id`,
                [
                    email,
                    k.name,
                    passwordHash,
                    phoneHash,
                    encryptedPhone
                ]
            )
        ).rows[0];

        const buyer = (
            await c.query(
                `INSERT INTO buyers (
                    user_id,
                    kra_pin,
                    kra_taxpayer_name,
                    kra_taxpayer_type,
                    kra_pin_status,
                    consent_at
                )
                VALUES ($1, $2, $3, $4, $5, now())
                RETURNING id`,
                [user.id, pin, k.name, k.type, k.status]
            )
        ).rows[0];

        await c.query(
            `INSERT INTO buyer_phones (
                buyer_id,
                phone_hash,
                phone_encrypted,
                verified_at
            )
            VALUES ($1, $2, $3, now())`,
            [buyer.id, phoneHash, encryptedPhone]
        );

        return user.id;
    });

    s.status(201).json({
        token: auth.sign(userId)
    });
}));

/*
|--------------------------------------------------------------------------
| Public merchant catalogue
|--------------------------------------------------------------------------
*/
r.get('/buyer/merchants', wrap(async (q, s) => {
    const result = await db.query(
        `SELECT
            m.id,
            m.trading_name,
            m.kra_pin,
            mc.connection_type,
            mc.business_shortcode
         FROM merchants m
         LEFT JOIN mpesa_connections mc
            ON mc.merchant_id = m.id
           AND mc.status = 'ACTIVE'
         WHERE m.status = 'ACTIVE'
         ORDER BY m.trading_name`
    );

    s.json({
        merchants: result.rows
    });
}));

r.get('/buyer/merchants/:id/items', wrap(async (q, s) => {
    const result = await db.query(
        `SELECT
            id,
            sku,
            name,
            description,
            unit_code,
            unit_price,
            currency,
            tax_type_code,
            tax_rate
         FROM items
         WHERE merchant_id = $1
           AND status = 'ACTIVE'
         ORDER BY name`,
        [q.params.id]
    );

    s.json({
        items: result.rows
    });
}));

/*
|--------------------------------------------------------------------------
| Authenticated buyer routes
|--------------------------------------------------------------------------
*/
r.use(auth);

const buyerForUser = async userId => {
    const result = await db.query(
        `SELECT *
         FROM buyers
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
    );

    const buyer = result.rows[0];

    if (!buyer) {
        throw fail('Buyer account not found', 404);
    }

    return buyer;
};

/*
|--------------------------------------------------------------------------
| Create buyer order
|--------------------------------------------------------------------------
*/
r.post('/buyer/orders', wrap(async (q, s) => {
    const buyer = await buyerForUser(q.user.sub);
    const body = q.body || {};
    const lines = Array.isArray(body.items) ? body.items : [];
    const merchantId = body.merchant_id;

    if (!merchantId || !lines.length) {
        throw fail('Merchant and items are required', 400);
    }

    const sale = await db.tx(async c => {
        let subtotal = 0;
        let tax = 0;
        const prepared = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] || {};
            const quantity = Number(line.quantity);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw fail(`Invalid quantity for item ${i + 1}`, 400);
            }

            const itemResult = await c.query(
                `SELECT *
                 FROM items
                 WHERE id = $1
                   AND merchant_id = $2
                   AND status = 'ACTIVE'`,
                [line.item_id, merchantId]
            );

            const item = itemResult.rows[0];

            if (!item) {
                throw fail(`Item ${i + 1} not found or inactive`, 400);
            }

            const unitPrice = Number(item.unit_price);
            const taxRate = Number(item.tax_rate || 0);

            if (
                !Number.isFinite(unitPrice) ||
                unitPrice < 0 ||
                !Number.isFinite(taxRate) ||
                taxRate < 0
            ) {
                throw fail(`Invalid price or tax configuration for ${item.name}`, 400);
            }

            const lineSubtotal = Number(
                (quantity * unitPrice).toFixed(2)
            );

            const lineTax = Number(
                (lineSubtotal * taxRate / 100).toFixed(2)
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

        const total = Number((subtotal + tax).toFixed(2));
        const reference = `ORD-${Date.now()}`;

        const saleResult = await c.query(
            `INSERT INTO sales (
                merchant_id,
                buyer_id,
                order_reference,
                status,
                currency,
                subtotal,
                tax_amount,
                total_amount
            )
            VALUES ($1, $2, $3, 'AWAITING_PAYMENT', 'KES', $4, $5, $6)
            RETURNING *`,
            [
                merchantId,
                buyer.id,
                reference,
                subtotal,
                tax,
                total
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
                    $8, $9, $10, $11, $12, $13, 'KES'
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
                    lineTotal
                ]
            );
        }

        return createdSale;
    });

    const mpesaResult = await db.query(
        `SELECT business_shortcode, connection_type
         FROM mpesa_connections
         WHERE merchant_id = $1
           AND status = 'ACTIVE'
         LIMIT 1`,
        [merchantId]
    );

    const mpesa = mpesaResult.rows[0] || null;

    s.status(201).json({
        order: sale,
        payment: {
            shortcode: mpesa ? mpesa.business_shortcode : null,
            type: mpesa ? mpesa.connection_type : null,
            reference: sale.order_reference,
            amount: Number(sale.total_amount)
        }
    });
}));

/*
|--------------------------------------------------------------------------
| Buyer's order history
|--------------------------------------------------------------------------
*/
r.get('/buyer/orders', wrap(async (q, s) => {
    const buyer = await buyerForUser(q.user.sub);

    const result = await db.query(
        `SELECT
            s.*,
            m.trading_name
         FROM sales s
         JOIN merchants m ON m.id = s.merchant_id
         WHERE s.buyer_id = $1
         ORDER BY s.created_at DESC`,
        [buyer.id]
    );

    s.json({
        orders: result.rows
    });
}));

/*
|--------------------------------------------------------------------------
| Buyer order details, payments and invoices
|--------------------------------------------------------------------------
*/
r.get('/buyer/orders/:id', wrap(async (q, s) => {
    const buyer = await buyerForUser(q.user.sub);

    const saleResult = await db.query(
        `SELECT
            s.*,
            m.trading_name
         FROM sales s
         JOIN merchants m ON m.id = s.merchant_id
         WHERE s.id = $1
           AND s.buyer_id = $2`,
        [q.params.id, buyer.id]
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
            `SELECT
                p.*,
                mt.trans_id
             FROM payments p
             LEFT JOIN mpesa_transactions mt
                ON mt.id = p.mpesa_transaction_id
             WHERE p.sale_id = $1
             ORDER BY p.created_at DESC`,
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
        order: sale,
        items: items.rows,
        payments: payments.rows,
        invoices: invoices.rows
    });
}));

module.exports = r;