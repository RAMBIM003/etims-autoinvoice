// Closes an invoice that KRA already holds (924 or 994 on its number) but whose receipt we
// cannot confirm. The invoice is marked HELD_BY_KRA, its number stays on record, and the KRA
// number counter moves up to it, so the next invoice gets the number after it.
// Nothing is sent to KRA. Every change is written to backend/kra-manual-decisions.log.
// Dry run by default. Usage:
//   node scripts/close-kra-held.js INV-2026-000043 --note "Order ORD-1795437954136, KRA holds 43, receipt unknown"
//   node scripts/close-kra-held.js INV-2026-000043 --note "..." --apply
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../db');

const arg = name => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : null;
};

(async () => {
    const invoiceNumber = process.argv[2];
    const note = (arg('--note') || '').trim();
    const apply = process.argv.includes('--apply');
    const pin = (process.env.KRA_PIN || '').toUpperCase();

    if (!invoiceNumber || !invoiceNumber.startsWith('INV-') || note.length < 10) {
        console.log('Usage: node scripts/close-kra-held.js INV-2026-000043 --note "<why, at least 10 characters>" [--apply]');
        process.exit(1);
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const inv = (
            await client.query(
                `SELECT i.id, i.merchant_id, i.branch_id, i.invoice_number, i.fiscalization_status, i.kra_invc_no
                 FROM invoices i
                 JOIN merchants me ON me.id = i.merchant_id
                 WHERE UPPER(me.kra_pin) = $1 AND i.invoice_number = $2
                 FOR UPDATE`,
                [pin, invoiceNumber]
            )
        ).rows[0];

        if (!inv) throw new Error(`${invoiceNumber} not found for ${pin}. Nothing changed.`);
        if (inv.fiscalization_status !== 'NEEDS_CHECK') {
            throw new Error(`${invoiceNumber} is ${inv.fiscalization_status}, not NEEDS_CHECK. Nothing changed.`);
        }
        if (inv.kra_invc_no == null) throw new Error(`${invoiceNumber} holds no KRA number. Nothing changed.`);

        const codes = (
            await client.query(
                `SELECT response_payload->>'resultCd' AS code FROM fiscalization_attempts WHERE invoice_id = $1`,
                [inv.id]
            )
        ).rows.map(r => r.code);

        if (codes.includes('000')) {
            throw new Error(`${invoiceNumber} was accepted by KRA (000). Do not close it this way. Nothing changed.`);
        }
        if (!codes.some(c => c === '924' || c === '994')) {
            throw new Error(`KRA has not said it holds ${invoiceNumber} (no 924 or 994 on record). Nothing changed.`);
        }

        const kraNo = Number(inv.kra_invc_no);
        const seq = (
            await client.query(
                `SELECT last_kra_invc_no FROM invoice_sequences
                 WHERE merchant_id = $1 AND branch_id IS NOT DISTINCT FROM $2`,
                [inv.merchant_id, inv.branch_id || null]
            )
        ).rows[0];

        console.log(`${invoiceNumber}: NEEDS_CHECK -> HELD_BY_KRA (KRA number ${kraNo} kept)`);
        console.log(`KRA number counter: ${seq ? seq.last_kra_invc_no : 'not set'} -> ${
            seq && seq.last_kra_invc_no != null && Number(seq.last_kra_invc_no) > kraNo ? seq.last_kra_invc_no + ' (unchanged)' : kraNo
        }`);
        console.log(`Note: ${note}`);

        if (!apply) {
            await client.query('ROLLBACK');
            console.log('\nDry run. Nothing was changed. Add --apply to write.');
            process.exit(0);
        }

        await client.query(
            `UPDATE invoices SET fiscalization_status = 'HELD_BY_KRA', updated_at = now() WHERE id = $1`,
            [inv.id]
        );
        await client.query(
            `UPDATE invoice_sequences
             SET last_kra_invc_no = GREATEST(COALESCE(last_kra_invc_no, 0), $1), updated_at = now()
             WHERE merchant_id = $2 AND branch_id IS NOT DISTINCT FROM $3`,
            [kraNo, inv.merchant_id, inv.branch_id || null]
        );

        await client.query('COMMIT');

        const line = `${new Date().toISOString()}  ${invoiceNumber}  KRA number ${kraNo}  HELD_BY_KRA  ${note}\n`;
        fs.appendFileSync(path.join(__dirname, '../kra-manual-decisions.log'), line);

        console.log('\nApplied. Recorded in backend/kra-manual-decisions.log.');
        process.exit(0);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error.message);
        process.exit(1);
    } finally {
        client.release();
    }
})();
