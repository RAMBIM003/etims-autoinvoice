const fs = require('fs');
const f = 'services/fiscalizationService.js';
fs.copyFileSync(f, f + '.bak');
let t = fs.readFileSync(f, 'utf8');

const anchorA = `function fiscalizeInBackground(saleId) {`;
const anchorB = `return fiscalizeSale(saleId).catch(error => {`;
const count = s => t.split(s).length - 1;

if (count(anchorA) !== 1 || count(anchorB) !== 1) {
  console.log('Abort: anchors not found exactly once. Nothing changed.');
  process.exit(1);
}

const recordRefusal = `async function recordRefusal(saleId, message) {
    const inv = (await db.query(
        "SELECT id FROM invoices WHERE sale_id = $1 AND fiscalization_status = 'PENDING' ORDER BY created_at DESC LIMIT 1",
        [saleId]
    )).rows[0];
    if (!inv) return;

    const n = Number((await db.query(
        "SELECT COALESCE(MAX(attempt_number), 0) + 1 AS n FROM fiscalization_attempts WHERE invoice_id = $1",
        [inv.id]
    )).rows[0].n);

    await db.query(
        "INSERT INTO fiscalization_attempts (invoice_id, attempt_number, status, error_message, completed_at) VALUES ($1, $2, 'FAILED', $3, now())",
        [inv.id, n, message]
    );
    await db.query(
        "UPDATE invoices SET fiscalization_status = 'FAILED', updated_at = now() WHERE id = $1",
        [inv.id]
    );
}

`;

const hook = `return fiscalizeSale(saleId).catch(async error => {
        try {
            await recordRefusal(saleId, error.message);
        } catch (e) {
            console.error('Could not record refusal:', e.message);
        }`;

t = t.split(anchorA).join(recordRefusal + anchorA);
t = t.split(anchorB).join(hook);
fs.writeFileSync(f, t);
console.log('fiscalizationService.js patched. Backup at services/fiscalizationService.js.bak');
