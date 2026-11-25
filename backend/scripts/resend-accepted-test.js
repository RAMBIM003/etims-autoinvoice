// Read-only test. Resends the exact request KRA accepted earlier (invoice 30) and prints KRA's reply.
// Expected: 994 ("overlapped data") means the sales endpoint works. 999 means it fails for everything.
// Writes nothing to the database. Dry run by default; add --send to submit.
//   node scripts/resend-accepted-test.js           (prints what would be sent)
//   node scripts/resend-accepted-test.js --send
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

(async () => {
  const send = process.argv.includes('--send');
  const row = (await db.query(
    `SELECT a.request_payload, i.invoice_number
     FROM fiscalization_attempts a JOIN invoices i ON i.id = a.invoice_id
     WHERE a.status = 'SUCCESS' AND a.request_payload IS NOT NULL
     ORDER BY a.completed_at DESC NULLS LAST LIMIT 1`
  )).rows[0];

  if (!row) { console.log('No accepted request is stored.'); process.exit(1); }

  const payload = row.request_payload;
  const tin = process.env.KRA_PIN;
  const bhf = process.env.KRA_BRANCH_ID || '01';
  const cmcKey = process.env.KRA_CMC_KEY;
  const base = process.env.OSCU_BASE_URL || 'https://etims-api-sbx.kra.go.ke/etims-api';

  console.log(`Accepted request to resend: ${row.invoice_number} (invcNo ${payload.invcNo})`);

  if (!send) {
    console.log('Dry run. Nothing was sent. Add --send to resend.');
    process.exit(0);
  }

  const response = await fetch(`${base}/saveTrnsSalesOsdc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', tin, bhfId: bhf, cmcKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  });
  const body = await response.json().catch(() => ({}));
  console.log(`KRA answered HTTP ${response.status}:`);
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
})().catch((e) => { console.error('Test failed:', e.message); process.exit(1); });
