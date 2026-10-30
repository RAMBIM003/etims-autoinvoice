const db = require('../db');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

const baseUrl = () =>
    (process.env.OSCU_BASE_URL || 'https://etims-api-sbx.kra.go.ke/etims-api')
        .replace(/\/+$/, '');

// OSCU spec 4.1: tax types A to E.
const TAX_TYPES = ['A', 'B', 'C', 'D', 'E'];

// OSCU spec 4.19: itemCd = KE + product type (1) + packaging unit (2)
// + quantity unit (2) + sequence (7), 14 characters in total.
// Product type: 2 = finished product, 3 = service without stock.
const ITEM_TYPES = ['2', '3'];
const PKG_UNIT = 'NT'; // Net (spec 4.5)

// Quantity units from spec 4.6 that fit the two-character slot.
// LTR/L (litres) is deliberately absent until KRA confirms the slot rule.
const QTY_SLOT = { PCS: 'NO', NO: 'NO', KG: 'KG', BX: 'BX', PA: 'PA', LTR: 'LTR', L: 'L' };
const LITRE_UNITS = [];

const CMC_HEADERS = () => ({
    tin: (process.env.KRA_PIN || '').toUpperCase(),
    bhfId: process.env.KRA_BRANCH_ID || '00',
    cmcKey: process.env.KRA_CMC_KEY
});

// Classification list is cached for 10 minutes; it rarely changes.
let clsCache = { at: 0, list: [] };

async function classes() {
    if (Date.now() - clsCache.at < 10 * 60 * 1000 && clsCache.list.length) {
        return clsCache.list;
    }

    const h = CMC_HEADERS();

    if (!h.tin || !h.cmcKey) {
        throw fail('KRA OSCU credentials are not configured', 500);
    }

    const r = await fetch(baseUrl() + '/selectItemClsList', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ ...h, lastReqDt: '20180523000000' }),
        signal: AbortSignal.timeout(30000)
    });

    const j = await r.json().catch(() => ({}));

    if (j.resultCd !== '000') {
        throw fail(`KRA classification list failed: ${j.resultCd || r.status} ${j.resultMsg || ''}`.trim(), 502);
    }

    clsCache = { at: Date.now(), list: (j.data && j.data.itemClsList) || [] };

    return clsCache.list;
}

async function status(merchantId) {
    return (
        await db.query(
            `SELECT i.id, i.name, i.unit_code, i.unit_price, i.tax_type_code,
                    m.item_code, m.item_cls_code, m.active AS mapped
             FROM items i
             LEFT JOIN item_kra_mappings m
                ON m.item_id = i.id AND m.active = true
             WHERE i.merchant_id = $1
               AND i.status = 'ACTIVE'
             ORDER BY i.name`,
            [merchantId]
        )
    ).rows;
}

