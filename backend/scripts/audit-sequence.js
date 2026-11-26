// Read-only. Prints the invoice sequence row, invoices 27 to 42, and every fiscalization attempt for them.
//   node scripts/audit-sequence.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

(async () => {
  const from = 'INV-2026-000027';
  const to = 'INV-2026-000042';

  console.log('== invoice_sequences');
  console.table((await db.query('SELECT * FROM invoice_sequences')).rows);

  console.log('== invoices');
  console.table((await db.query(
    `SELECT invoice_number, fiscalization_status, kra_invc_no, created_at, updated_at
     FROM invoices WHERE invoice_number BETWEEN $1 AND $2 ORDER BY invoice_number`,
    [from, to]
  )).rows);

  console.log('== fiscalization attempts');
  console.table((await db.query(
    `SELECT i.invoice_number, fa.attempt_number, fa.status,
            fa.response_payload->>'resultCd' AS result_code,
            fa.response_payload->>'resultMsg' AS result_msg,
            fa.completed_at
     FROM fiscalization_attempts fa JOIN invoices i ON i.id = fa.invoice_id
     WHERE i.invoice_number BETWEEN $1 AND $2
     ORDER BY i.invoice_number, fa.attempt_number`,
    [from, to]
  )).rows);

  process.exit(0);
})().catch((e) => { console.error('Audit failed:', e.message); process.exit(1); });
