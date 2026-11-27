// Corrects our item-to-KRA mappings so they match KRA's registry (the saved /selectItemList reply).
// Dry run by default. Pass --apply to write. Writes only to our database; nothing is sent to KRA.
//   node scripts/fix-kra-mappings.js <kra-items.json>            (shows the changes)
//   node scripts/fix-kra-mappings.js <kra-items.json> --apply    (makes them)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const db = require('../db');

// Each fix: our item name -> the KRA code it must point at. Values are taken from KRA's registry.
const FIXES = [
    { name: 'Car Wash', itemCd: 'KE2NTNO0000002' },
    { name: 'Engine Oil 1L', itemCd: 'KE2NTNO0000001' },
    { name: 'Super Petrol', itemCd: 'KE2NTLTR0000003' },
    { name: 'Diesel', itemCd: 'KE2NTLTR0000006' },
    { name: 'Kerosene', itemCd: 'KE2NTLTR0000005' }
];

// Kerosene is kept inactive until it is ready to sell. Its code is still corrected above.
const DEACTIVATE = ['Kerosene'];

(async () => {
    const apply = process.argv.includes('--apply');
    const file = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

    if (!file) {
        console.log('Usage: node scripts/fix-kra-mappings.js <kra-items.json> [--apply]');
        process.exit(1);
    }

    const reply = JSON.parse(fs.readFileSync(file, 'utf8'));
    const registry = (reply.data && reply.data.itemList) || reply.itemList || [];
    const byCode = new Map(registry.map(r => [r.itemCd, r]));
    const pin = (process.env.KRA_PIN || '').toUpperCase();

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        for (const fix of FIXES) {
            const reg = byCode.get(fix.itemCd);
            if (!reg) throw new Error(`${fix.itemCd} is not in the KRA registry file. Nothing changed.`);

            // Any status: an inactive item still gets its code corrected.
            const row = (
                await client.query(
                    `SELECT i.id, i.status, i.tax_type_code, m.id AS mapping_id, m.item_code, m.item_cls_code
                     FROM items i
                     JOIN merchants me ON me.id = i.merchant_id
                     LEFT JOIN item_kra_mappings m ON m.item_id = i.id AND m.active = true
                     WHERE UPPER(me.kra_pin) = $1 AND i.name = $2`,
                    [pin, fix.name]
                )
            ).rows[0];

            if (!row) throw new Error(`Item "${fix.name}" not found for ${pin}. Nothing changed.`);

            const taxNote = String(row.tax_type_code || '').toUpperCase() === String(reg.taxTyCd)
                ? ''
                : `  (WARNING: our tax type ${row.tax_type_code} differs from KRA ${reg.taxTyCd})`;

            console.log(`${fix.name}: code ${row.item_code || 'none'} -> ${fix.itemCd}, class ${row.item_cls_code || 'none'} -> ${reg.itemClsCd}${taxNote}`);

            if (apply) {
                if (row.mapping_id) {
                    await client.query(
                        `UPDATE item_kra_mappings SET item_code = $1, item_cls_code = $2 WHERE id = $3`,
                        [fix.itemCd, reg.itemClsCd, row.mapping_id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO item_kra_mappings
                            (item_id, item_cls_code, item_code, item_name, tax_type_code, source, active)
                         VALUES ($1, $2, $3, $4, $5, 'MANUAL', true)`,
                        [row.id, reg.itemClsCd, fix.itemCd, fix.name, row.tax_type_code]
                    );
                }
            }
        }

        for (const name of DEACTIVATE) {
            const r = (
                await client.query(
                    `SELECT i.id, i.status FROM items i JOIN merchants me ON me.id = i.merchant_id
                     WHERE UPPER(me.kra_pin) = $1 AND i.name = $2`,
                    [pin, name]
                )
            ).rows[0];

            if (!r) throw new Error(`Item "${name}" not found for ${pin}. Nothing changed.`);

            console.log(`${name}: status ${r.status} -> INACTIVE (kept inactive until it is ready to sell)`);

            if (apply) {
                await client.query(`UPDATE items SET status = 'INACTIVE', updated_at = now() WHERE id = $1`, [r.id]);
            }
        }

        if (apply) {
            await client.query('COMMIT');
            console.log('\nApplied. Run check-kra-items.js again to confirm.');
        } else {
            await client.query('ROLLBACK');
            console.log('\nDry run. Nothing was changed. Add --apply to write.');
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        process.exit(process.exitCode || 0);
    }
})();
