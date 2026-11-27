// One command for the live setup. Run it from the backend folder:
//   node scripts/live-setup.js --baseline 42
// What it does, in order:
//   1) gets KRA's item list for this device (skipped if kra-items.json already exists)
//   2) shows what it will change (dry run, writes nothing)
//   3) asks you to type yes; with --yes it does not ask
//   4) applies: migration 013, the KRA number baseline, and the item code and unit fixes
//   5) checks the items against KRA; it should report 0 mismatches
// --baseline is the last invoice number KRA accepted (confirm it first). It is never guessed.
// --items sets another file name (default kra-items.json).
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const db = require('../db');

const arg = name => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : null;
};

const baseline = arg('--baseline');
const itemsFile = arg('--items') || 'kra-items.json';
const itemsPath = path.resolve(itemsFile);
const assumeYes = process.argv.includes('--yes');

const script = (name, args) =>
    execFileSync(process.execPath, [path.join(__dirname, name), ...args], { stdio: 'inherit' });

// Step 1: KRA's item list for this device. Read-only at KRA.
async function fetchItems() {
    const base = (process.env.OSCU_BASE_URL || '').replace(/\/+$/, '');
    const pin = (process.env.KRA_PIN || '').toUpperCase();
    const bhf = process.env.KRA_BRANCH_ID || '01';
    const cmc = process.env.KRA_CMC_KEY;

    if (!base || !pin || !cmc) throw new Error('KRA settings are missing from .env');

    const response = await fetch(`${base}/selectItemList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', tin: pin, bhfId: bhf, cmcKey: cmc },
        body: JSON.stringify({ tin: pin, bhfId: bhf, cmcKey: cmc, lastReqDt: '20000101000000' })
    });
    const json = await response.json();

    if (json.resultCd !== '000') throw new Error(`KRA said ${json.resultCd}: ${json.resultMsg}`);

    fs.writeFileSync(itemsPath, JSON.stringify(json, null, 2));
    console.log(`Saved ${itemsFile} with ${json.data.itemList.length} items from KRA.\n`);
}

const ask = question =>
    new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });

(async () => {
    if (!baseline || !/^\d+$/.test(baseline)) {
        console.log('Give the confirmed baseline, for example: node scripts/live-setup.js --baseline 42');
        process.exit(1);
    }

    if (!fs.existsSync(itemsPath)) {
        console.log('Getting the item list from KRA...');
        await fetchItems();
    } else {
        console.log(`Using the existing ${itemsFile}.\n`);
    }

    // Step 2: dry run. Reads only.
    const hasMigration = (await db.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'invoices' AND column_name = 'kra_invc_no'`
    )).rows.length > 0;
    await db.pool.end();

    console.log('=== What will change (dry run) ===');
    console.log(`Migration 013: ${hasMigration ? 'already applied' : 'will be applied'}`);

    if (hasMigration) {
        script('set-kra-baseline.js', [baseline]);
        script('fix-kra-mappings.js', [itemsPath]);
    } else {
        console.log('The baseline and item changes are shown after the migration, so they are not listed yet.');
    }

    // Step 3: confirm.
    if (!assumeYes) {
        const answer = await ask('\nDoes this look right? Type yes to apply: ');
        if (answer !== 'yes') {
            console.log('Not applied. Nothing was changed.');
            process.exit(0);
        }
    }

    // Step 4: apply.
    console.log('\n=== Applying ===');

    if (!hasMigration) {
        execFileSync('npm', ['run', 'db:migrate'], { stdio: 'inherit', shell: true, cwd: path.join(__dirname, '..') });
        console.log('Migration 013 applied.');
    }

    script('set-kra-baseline.js', [baseline, '--apply']);
    script('fix-kra-mappings.js', [itemsPath, '--apply']);

    // Step 5: check. Reads only.
    console.log('\n=== Check against KRA (should show 0 mismatches) ===');
    script('check-kra-items.js', [itemsPath]);
})().catch(error => {
    console.error('Stopped:', error.message);
    console.error('If this happened during "Applying", the steps before it were applied. Send this output to the developer before running again.');
    process.exit(1);
});
