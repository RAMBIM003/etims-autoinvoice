const db = require('../db');

/*
 * KRA already holds some invoice numbers for this PIN, so the invoice counter must
 * start above them. On every server start this raises each invoice counter to at
 * least INVOICE_NUMBER_FLOOR (default 40). It only ever raises a counter, never
 * lowers it, so restarts do nothing once the counter is past the floor.
 */
const FLOOR = Number(process.env.INVOICE_NUMBER_FLOOR) || 40;

async function applyInvoiceNumberFloor() {
    const raised = (
        await db.query(
            `UPDATE invoice_sequences
             SET next_number = $1, updated_at = now()
             WHERE next_number < $1
             RETURNING id, merchant_id, next_number`,
            [FLOOR]
        )
    ).rows;

    if (raised.length) {
        console.log(`Invoice counter raised to ${FLOOR} for ${raised.length} sequence(s).`);
    }
}

module.exports = { applyInvoiceNumberFloor, FLOOR };
