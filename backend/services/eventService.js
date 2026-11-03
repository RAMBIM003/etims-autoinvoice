const db = require('../db');

const DETAIL_LIMIT = 4000;

/*
 * Writes one row to system_events. It never throws: a failed log write must not
 * break the payment or fiscalization it is describing, so the failure is only
 * printed to the server log.
 */
async function record({ merchantId = null, stage, outcome = 'OK', code = null, reference = null, saleId = null, invoiceId = null, message, detail = null }, client = db) {
    try {
        const text = detail == null ? null : String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, DETAIL_LIMIT);

        await client.query(
            `INSERT INTO system_events
             (merchant_id, stage, outcome, code, reference, sale_id, invoice_id, message, detail)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [merchantId, stage, outcome, code, reference, saleId, invoiceId, String(message).slice(0, 500), text]
        );
    } catch (err) {
        console.error('system_events write failed:', err.message);
    }
}

module.exports = { record };
