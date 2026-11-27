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
    { name: 'Super Petrol', itemCd: 'KE2NTLTR0000003' }
];

// Kerosene has no KRA registration yet. Mark it inactive so it cannot be sold until it is registered.
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

            const row = (
                await client.query(
                    `SELECT i.id, m.item_code, m.item_cls_code
                     FROM items i
                     JOIN merchants me ON me.id = i.merchant_id
                     LEFT JOIN item_kra_mappings m ON m.item_id = i.id AND m.active = true
                     WHERE UPPER(me.kra_pin) = $1 AND i.name = $2 AND i.status = 'ACTIVE'`,
                    [pin, fix.name]
                )
            ).rows[0];

            if (!row) throw new Error(`Active item "${fix.name}" not found for ${pin}. Nothing changed.`);

            console.log(`${fix.name}: code ${row.item_code} -> ${fix.itemCd}, class ${row.item_cls_code} -> ${reg.itemClsCd}`);

            if (apply) {
                await client.query(
                    `UPDATE item_kra_mappings
                     SET item_code = $1, item_cls_code = $2
                     WHERE item_id = $3 AND active = true`,
                    [fix.itemCd, reg.itemClsCd, row.id]
                );
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

            console.log(`${name}: status ${r.status} -> INACTIVE (not registered with KRA)`);

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
