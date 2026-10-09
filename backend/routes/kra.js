const r = require('express').Router();
const db = require('../db');
const kra = require('../services/kraService');
const oscu = require('../services/oscuService');
const auth = require('../middleware/auth');
const wrap = require('../middleware/wrap');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

const check = async pinValue => {
    const pin = String(pinValue || '').trim().toUpperCase();

    if (!/^[AP]\d{9}[A-Z]$/.test(pin)) {
        throw fail('Invalid PIN format', 400);
    }

    const result = await kra.validatePin(pin);

    await db.query(
        `INSERT INTO kra_pin_verifications (
            subject_type,
            kra_pin,
            result_code,
            result_message,
            taxpayer_name,
            taxpayer_type,
            pin_status,
            raw_response
         )
         VALUES (
            'PRE_REGISTRATION', $1, $2, $3, $4, $5, $6, $7
         )`,
        [
            pin,
            result.code,
            result.message,
            result.name || null,
            result.type || null,
            result.status || null,
            result.raw
        ]
    );

    return result;
};

r.post('/kra/validate-pin', wrap(async (q, s) => {
    const result = await check(q.body?.pin);

    if (result.unavailable) {
        return s.json({
            pin: q.body?.pin,
            verified: false,
            status: 'UNAVAILABLE',
            code: result.code,
            message: result.message
        });
    }

    if (!result.valid) {
        throw fail('This KRA PIN is not valid', 400);
    }

    return s.json({
        pin: result.pin,
        name: result.name,
        type: result.type,
        status: result.status,
        verified: true
    });
}));

r.post('/kra/connect', wrap(async (q, s) => {
    const pin = String(q.body?.pin || '').trim().toUpperCase();

    if (!/^[AP]\d{9}[A-Z]$/.test(pin)) {
        throw fail('Invalid PIN format', 400);
    }

    const pinCheck = await check(pin);

    const sandboxUnavailable =
        pinCheck.unavailable &&
        pinCheck.code === '19005' &&
        String(process.env.KRA_ENV || '').toUpperCase() === 'SANDBOX';

    if (!pinCheck.valid && !sandboxUnavailable) {
        throw fail('This KRA PIN is not valid', 400);
    }

    const connection = await oscu.check(pin);

    s.json({
        pin,
        name: pinCheck.name || null,
        type: pinCheck.type || null,
        status: pinCheck.status || 'UNVERIFIED',
        pinChecker: {
            verified: !!pinCheck.valid,
            status: pinCheck.unavailable ? 'UNAVAILABLE' : 'VERIFIED',
            code: pinCheck.code || null,
            message: pinCheck.message || null
        },
        oscu: connection
    });
}));

/*
- Fiscalization is a merchant-only operation.
- The authenticated merchant must own the sale.
 */
