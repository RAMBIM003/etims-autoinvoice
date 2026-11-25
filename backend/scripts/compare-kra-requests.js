// Read-only. Compares the latest request KRA accepted with the latest one it refused,
// and prints every field that differs. Changes nothing.
//   node scripts/compare-kra-requests.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

const IGNORE = new Set(['cfmDt', 'salesDt', 'rcptPbctDt', 'invcNo', 'trdInvcNo', 'itemCd', 'itemNm', 'tin', 'bhfId']);

function flatten(obj, prefix = '', out = {}) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else {
    out[prefix] = obj;
  }
  return out;
}

(async () => {
  const accepted = (await db.query(
    `SELECT a.request_payload, a.response_payload, i.invoice_number
     FROM fiscalization_attempts a JOIN invoices i ON i.id = a.invoice_id
     WHERE a.status = 'SUCCESS' AND a.request_payload IS NOT NULL
     ORDER BY a.completed_at DESC NULLS LAST LIMIT 1`
  )).rows[0];

  const refused = (await db.query(
    `SELECT a.request_payload, a.response_payload, i.invoice_number
     FROM fiscalization_attempts a JOIN invoices i ON i.id = a.invoice_id
     WHERE a.status = 'FAILED' AND a.request_payload IS NOT NULL
     ORDER BY a.completed_at DESC NULLS LAST LIMIT 1`
  )).rows[0];

  if (!accepted || !refused) {
    console.log('Need one accepted and one refused attempt stored in the database.');
    process.exit(1);
  }

  console.log(`Accepted: ${accepted.invoice_number}  reply: ${JSON.stringify(accepted.response_payload)}`);
  console.log(`Refused:  ${refused.invoice_number}  reply: ${JSON.stringify(refused.response_payload)}\n`);

  const a = flatten(accepted.request_payload);
  const b = flatten(refused.request_payload);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();

  let count = 0;
  for (const k of keys) {
    const last = k.split('.').pop().replace(/\[\d+\]/g, '');
    if (IGNORE.has(last)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      count++;
      console.log(`${k}: accepted=${JSON.stringify(a[k])}  refused=${JSON.stringify(b[k])}`);
    }
  }
  console.log(`\n${count} difference(s). Ignored (expected to differ): ${[...IGNORE].join(', ')}.`);
  process.exit(0);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
