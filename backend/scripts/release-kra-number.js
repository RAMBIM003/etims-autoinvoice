// Frees the KRA invoice number a FAILED invoice holds, so its next retry gets a new number.
// Only for an invoice KRA refused with 924 ("Invoice number already exists") and never accepted.
// Dry run by default. Usage:
//   node scripts/release-kra-number.js INV-2026-000042            (dry run)
//   node scripts/release-kra-number.js INV-2026-000042 --apply    (writes)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

(async () => {
  const invoiceNumber = process.argv[2];
  const apply = process.argv.includes('--apply');

  if (!invoiceNumber || !invoiceNumber.startsWith('INV-')) {
    console.log('Usage: node scripts/release-kra-number.js INV-2026-000042 [--apply]');
    process.exit(1);
  }

  const inv = (await db.query(
    `SELECT id, fiscalization_status, kra_invc_no FROM invoices WHERE invoice_number = $1`,
    [invoiceNumber]
  )).rows[0];

  if (!inv) throw new Error(`${invoiceNumber} not found. Nothing changed.`);
  if (inv.fiscalization_status !== 'FAILED') {
    throw new Error(`${invoiceNumber} is ${inv.fiscalization_status}, not FAILED. Nothing changed.`);
  }
  if (inv.kra_invc_no == null) {
    throw new Error(`${invoiceNumber} holds no KRA number. Nothing to release.`);
  }

  const attempts = (await db.query(
    `SELECT attempt_number, response_payload->>'resultCd' AS code
     FROM fiscalization_attempts WHERE invoice_id = $1 ORDER BY attempt_number`,
    [inv.id]
  )).rows;

  if (attempts.some(a => a.code === '000')) {
    throw new Error(`${invoiceNumber} was accepted by KRA at some point. Do not release it. Nothing changed.`);
  }
  if (!attempts.length || attempts.some(a => a.code !== '924')) {
    throw new Error(
      `${invoiceNumber} attempts are not all 924: ${attempts.map(a => a.code).join(', ') || 'none'}. Nothing changed.`
    );
  }

  console.log(`${invoiceNumber}: KRA number ${inv.kra_invc_no} released (KRA refused it with 924 ${attempts.length} time(s)).`);

  if (apply) {
    await db.query(`UPDATE invoices SET kra_invc_no = NULL, updated_at = now() WHERE id = $1`, [inv.id]);
    console.log('Applied. Retry the invoice now; it will get the next free number.');
  } else {
    console.log('Dry run. Nothing was changed. Add --apply to write.');
  }

  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
