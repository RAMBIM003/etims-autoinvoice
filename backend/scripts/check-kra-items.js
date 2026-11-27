// Read-only. Compares our active items and their KRA mappings with KRA's item registry
// (the saved reply from /selectItemList). Changes nothing, in the database or in KRA.
//   node scripts/check-kra-items.js <path-to-selectItemList-reply.json>
// Save the reply from Postman (or the file in e5c7039c-attachment.txt) and pass its path.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const db = require('../db');

// Same rule fiscalizationService.js uses when it builds the invoice (qtyUnit).
// The registration code (itemKraService.js) uses a different rule, so a mismatch shows here.
const unitSent = code => {
    const c = String(code || '').toUpperCase();
    return !c || c === 'PCS' ? 'U' : c;
};

(async () => {
    const file = process.argv[2];

    if (!file) {
        console.log('Usage: node scripts/check-kra-items.js <path-to-selectItemList-reply.json>');
        process.exit(1);
    }

    const reply = JSON.parse(fs.readFileSync(file, 'utf8'));
    const registry = (reply.data && reply.data.itemList) || reply.itemList || [];
    const byCode = new Map(registry.map(r => [r.itemCd, r]));

    const pin = (process.env.KRA_PIN || '').toUpperCase();

    const items = (
        await db.query(
            `SELECT i.name, i.unit_code, i.unit_price, i.tax_type_code,
                    m.item_code, m.item_cls_code
             FROM items i
             JOIN merchants me ON me.id = i.merchant_id
             LEFT JOIN item_kra_mappings m ON m.item_id = i.id AND m.active = true
             WHERE UPPER(me.kra_pin) = $1
               AND i.status = 'ACTIVE'
             ORDER BY i.name`,
            [pin]
        )
    ).rows;

    let problems = 0;
    const mappedCodes = new Set();

    console.log(`Our active items for ${pin}: ${items.length}. KRA registry items: ${registry.length}.\n`);

    for (const it of items) {
        const issues = [];

        if (!it.item_code) {
            issues.push('NO KRA MAPPING');
        } else {
            mappedCodes.add(it.item_code);
            const reg = byCode.get(it.item_code);

            if (!reg) {
                issues.push(`CODE ${it.item_code} NOT IN KRA REGISTRY`);
            } else {
                if (String(reg.itemNm).trim().toLowerCase() !== String(it.name).trim().toLowerCase()) {
                    issues.push(`NAME: ours "${it.name}", KRA "${reg.itemNm}"`);
                }
                if (String(it.item_cls_code || '') !== String(reg.itemClsCd)) {
                    issues.push(`CLASS: ours ${it.item_cls_code}, KRA ${reg.itemClsCd}`);
                }
                if (String(it.tax_type_code || '').toUpperCase() !== String(reg.taxTyCd)) {
                    issues.push(`TAX: ours ${it.tax_type_code}, KRA ${reg.taxTyCd}`);
                }
                const sent = unitSent(it.unit_code);
                if (sent !== reg.qtyUnitCd) {
                    issues.push(`UNIT: we send ${sent} (our unit ${it.unit_code}), KRA ${reg.qtyUnitCd}`);
                }
                if (Number(it.unit_price) !== Number(reg.dftPrc)) {
                    issues.push(`PRICE (check only): ours ${it.unit_price}, KRA default ${reg.dftPrc}`);
                }
            }
        }

        const hard = issues.filter(x => !x.startsWith('PRICE'));
        if (hard.length) problems += 1;

        console.log(`${hard.length ? 'MISMATCH' : 'ok      '}  ${it.name}  [${it.item_code || 'no code'}]`);
        issues.forEach(x => console.log(`           - ${x}`));
    }

    const unmapped = registry.filter(r => !mappedCodes.has(r.itemCd));
    if (unmapped.length) {
        console.log(`\nKRA registry items not linked to any of our items (${unmapped.length}):`);
        unmapped.forEach(r => console.log(`  ${r.itemCd}  ${r.itemNm}`));
    }

    console.log(`\nItems with a hard mismatch: ${problems}. Read-only: nothing was changed.`);
    process.exit(0);
})().catch(error => {
    console.error('Check failed:', error.message);
    process.exit(1);
});
