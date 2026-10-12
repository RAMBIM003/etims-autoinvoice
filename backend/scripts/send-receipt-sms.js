// Usage (from C:\etims\backend):
//   node scripts\send-receipt-sms.js INV-2026-000002 0712345678
// The phone is optional: without it the buyer's registered phone is used.
// With SMS_PROVIDER unset the message is printed here instead of being sent.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../db');
const sms = require('../services/smsService');

const done = code => setTimeout(() => process.exit(code), 300);

(async () => {
    const [invoiceNumber, phone] = process.argv.slice(2);

    if (!invoiceNumber) {
        console.log('Usage: node scripts\\send-receipt-sms.js INV-2026-000002 [0712345678]');
        return done(0);
    }

    const invoice = (
        await db.query(`SELECT id FROM invoices WHERE invoice_number = $1`, [
            invoiceNumber
        ])
    ).rows[0];

    if (!invoice) {
        console.log('No invoice with number', invoiceNumber);
        return done(1);
    }

    const result = await sms.sendReceiptSms(invoice.id, { phone: phone || null });

    console.log(JSON.stringify(result, null, 1));
    done(0);
})().catch(error => {
    console.log('ERR', error.message);
    done(1);
});
