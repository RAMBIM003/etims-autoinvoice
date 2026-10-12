const db = require('../db');
const C = require('./cryptoService');
const receipts = require('./receiptService');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

const kes = value =>
    Number(value || 0).toLocaleString('en-KE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

// Same transport as the OTP messages: Africa's Talking when configured,
// otherwise the text is printed in the backend terminal.
async function sendSms(to, text) {
    if (process.env.SMS_PROVIDER !== 'africastalking') {
        console.log(`\n[DEV SMS to ${to}] ${text}\n`);
        return { provider: 'dev-log', messageId: null };
    }

    const sandbox = process.env.AT_USERNAME === 'sandbox';

    const response = await fetch(
        `https://api${sandbox ? '.sandbox' : ''}.africastalking.com/version1/messaging`,
        {
            method: 'POST',
            headers: {
                apiKey: process.env.AT_API_KEY,
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                username: process.env.AT_USERNAME,
                to: '+' + to,
                message: text,
                ...(process.env.AT_SENDER_ID && { from: process.env.AT_SENDER_ID })
            })
        }
    );

    const data = await response.json().catch(() => ({}));
    const recipient = data.SMSMessageData?.Recipients?.[0];

    const accepted =
        response.ok &&
        recipient &&
        (Number(recipient.statusCode) === 101 ||
            /success/i.test(recipient.status || ''));

    if (!accepted) {
        throw fail(
            `SMS provider rejected the message${recipient?.status ? ': ' + recipient.status : ''}`,
            502
        );
    }

    return { provider: 'africastalking', messageId: recipient.messageId || null };
}

async function registeredPhone(buyerId) {
    if (!buyerId) {
        return null;
    }

    const row = (
        await db.query(
            `SELECT phone_encrypted
             FROM buyer_phones
             WHERE buyer_id = $1
               AND status = 'ACTIVE'
             ORDER BY verified_at DESC NULLS LAST, created_at DESC
             LIMIT 1`,
            [buyerId]
        )
    ).rows[0];

    return row ? C.dec(row.phone_encrypted) : null;
}

// Sends the receipt summary and private link for a fiscalized invoice.
// options.phone  : send to this number instead of the buyer's registered one
// options.auto   : automatic send after signing; skipped if one already went out
async function sendReceiptSms(invoiceId, options = {}) {
    const inv = (
        await db.query(
            `SELECT i.id, i.invoice_number, i.seller_name, i.seller_pin,
                    i.total_amount, i.tax_amount, i.kra_receipt_number,
                    i.fiscalization_status, i.sale_id, s.buyer_id,
                    (SELECT mt.trans_id
                     FROM payments p
                     JOIN mpesa_transactions mt ON mt.id = p.mpesa_transaction_id
                     WHERE p.sale_id = i.sale_id
                       AND p.status = 'MATCHED'
                     ORDER BY p.created_at DESC
                     LIMIT 1) AS trans_id
             FROM invoices i
             JOIN sales s ON s.id = i.sale_id
             WHERE i.id = $1`,
            [invoiceId]
        )
    ).rows[0];

    if (!inv) {
        throw fail('Invoice not found', 404);
    }

    if (inv.fiscalization_status !== 'FISCALIZED') {
        throw fail('The receipt is not ready yet', 409);
    }

    const to = options.phone
        ? C.norm(options.phone)
        : await registeredPhone(inv.buyer_id);

    if (!to) {
        throw fail('No phone number is available for this receipt', 400);
    }

    if (!C.phoneOk(to)) {
        throw fail('Enter a valid Kenyan mobile number', 400);
    }

    const { url } = await receipts.ensureReceipt(inv.id);

    const receipt = (
        await db.query(`SELECT id FROM receipts WHERE invoice_id = $1`, [inv.id])
    ).rows[0];

    if (!receipt) {
        throw fail('Receipt record not found', 404);
    }

    if (options.auto) {
        const already = (
            await db.query(
                `SELECT 1 FROM receipt_sms_deliveries WHERE receipt_id = $1 LIMIT 1`,
                [receipt.id]
            )
        ).rows[0];

        if (already) {
            return { skipped: true };
        }
    } else {
        const recent = (
            await db.query(
                `SELECT 1
                 FROM receipt_sms_deliveries
                 WHERE receipt_id = $1
                   AND created_at > now() - interval '60 seconds'
                 LIMIT 1`,
                [receipt.id]
            )
        ).rows[0];

        if (recent) {
            throw fail('A receipt SMS was just sent. Wait a minute before sending another.', 429);
        }
    }

    const message =
        `${String(inv.seller_name || 'Receipt').slice(0, 20)} ${inv.seller_pin}. ` +
        `Inv ${inv.invoice_number} KES ${kes(inv.total_amount)} (VAT ${kes(inv.tax_amount)}). ` +
        `KRA receipt ${inv.kra_receipt_number || '-'}. ` +
        `${inv.trans_id ? 'M-Pesa ' + inv.trans_id + '. ' : ''}` +
        `Receipt: ${url}`;

    const delivery = (
        await db.query(
            `INSERT INTO receipt_sms_deliveries (
                receipt_id, phone_encrypted, provider, status, message
             )
             VALUES ($1, $2, $3, 'PENDING', $4)
             RETURNING id`,
            [
                receipt.id,
                C.enc(to),
                process.env.SMS_PROVIDER || 'dev-log',
                message
            ]
        )
    ).rows[0];

    try {
        const result = await sendSms(to, message);

        await db.query(
            `UPDATE receipt_sms_deliveries
             SET status = 'SENT',
                 provider = $1,
                 provider_message_id = $2,
                 sent_at = now(),
                 updated_at = now()
             WHERE id = $3`,
            [result.provider, result.messageId, delivery.id]
        );

        return { status: 'SENT', provider: result.provider, to: C.mask(to) };
    } catch (error) {
        await db.query(
            `UPDATE receipt_sms_deliveries
             SET status = 'FAILED',
                 error_message = $1,
                 updated_at = now()
             WHERE id = $2`,
            [error.message, delivery.id]
        );

        throw error;
    }
}

module.exports = { sendSms, sendReceiptSms };
