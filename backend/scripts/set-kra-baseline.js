// Sets the last invoice number KRA accepted for this device's sequences.
// Run once per branch, after confirming that number with KRA. Usage:
//   node scripts/set-kra-baseline.js <last-accepted-number>          (dry run)
//   node scripts/set-kra-baseline.js <last-accepted-number> --apply  (writes)
// The number only goes up: it refuses to move a baseline backwards.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

(async () => {
  const value = Number(process.argv[2]);
  const apply = process.argv.includes('--apply');

  if (!Number.isInteger(value) || value < 0) {
    console.log('Give the last number KRA accepted, as a whole number. Example: node scripts/set-kra-baseline.js 40');
    process.exit(1);
  }

  const rows = (await db.query(
    `SELECT s.id, s.merchant_id, s.branch_id, s.last_kra_invc_no, m.trading_name
     FROM invoice_sequences s JOIN merchants m ON m.id = s.merchant_id`
  )).rows;

  if (!rows.length) {
    console.log('No invoice sequences found.');
    process.exit(0);
  }

  for (const r of rows) {
    const current = r.last_kra_invc_no == null ? 'not set' : r.last_kra_invc_no;
    if (r.last_kra_invc_no != null && Number(r.last_kra_invc_no) > value) {
      console.log(`${r.trading_name}: current ${current} is higher than ${value}. Left unchanged.`);
      continue;
    }
    console.log(`${r.trading_name}: ${current} -> ${value}${apply ? '' : ' (dry run)'}`);
    if (apply) {
      await db.query('UPDATE invoice_sequences SET last_kra_invc_no = $1, updated_at = now() WHERE id = $2', [value, r.id]);
    }
  }

  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
