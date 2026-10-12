// Usage (from C:\etims\backend):  node scripts\receipt-link.js
// Creates any missing receipt rows and prints the private link for every
// fiscalized invoice.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../db');
const receipts = require('../services/receiptService');

(async () => {
    const rows = (
        await db.query(
            `SELECT id, invoice_number
             FROM invoices
             WHERE fiscalization_status = 'FISCALIZED'
             ORDER BY created_at`
        )
    ).rows;

    if (!rows.length) {
        console.log('No fiscalized invoices yet.');
    }

    for (const row of rows) {
        const { url } = await receipts.ensureReceipt(row.id);
        console.log(row.invoice_number, url);
    }

    setTimeout(() => process.exit(0), 300);
})().catch(error => {
    console.log('ERR', error.message);
    process.exit(1);
});
