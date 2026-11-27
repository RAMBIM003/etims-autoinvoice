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

/**
 * Frees the KRA number an invoice holds when KRA refused it as already existing (924)
 * on every attempt. Refused if KRA ever accepted the invoice, so nothing is duplicated.
 * The invoice's next retry then takes a new number.
 */
async function releaseKraNumber(invoiceId, merchantId) {
    const inv = (
        await db.query(
            `SELECT id, invoice_number, fiscalization_status, kra_invc_no
             FROM invoices
             WHERE id = $1 AND merchant_id = $2`,
            [invoiceId, merchantId]
        )
    ).rows[0];

    if (!inv) throw fail('Invoice not found', 404);

    if (!['FAILED', 'NEEDS_CHECK'].includes(inv.fiscalization_status)) {
        throw fail(`${inv.invoice_number} is ${inv.fiscalization_status}. Only failed invoices can be released.`, 409);
    }

    if (inv.kra_invc_no == null) {
        throw fail(`${inv.invoice_number} holds no KRA number.`, 409);
    }

    const codes = (
        await db.query(
            `SELECT response_payload->>'resultCd' AS code
             FROM fiscalization_attempts
             WHERE invoice_id = $1`,
            [inv.id]
        )
    ).rows.map(row => row.code);

    if (codes.includes('000')) {
        throw fail(`${inv.invoice_number} was accepted by KRA, so its number cannot be released.`, 409);
    }

    if (!codes.length || codes.some(code => code !== '924')) {
        throw fail(
            `KRA did not refuse ${inv.invoice_number} with 924 on every attempt, so its number cannot be released.`,
            409
        );
    }

    await db.query(
        `UPDATE invoices
         SET kra_invc_no = NULL, fiscalization_status = 'FAILED', updated_at = now()
         WHERE id = $1`,
        [inv.id]
    );

    return { invoice_number: inv.invoice_number, released_number: Number(inv.kra_invc_no) };
}

module.exports = { claimKraNumber, recordAccepted, releaseKraNumber };
