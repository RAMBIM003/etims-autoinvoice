const db = require('../db');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

// An invoice holds a KRA number from the moment it is first submitted until KRA
// accepts it. Only one such invoice may exist per merchant at a time, so numbers
// are never skipped or taken out of order.
const UNRESOLVED = `('PROCESSING', 'PENDING_KRA', 'NEEDS_CHECK', 'FAILED', 'CANCELLED')`;

/**
 * Marks the invoice as being submitted and gives it its KRA number. A retry keeps the
 * number it already has, so KRA never sees the same sale under two numbers.
 * Runs in one transaction with a row lock on the branch sequence.
 */
async function claimKraNumber(invoice) {
    return db.tx(async (c) => {
        const seq = (
            await c.query(
                `SELECT id, last_kra_invc_no
                 FROM invoice_sequences
                 WHERE merchant_id = $1
                   AND branch_id IS NOT DISTINCT FROM $2
                 FOR UPDATE`,
                [invoice.merchant_id, invoice.branch_id || null]
            )
        ).rows[0];

        let number = invoice.kra_invc_no == null ? null : Number(invoice.kra_invc_no);

        if (number == null) {
            if (!seq || seq.last_kra_invc_no == null) {
                throw fail(
                    'The KRA invoice number is not set up for this branch yet. Ask the developer to run scripts/set-kra-baseline.js after confirming the last number KRA accepted.',
                    500
                );
            }

            const blocker = (
                await c.query(
                    `SELECT invoice_number, fiscalization_status
                     FROM invoices
                     WHERE merchant_id = $1
                       AND id <> $2
                       AND kra_invc_no IS NOT NULL
                       AND fiscalization_status IN ${UNRESOLVED}
                     ORDER BY kra_invc_no
                     LIMIT 1`,
                    [invoice.merchant_id, invoice.id]
                )
            ).rows[0];

            if (blocker) {
                throw fail(
                    `Invoice ${blocker.invoice_number} still has an unresolved KRA number (${blocker.fiscalization_status}). Fiscalize or retry it first, so numbers stay in order.`,
                    409
                );
            }

            number = Number(seq.last_kra_invc_no) + 1;
        }

        const claimed = (
            await c.query(
                `UPDATE invoices
                 SET fiscalization_status = 'PROCESSING',
                     kra_invc_no = $2,
                     updated_at = now()
                 WHERE id = $1
                   AND fiscalization_status IN ('PENDING', 'FAILED', 'PENDING_KRA')
                 RETURNING *`,
                [invoice.id, number]
            )
        ).rows[0];

        if (!claimed) {
            throw fail('This invoice is already being fiscalized', 409);
        }

        return claimed;
    });
}

/** Called only after KRA accepts an invoice, so the next invoice continues from it. */
async function recordAccepted(invoice, kraNumber) {
    await db.query(
        `UPDATE invoice_sequences
         SET last_kra_invc_no = GREATEST(COALESCE(last_kra_invc_no, 0), $1),
             updated_at = now()
         WHERE merchant_id = $2
           AND branch_id IS NOT DISTINCT FROM $3`,
        [Number(kraNumber), invoice.merchant_id, invoice.branch_id || null]
    );
}

module.exports = { claimKraNumber, recordAccepted };
