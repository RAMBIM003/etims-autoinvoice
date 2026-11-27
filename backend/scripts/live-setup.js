// One command for the live database, after pulling main. Runs the steps in order and
// stops at the first failure. Dry run by default; add --apply to write.
//   node scripts/live-setup.js --baseline 42 --items kra-items.json
//   node scripts/live-setup.js --baseline 42 --items kra-items.json --apply
// --baseline is the last invoice number KRA accepted (confirm it first). It is never guessed.
// Steps: 1) migration 013  2) KRA number baseline  3) item code and unit fixes (Kerosene inactive)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const db = require('../db');

const arg = name => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : null;
};

const apply = process.argv.includes('--apply');
const baseline = arg('--baseline');
const items = arg('--items');

const run = (script, args) =>
    execFileSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit' });

(async () => {
    if (!baseline || !/^\d+$/.test(baseline)) {
        console.log('Give the confirmed baseline: --baseline <last invoice number KRA accepted>');
        process.exit(1);
    }

    if (!items || !fs.existsSync(path.resolve(items))) {
        console.log('Give the saved KRA item list: --items <path to kra-items.json>');
        process.exit(1);
    }

    console.log(`${apply ? 'APPLYING' : 'DRY RUN'}: baseline ${baseline}, items ${items}\n`);

    // 1) Migration 013 adds the columns the new numbering uses.
    const has = (await db.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'invoices' AND column_name = 'kra_invc_no'`
    )).rows.length > 0;

    console.log(`1) Migration 013: ${has ? 'already applied' : 'NOT applied yet'}`);

    if (!has && !apply) {
        console.log('   Steps 2 and 3 can only be checked after the migration, so the dry run stops here.');
        console.log('\nRun with --apply to apply the migration and then the rest.');
        await db.pool.end();
        process.exit(0);
    }

    if (!has) {
        await db.pool.end();
        execFileSync('npm', ['run', 'db:migrate'], { stdio: 'inherit', shell: true, cwd: path.join(__dirname, '..') });
        console.log('   migration applied.');
    } else {
        await db.pool.end();
    }

    process.exit(runRest());

    function runRest() {
        console.log('\n2) KRA number baseline');
        run('set-kra-baseline.js', [baseline, ...(apply ? ['--apply'] : [])]);

        console.log('\n3) Item codes and units');
        run('fix-kra-mappings.js', [items, ...(apply ? ['--apply'] : [])]);

        console.log(apply
            ? '\nDone. Next: node scripts/check-kra-items.js ' + items + ' should show 0 mismatches.'
            : '\nDry run only. Re-run with --apply when the output above is right.');
        return 0;
    }
})().catch(error => {
    console.error('Stopped:', error.message);
    process.exit(1);
});
