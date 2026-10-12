const db = require('../db');
const receipts = require('./receiptService');
const sms = require('./smsService');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

const num = value => Number(value || 0);
const money = value => Number(num(value).toFixed(2));

const baseUrl = () =>
    (process.env.OSCU_BASE_URL || 'https://etims-api-sbx.kra.go.ke/etims-api')
        .replace(/\/+$/, '');

// Africa/Nairobi is UTC+3 with no daylight saving.
const eatTimestamp = () =>
    new Date(Date.now() + 3 * 60 * 60 * 1000)
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);

// KRA tax types: A exempt, B 16%, C zero-rated, D non-VAT, E 8%.
const taxCode = item => {
    const given = String(item.tax_type_code || '').toUpperCase();

    if (['A', 'B', 'C', 'D', 'E'].includes(given)) {
        return given;
    }

    const rate = num(item.tax_rate);

    if (rate === 16) return 'B';
    if (rate === 8) return 'E';

    return 'A';
};

const qtyUnit = code => {
    const c = String(code || '').toUpperCase();
    return !c || c === 'PCS' ? 'U' : c;
};

// KRA item codes follow: origin(2) + type(1) + package(2) + quantity(2) + seq(7),
// e.g. KE1NTXU0000001. Generated deterministically from the item id.
const generatedItemCode = (itemId, index) => {
    const seed =
        String(itemId || '').replace(/[^0-9a-f]/gi, '').slice(0, 6) ||
        String(index + 1);

    const seq = String(parseInt(seed, 16) % 10000000).padStart(7, '0');

    return `KE2NTXU${seq}`;
};