r.post('/kra/fiscalize/:saleId', auth, wrap(async (q, s) => {
    const saleResult = await db.query(
        `SELECT
            s.*,
            m.kra_pin,
            m.trading_name
         FROM sales s
         JOIN merchants m ON m.id = s.merchant_id
         JOIN merchant_users mu ON mu.merchant_id = m.id
         WHERE s.id = $1
           AND mu.user_id = $2
           AND mu.status = 'ACTIVE'
         LIMIT 1`,
        [q.params.saleId, q.user.sub]
    );

    const sale = saleResult.rows[0];

    if (!sale) {
        throw fail('Sale not found or access denied', 404);
    }

    if (!['PAID', 'FISCALIZATION_PENDING', 'CLOSED'].includes(sale.status)) {
        throw fail('Sale must have a matched payment before fiscalization', 400);
    }

    const paymentResult = await db.query(
        `SELECT id
         FROM payments
         WHERE sale_id = $1
           AND merchant_id = $2
           AND status = 'MATCHED'
         LIMIT 1`,
        [sale.id, sale.merchant_id]
    );

    if (!paymentResult.rows.length) {
        throw fail('No matched payment exists for this sale', 400);
    }

    let invoice = (
        await db.query(
            `SELECT *
             FROM invoices
             WHERE sale_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [sale.id]
        )
    ).rows[0] || null;

    if (invoice?.fiscalization_status === 'FISCALIZED') {
        return s.json({ invoice });
    }

    const branch = process.env.KRA_BRANCH_ID || '00';
    const serial = process.env.KRA_DEVICE_SERIAL || null;
    const cmcKey = process.env.KRA_CMC_KEY;

    if (!sale.kra_pin || !cmcKey) {
        throw fail('KRA OSCU credentials are not configured', 500);
    }

    const itemResult = await db.query(
        `SELECT
            si.*,
            i.id AS catalogue_item_id,
            im.item_class_code
         FROM sale_items si
         LEFT JOIN items i ON i.id = si.item_id
         LEFT JOIN item_kra_mappings im ON im.item_id = i.id
         WHERE si.sale_id = $1
         ORDER BY si.line_number`,
        [sale.id]
    );

    const items = itemResult.rows;

    if (!items.length) {
        throw fail('Sale has no items', 400);
    }

    for (const item of items) {
        if (!item.item_class_code) {
            throw fail(
                `Item ${item.item_name || item.sku || item.item_id} has no KRA item classification mapping`,
                400
            );
        }

        if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
            throw fail('Sale contains an invalid item quantity', 400);
        }
    }

    if (!invoice) {
        const sequenceResult = await db.query(
            `INSERT INTO invoice_sequences (
                merchant_id,
                branch_id,
                next_number
             )
             VALUES ($1, NULL, 2)
             ON CONFLICT (merchant_id, branch_id)
             DO UPDATE SET
                next_number = invoice_sequences.next_number + 1,
                updated_at = now()
             RETURNING next_number - 1 AS invoice_number`,
            [sale.merchant_id]
        );

        const sequence = sequenceResult.rows[0];

        invoice = (
            await db.query(
                `INSERT INTO invoices (
                    merchant_id,
                    sale_id,
                    invoice_number,
                    seller_pin,
                    seller_name,
                    currency,
                    subtotal,
                    tax_amount,
                    total_amount,
                    fiscalization_status,
                    cu_serial_number
                 )
                 VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    'PROCESSING', $10
                 )
                 RETURNING *`,
                [
                    sale.merchant_id,
                    sale.id,
                    `INV-${sequence.invoice_number}`,
                    sale.kra_pin,
                    sale.trading_name,
                    sale.currency || 'KES',
                    sale.subtotal,
                    sale.tax_amount,
                    sale.total_amount,
                    serial
                ]
            )
        ).rows[0];
    } else {
        invoice = (
            await db.query(
                `UPDATE invoices
                 SET fiscalization_status = 'PROCESSING',
                     updated_at = now()
                 WHERE id = $1
                 RETURNING *`,
                [invoice.id]
            )
        ).rows[0];
    }

    const now = new Date();
    const confirmationDate = now.toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);

    const categoryTotals = {
        A: { taxable: 0, tax: 0 },
        B: { taxable: 0, tax: 0 },
        C: { taxable: 0, tax: 0 },
        D: { taxable: 0, tax: 0 },
        E: { taxable: 0, tax: 0 }
    };

    for (const item of items) {
        const category = String(item.tax_type_code || '').toUpperCase();

        if (categoryTotals[category]) {
            categoryTotals[category].taxable += Number(item.line_subtotal || 0);
            categoryTotals[category].tax += Number(item.tax_amount || 0);
        }
    }

    const payload = {
        tin: sale.kra_pin,
        bhfId: branch,
        trdInvcNo: invoice.invoice_number,
        invcNo: Number(String(invoice.invoice_number).replace(/\D/g, '')) || 1,
        orgInvcNo: 0,
        custTin: null,
        custNm: null,
        rcptTyCd: 'S',
        pmtTyCd: '06',
        salesSttsCd: '02',
        cfmDt: confirmationDate,
        salesDt: confirmationDate.slice(0, 8),
        stockRlsDt: null,
        cnclReqDt: null,
        cnclDt: null,
        rfdDt: null,
        rfdRsnCd: null,
        totItemCnt: items.length,
        taxblAmtA: Number(categoryTotals.A.taxable.toFixed(2)),
        taxblAmtB: Number(categoryTotals.B.taxable.toFixed(2)),
        taxblAmtC: Number(categoryTotals.C.taxable.toFixed(2)),
        taxblAmtD: Number(categoryTotals.D.taxable.toFixed(2)),
        taxblAmtE: Number(categoryTotals.E.taxable.toFixed(2)),
        taxAmtA: Number(categoryTotals.A.tax.toFixed(2)),
        taxAmtB: Number(categoryTotals.B.tax.toFixed(2)),
        taxAmtC: Number(categoryTotals.C.tax.toFixed(2)),
        taxAmtD: Number(categoryTotals.D.tax.toFixed(2)),
        taxAmtE: Number(categoryTotals.E.tax.toFixed(2)),
        totTaxblAmt: Number(sale.subtotal),
        totTaxAmt: Number(sale.tax_amount),
        totAmt: Number(sale.total_amount),
        cashDcRt: 0,
        cashDcAmt: 0,
        remark: null,
        itemList: items.map((item, index) => ({
            itemSeq: index + 1,
            itemCd: item.sku || `ITEM-${item.item_id}`,
            itemClsCd: item.item_class_code,
            itemNm: item.item_name || item.sku || 'Item',
            bcd: '',
            pkgUnitCd: 'NT',
            pkg: 1,
            qtyUnitCd: item.unit_code || 'U',
            qty: Number(item.quantity),
            prc: Number(item.unit_price),
            splyAmt: Number(item.line_subtotal),
            dcRt: 0,
            dcAmt: 0,
            taxTyCd: item.tax_type_code || 'B',
            taxblAmt: Number(item.line_subtotal),
            taxAmt: Number(item.tax_amount),
            totAmt: Number(item.line_total)
        }))
    };

    const attemptResult = await db.query(
        `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS n
         FROM fiscalization_attempts
         WHERE invoice_id = $1`,
        [invoice.id]
    );

    const attempt = Number(attemptResult.rows[0].n);

    await db.query(
        `INSERT INTO fiscalization_attempts (
            invoice_id,
            attempt_number,
            status,
            request_reference,
            request_payload
         )
         VALUES ($1, $2, 'STARTED', $3, $4)`,
        [invoice.id, attempt, invoice.invoice_number, payload]
    );

    try {
        const baseUrl = (
            process.env.OSCU_BASE_URL ||
            'https://etims-api-sbx.kra.go.ke/etims-api'
        ).replace(/\/+$/, '');

        const response = await fetch(
            `${baseUrl}/saveTrnsSalesOsdc`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    tin: sale.kra_pin,
                    bhfId: branch,
                    cmcKey
                },
                body: JSON.stringify(payload)
            }
        );

        const body = await response.json().catch(() => ({}));
        const success = response.ok && body.resultCd === '000';

        await db.query(
            `UPDATE fiscalization_attempts
             SET status = $1,
                 response_payload = $2,
                 http_status = $3,
                 kra_result_code = $4,
                 kra_result_message = $5,
                 completed_at = now()
             WHERE invoice_id = $6
               AND attempt_number = $7`,
            [
                success ? 'SUCCESS' : 'FAILED',
                body,
                response.status,
                body.resultCd || null,
                body.resultMsg || null,
                invoice.id,
                attempt
            ]
        );

        if (!success) {
            await db.query(
                `UPDATE invoices
                 SET fiscalization_status = 'FAILED',
                     updated_at = now()
                 WHERE id = $1`,
                [invoice.id]
            );

            throw fail(body.resultMsg || 'KRA fiscalization failed', 502);
        }

        const data = body.data || {};

        const finalResult = await db.query(
            `UPDATE invoices
             SET fiscalization_status = 'FISCALIZED',
                 kra_receipt_number = $1,
                 kra_invoice_number = $2,
                 kra_internal_data = $3,
                 receipt_signature = $4,
                 sdc_date_time = $5,
                 fiscalized_at = now(),
                 updated_at = now()
             WHERE id = $6
             RETURNING *`,
            [
                data.curRcptNo == null ? null : String(data.curRcptNo),
                data.totRcptNo == null ? null : String(data.totRcptNo),
                data.intrlData || null,
                data.rcptSign || null,
                data.sdcDateTime || null,
                invoice.id
            ]
        );

        return s.json({
            invoice: finalResult.rows[0],
            kra: body
        });
    } catch (error) {
        if (error.status) {
            throw error;
        }

        await db.query(
            `UPDATE fiscalization_attempts
             SET status = 'TIMEOUT',
                 error_message = $1,
                 completed_at = now()
             WHERE invoice_id = $2
               AND attempt_number = $3`,
            [error.message, invoice.id, attempt]
        );

        await db.query(
            `UPDATE invoices
             SET fiscalization_status = 'FAILED',
                 updated_at = now()
             WHERE id = $1`,
            [invoice.id]
        );

        throw fail('Could not complete the KRA eTIMS request', 502);
    }
}));

module.exports = r;