async function registerItem({ merchantId, itemId, classCode, taxType, itemTypeCode }) {
    if (!TAX_TYPES.includes(taxType)) {
        throw fail('Tax type must be A, B, C, D or E', 400);
    }

    if (!ITEM_TYPES.includes(itemTypeCode)) {
        throw fail('Item type must be 2 (finished product) or 3 (service)', 400);
    }

    if (!classCode) {
        throw fail('An item classification code is required', 400);
    }

    const h = CMC_HEADERS();

    if (!h.tin || !h.cmcKey) {
        throw fail('KRA OSCU credentials are not configured', 500);
    }

    const cls = (await classes()).find(x => String(x.itemClsCd) === String(classCode));

    if (!cls) {
        throw fail(`Classification ${classCode} is not in KRA's list`, 400);
    }

    if (cls.useYn !== 'Y') {
        throw fail(`Classification ${classCode} is not in use`, 400);
    }

    if (cls.taxTyCd && cls.taxTyCd !== taxType) {
        throw fail(`Classification ${classCode} is tied to tax type ${cls.taxTyCd} by KRA`, 400);
    }

    return db.tx(async c => {
        // Row lock serialises code generation for this merchant.
        await c.query('SELECT id FROM merchants WHERE id = $1 FOR UPDATE', [merchantId]);

        const item = (
            await c.query(
                `SELECT * FROM items WHERE id = $1 AND merchant_id = $2`,
                [itemId, merchantId]
            )
        ).rows[0];

        if (!item) {
            throw fail('Item not found', 404);
        }

        const existing = (
            await c.query(
                `SELECT item_code, item_cls_code
                 FROM item_kra_mappings
                 WHERE item_id = $1 AND active = true`,
                [itemId]
            )
        ).rows[0];

        if (existing) {
            return {
                item_id: itemId,
                item_code: existing.item_code,
                item_cls_code: existing.item_cls_code,
                already_registered: true
            };
        }

        const unit = String(item.unit_code || '').toUpperCase();

        if (LITRE_UNITS.includes(unit)) {
            throw fail(
                'Litres (LTR) cannot be encoded yet: the two-character quantity slot needs KRA\'s rule first.',
                400
            );
        }

        const qty = QTY_SLOT[unit];

        if (!qty) {
            throw fail(`Unit ${item.unit_code} has no KRA quantity code yet`, 400);
        }

        const seq = Number(
            (
                await c.query(
                    `SELECT COALESCE(MAX(RIGHT(m.item_code, 7)::int), 0) + 1 AS n
                     FROM item_kra_mappings m
                     JOIN items i ON i.id = m.item_id
                     WHERE i.merchant_id = $1
                       AND m.item_code ~ '^KE[0-9][A-Z]{2,5}[0-9]{7}$'`,
                    [merchantId]
                )
            ).rows[0].n
        );

        const itemCd = `KE${itemTypeCode}${PKG_UNIT}${qty}${String(seq).padStart(7, '0')}`;

        const body = {
            ...h,
            itemClsCd: String(classCode),
            itemCd,
            itemTyCd: itemTypeCode,
            itemNm: item.name,
            itemStdNm: null,
            orgnNatCd: 'KE',
            pkgUnitCd: PKG_UNIT,
            qtyUnitCd: qty,
            taxTyCd: taxType,
            btchNo: null,
            bcd: null,
            dftPrc: Number(item.unit_price),
            grpPrcL1: null,
            grpPrcL2: null,
            grpPrcL3: null,
            grpPrcL4: null,
            grpPrcL5: null,
            addInfo: null,
            sftyQty: null,
            isrcAplcbYn: 'N',
            useYn: 'Y',
            regrId: 'MASTERCLASS',
            regrNm: 'MASTERCLASS',
            modrId: 'MASTERCLASS',
            modrNm: 'MASTERCLASS'
        };

        const r = await fetch(baseUrl() + '/saveItem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', tin: h.tin, bhfId: h.bhfId, cmcKey: h.cmcKey },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30000)
        });

        const j = await r.json().catch(() => ({}));

        if (j.resultCd !== '000') {
            throw fail(`KRA rejected item ${itemCd}: ${j.resultCd || r.status} ${j.resultMsg || ''}`.trim(), 502);
        }

        await c.query(
            `INSERT INTO item_kra_mappings
                (item_id, item_cls_code, item_code, item_name, tax_type_code, unit_code, source, active)
             VALUES ($1, $2, $3, $4, $5, $6, 'MANUAL', true)
             ON CONFLICT (item_id) DO UPDATE SET
                item_cls_code = EXCLUDED.item_cls_code,
                item_code = EXCLUDED.item_code,
                item_name = EXCLUDED.item_name,
                tax_type_code = EXCLUDED.tax_type_code,
                unit_code = EXCLUDED.unit_code,
                active = true,
                updated_at = now()`,
            [itemId, String(classCode), itemCd, item.name, taxType, unit]
        );

        await c.query(
            `UPDATE items SET tax_type_code = $1, updated_at = now() WHERE id = $2`,
            [taxType, itemId]
        );

        return {
            item_id: itemId,
            item_code: itemCd,
            item_cls_code: String(classCode),
            tax_type_code: taxType,
            kra_result: j.resultMsg || null,
            already_registered: false
        };
    });
}

module.exports = { classes, status, registerItem };