async function kraPost(endpoint, headers, payload) {
    const response = await fetch(`${baseUrl()}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
    });

    return {
        status: response.status,
        body: await response.json().catch(() => ({}))
    };
}

// Best effort: KRA expects an item to be registered before it is sold.
// A failure here is logged but does not stop the sale attempt.
async function registerItems({ tin, branch, cmcKey, items }) {
    for (const item of items) {
        try {
            const { status, body } = await kraPost(
                '/saveItems',
                { tin, bhfId: branch, cmcKey },
                {
                    tin,
                    bhfId: branch,
                    itemCd: item.cd,
                    itemClsCd: item.cls,
                    itemTyCd: '2',
                    itemNm: item.item_name || item.sku || 'Item',
                    itemStdNm: null,
                    orgnNatCd: 'KE',
                    pkgUnitCd: 'NT',
                    qtyUnitCd: qtyUnit(item.unit_code),
                    taxTyCd: taxCode(item),
                    btchNo: null,
                    bcd: null,
                    dftPrc: num(item.unit_price),
                    grpPrcL1: null,
                    grpPrcL2: null,
                    grpPrcL3: null,
                    grpPrcL4: null,
                    grpPrcL5: null,
                    addInfo: null,
                    sftyQty: null,
                    isrcAplcbYn: 'N',
                    useYn: 'Y',
                    regrNm: 'MASTERCLASS',
                    regrId: 'MASTERCLASS',
                    modrNm: 'MASTERCLASS',
                    modrId: 'MASTERCLASS'
                }
            );

            console.log(
                `KRA saveItems ${item.cd}: HTTP ${status} ` +
                JSON.stringify(body).slice(0, 300)
            );
        } catch (error) {
            console.warn(`KRA saveItems failed for ${item.cd}:`, error.message);
        }
    }
}

// Uses item_kra_mappings when it exists and has data; never fails the sale
// if the table or column is missing.
async function loadClassCodes(itemIds) {
    const map = {};

    if (!itemIds.length) {
        return map;
    }

    try {
        const rows = (
            await db.query(
                `SELECT item_id, item_cls_code, item_code
                 FROM item_kra_mappings
                 WHERE item_id = ANY($1::uuid[])
                   AND active = true`,
                [itemIds]
            )
        ).rows;

        rows.forEach(row => {
            map[row.item_id] = {
                cls: row.item_cls_code || null,
                code: row.item_code || null
            };
        });
    } catch (error) {
        console.warn('item_kra_mappings lookup skipped:', error.message);
    }

    return map;
}

async function fiscalizeSale(saleId, merchantId = null) {
    const sale = (
        await db.query(
            `SELECT s.*, m.kra_pin, m.trading_name
             FROM sales s
             JOIN merchants m ON m.id = s.merchant_id
             WHERE s.id = $1
               AND ($2::uuid IS NULL OR s.merchant_id = $2::uuid)`,
            [saleId, merchantId]
        )
    ).rows[0];

    if (!sale) {
        throw fail('Sale not found or access denied', 404);
    }

    const invoice = (
        await db.query(
            `SELECT *
             FROM invoices
             WHERE sale_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [sale.id]
        )
    ).rows[0];

    if (invoice && invoice.fiscalization_status === 'FISCALIZED') {
        return { invoice, already: true };
    }

    if (!['PAID', 'FISCALIZATION_PENDING', 'CLOSED'].includes(sale.status)) {
        throw fail('Sale must have a matched payment before fiscalization', 400);
    }

    const payment = (
        await db.query(
            `SELECT id
             FROM payments
             WHERE sale_id = $1
               AND merchant_id = $2
               AND status = 'MATCHED'
             LIMIT 1`,
            [sale.id, sale.merchant_id]
        )
    ).rows[0];

    if (!payment) {
        throw fail('No matched payment exists for this sale', 400);
    }

    if (!invoice) {
        throw fail('No invoice has been generated for this sale yet', 409);
    }

    const tin = String(sale.kra_pin || '').toUpperCase();
    const branch = process.env.KRA_BRANCH_ID || '00';
    const cmcKey = process.env.KRA_CMC_KEY;
    const serial = process.env.KRA_DEVICE_SERIAL || null;

    if (!tin || !cmcKey) {
        throw fail('KRA OSCU credentials are not configured', 500);
    }

    if (
        process.env.KRA_PIN &&
        tin !== String(process.env.KRA_PIN).toUpperCase()
    ) {
        throw fail(
            'The POC OSCU device is set up for a different taxpayer than this merchant',
            400
        );
    }

    const items = (
        await db.query(
            `SELECT *
             FROM sale_items
             WHERE sale_id = $1
             ORDER BY line_number`,
            [sale.id]
        )
    ).rows;

    if (!items.length) {
        throw fail('Sale has no items', 400);
    }

    const mapped = await loadClassCodes(
        items.map(item => item.item_id).filter(Boolean)
    );

    const fallbackClass = process.env.KRA_DEFAULT_ITEM_CLS_CD || null;

    for (const [index, item] of items.entries()) {
        const mapping = mapped[item.item_id] || {};

        item.cls = mapping.cls || fallbackClass;
        item.cd = mapping.code || generatedItemCode(item.item_id, index);

        if (!item.cls) {
            throw fail(
                `No KRA item classification for "${item.item_name}". ` +
                'Map the item or set KRA_DEFAULT_ITEM_CLS_CD in .env',
                400
            );
        }

        if (!(num(item.quantity) > 0)) {
            throw fail('Sale contains an invalid item quantity', 400);
        }
    }

    // Atomic claim: only one submission can run per invoice.
    const claimed = (
        await db.query(
            `UPDATE invoices
             SET fiscalization_status = 'PROCESSING',
                 updated_at = now()
             WHERE id = $1
               AND fiscalization_status IN ('PENDING', 'FAILED')
             RETURNING *`,
            [invoice.id]
        )
    ).rows[0];

    if (!claimed) {
        throw fail('This invoice is already being fiscalized', 409);
    }

    await registerItems({ tin, branch, cmcKey, items });

    const totals = {
        A: { taxable: 0, tax: 0 },
        B: { taxable: 0, tax: 0 },
        C: { taxable: 0, tax: 0 },
        D: { taxable: 0, tax: 0 },
        E: { taxable: 0, tax: 0 }
    };

    const itemList = items.map((item, index) => {
        const code = taxCode(item);

        totals[code].taxable += num(item.line_subtotal);
        totals[code].tax += num(item.tax_amount);

        return {
            itemSeq: index + 1,
            itemCd: item.cd,
            itemClsCd: item.cls,
            itemNm: item.item_name || item.sku || 'Item',
            bcd: null,
            pkgUnitCd: 'NT',
            pkg: 1,
            qtyUnitCd: qtyUnit(item.unit_code),
            qty: num(item.quantity),
            prc: num(item.unit_price),
            splyAmt: money(item.line_subtotal),
            dcRt: 0,
            dcAmt: 0,
            isrccCd: null,
            isrccNm: null,
            isrcRt: null,
            isrcAmt: null,
            taxTyCd: code,
            taxblAmt: money(item.line_subtotal),
            taxAmt: money(item.tax_amount),
            totAmt: money(item.line_total)
        };
    });

    const ts = eatTimestamp();

    const payload = {
        tin,
        bhfId: branch,
        trdInvcNo: invoice.invoice_number,
        invcNo:
            (Number(process.env.KRA_INVOICE_NO_OFFSET) || 0) +
            (Number(String(invoice.invoice_number).split('-').pop()) || 1),
        orgInvcNo: 0,
        custTin: invoice.buyer_pin || null,
        custNm: invoice.buyer_name || null,
        salesTyCd: 'N',
        rcptTyCd: 'S',
        pmtTyCd: '06',
        salesSttsCd: '02',
        cfmDt: ts,
        salesDt: ts.slice(0, 8),
        stockRlsDt: null,
        cnclReqDt: null,
        cnclDt: null,
        rfdDt: null,
        rfdRsnCd: null,
        totItemCnt: itemList.length,
        taxblAmtA: money(totals.A.taxable),
        taxblAmtB: money(totals.B.taxable),
        taxblAmtC: money(totals.C.taxable),
        taxblAmtD: money(totals.D.taxable),
        taxblAmtE: money(totals.E.taxable),
        taxRtA: 0,
        taxRtB: 16,
        taxRtC: 0,
        taxRtD: 0,
        taxRtE: 8,
        taxAmtA: money(totals.A.tax),
        taxAmtB: money(totals.B.tax),
        taxAmtC: money(totals.C.tax),
        taxAmtD: money(totals.D.tax),
        taxAmtE: money(totals.E.tax),
        totTaxblAmt: money(sale.subtotal),
        totTaxAmt: money(sale.tax_amount),
        totAmt: money(sale.total_amount),
        prchrAcptcYn: 'N',
        receipt: {
            custTin: invoice.buyer_pin || null,
            custMblNo: null,
            rptNo: 1,
            trdeNm: String(sale.trading_name || '').slice(0, 20),
            adrs: null,
            topMsg: null,
            btmMsg: 'Thank you',
            rcptPbctDt: ts,
            prchrAcptcYn: 'N'
        },
        remark: null,
        regrId: 'MASTERCLASS',
        regrNm: 'MASTERCLASS',
        modrId: 'MASTERCLASS',
        modrNm: 'MASTERCLASS',
        itemList
    };

    const attempt = Number(
        (
            await db.query(
                `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS n
                 FROM fiscalization_attempts
                 WHERE invoice_id = $1`,
                [invoice.id]
            )
        ).rows[0].n
    );

    await db.query(
        `INSERT INTO fiscalization_attempts (
            invoice_id, attempt_number, status,
            request_reference, request_payload
         )
         VALUES ($1, $2, 'STARTED', $3, $4)`,
        [invoice.id, attempt, invoice.invoice_number, payload]
    );

    let response;
    let body;

    try {
        response = await fetch(`${baseUrl()}/saveTrnsSalesOsdc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                tin,
                bhfId: branch,
                cmcKey
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000)
        });

        body = await response.json().catch(() => ({}));
    } catch (error) {
        await db.query(
            `UPDATE fiscalization_attempts
             SET status = 'UNKNOWN',
                 error_message = $1,
                 completed_at = now()
             WHERE invoice_id = $2 AND attempt_number = $3`,
            [error.message, invoice.id, attempt]
        );

        await db.query(
            `UPDATE invoices
             SET fiscalization_status = 'FAILED', updated_at = now()
             WHERE id = $1`,
            [invoice.id]
        );

        throw fail('Could not reach KRA eTIMS', 502);
    }

    const success = response.ok && body.resultCd === '000';

    await db.query(
        `UPDATE fiscalization_attempts
         SET status = $1,
             response_payload = $2,
             http_status = $3,
             kra_result_code = $4,
             kra_result_message = $5,
             completed_at = now()
         WHERE invoice_id = $6 AND attempt_number = $7`,
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
             SET fiscalization_status = 'FAILED', updated_at = now()
             WHERE id = $1`,
            [invoice.id]
        );

        throw fail(
            `KRA ${body.resultCd || response.status}: ${body.resultMsg || 'request rejected'}`,
            502
        );
    }

    const data = body.data || {};

    const finalInvoice = (
        await db.query(
            `UPDATE invoices
             SET fiscalization_status = 'FISCALIZED',
                 kra_receipt_number = $1,
                 kra_invoice_number = $2,
                 kra_internal_data = $3,
                 receipt_signature = $4,
                 sdc_date_time = $5,
                 cu_serial_number = $6,
                 fiscalized_at = now(),
                 updated_at = now()
             WHERE id = $7
             RETURNING *`,
            [
                data.curRcptNo == null ? null : String(data.curRcptNo),
                data.totRcptNo == null ? null : String(data.totRcptNo),
                data.intrlData || null,
                data.rcptSign || null,
                data.vsdcRcptPbctDate || data.sdcDateTime || null,
                data.sdcId || serial,
                invoice.id
            ]
        )
    ).rows[0];

    await db.query(
        `UPDATE sales
         SET status = 'CLOSED', updated_at = now()
         WHERE id = $1 AND status <> 'CANCELLED'`,
        [sale.id]
    );

    try {
        await receipts.ensureReceipt(finalInvoice.id);
    } catch (error) {
        console.warn('Receipt creation skipped:', error.message);
    }

    // Only goes out when the order has a registered buyer with a phone.
    setImmediate(() => {
        sms.sendReceiptSms(finalInvoice.id, { auto: true }).catch(error =>
            console.warn('Receipt SMS skipped:', error.message)
        );
    });

    return { invoice: finalInvoice, kra: body };
}

// Used after a matched payment: never throws, never blocks the Daraja ACK.
function fiscalizeInBackground(saleId) {
    return fiscalizeSale(saleId).catch(error => {
        console.error(
            `Auto-fiscalization failed for sale ${saleId}:`,
            error.message
        );
    });
}

module.exports = { fiscalizeSale, fiscalizeInBackground };
