const r = require('express').Router();
const db = require('../db');
const mpesa = require('../services/mpesaService');
const tx = require('../services/transactionService');
const wrap = require('../middleware/wrap');

const fail = (message, status) =>
    Object.assign(new Error(message), { status });

r.post('/c2b/validation', (q, s) => {
    s.json({
        ResultCode: 0,
        ResultDesc: 'Accepted'
    });
});

r.post('/c2b/confirmation', wrap(async (q, s) => {
    const body = q.body || {};
    const transId = String(body.TransID || '').trim();
    const shortcode = String(body.BusinessShortCode || '').trim();
    const billRef = String(body.BillRefNumber || '').trim();
    const amount = Number(body.TransAmount);

    if (!transId) {
        return s.status(400).json({
            ResultCode: 1,
            ResultDesc: 'Missing transaction ID'
        });
    }

    if (!shortcode || !Number.isFinite(amount) || amount <= 0) {
        return s.status(400).json({
            ResultCode: 1,
            ResultDesc: 'Invalid transaction details'
        });
    }

    const timestamp = String(body.TransTime || '');

    const transTime = /^\d{14}$/.test(timestamp)
        ? `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}+03:00`
        : null;

    let matchedPaymentId = null;

    try {
        await db.tx(async c => {
            const existingResult = await c.query(
                `SELECT
                    mt.id AS transaction_id,
                    p.id AS payment_id,
                    p.status AS payment_status
                 FROM mpesa_transactions mt
                 LEFT JOIN payments p
                    ON p.mpesa_transaction_id = mt.id
                 WHERE mt.trans_id = $1
                 ORDER BY p.created_at DESC NULLS LAST
                 LIMIT 1`,
                [transId]
            );

            const existing = existingResult.rows[0];

            if (existing) {
                if (existing.payment_status === 'MATCHED') {
                    matchedPaymentId = existing.payment_id;
                }

                return;
            }

            const merchantResult = await c.query(
                `SELECT merchant_id
                 FROM mpesa_connections
                 WHERE business_shortcode = $1
                   AND status IN ('ACTIVE', 'PENDING')
                 LIMIT 1`,
                [shortcode]
            );

            const merchant = merchantResult.rows[0];

            if (!merchant) {
                throw fail('Unknown M-Pesa shortcode', 400);
            }

            const transactionResult = await c.query(
                `INSERT INTO mpesa_transactions (
                    trans_id,
                    merchant_id,
                    business_shortcode,
                    bill_ref_number,
                    amount,
                    trans_time,
                    payer_ref,
                    payer_name,
                    raw_callback
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING id, merchant_id`,
                [
                    transId,
                    merchant.merchant_id,
                    shortcode,
                    billRef || null,
                    amount,
                    transTime,
                    body.MSISDN || null,
                    [
                        body.FirstName,
                        body.MiddleName,
                        body.LastName
                    ].filter(Boolean).join(' ') || null,
                    body
                ]
            );

            const transaction = transactionResult.rows[0];

            if (!billRef) {
                await c.query(
                    `INSERT INTO payments (
                        merchant_id,
                        mpesa_transaction_id,
                        payment_method,
                        amount,
                        currency,
                        status,
                        match_method,
                        payment_reference,
                        paid_at
                     )
                     VALUES (
                        $1, $2, 'MPESA_C2B', $3, 'KES',
                        'UNMATCHED', 'NO_BILL_REF', $4, $5
                     )`,
                    [
                        transaction.merchant_id,
                        transaction.id,
                        amount,
                        transId,
                        transTime
                    ]
                );

                return;
            }

            const saleResult = await c.query(
                `SELECT id, total_amount
                 FROM sales
                 WHERE merchant_id = $1
                   AND order_reference = $2
                   AND status = 'AWAITING_PAYMENT'
                 LIMIT 1
                 FOR UPDATE`,
                [transaction.merchant_id, billRef]
            );

            const sale = saleResult.rows[0];

            if (!sale) {
                await c.query(
                    `INSERT INTO payments (
                        merchant_id,
                        mpesa_transaction_id,
                        payment_method,
                        amount,
                        currency,
                        status,
                        match_method,
                        payment_reference,
                        paid_at
                     )
                     VALUES (
                        $1, $2, 'MPESA_C2B', $3, 'KES',
                        'UNMATCHED', 'BILL_REF_NOT_FOUND', $4, $5
                     )`,
                    [
                        transaction.merchant_id,
                        transaction.id,
                        amount,
                        billRef,
                        transTime
                    ]
                );

                return;
            }

            const expected = Number(sale.total_amount);
            const status = Math.abs(expected - amount) < 0.01
                ? 'MATCHED'
                : 'AMOUNT_MISMATCH';

            const matchMethod = status === 'MATCHED'
                ? 'BILL_REF_AND_AMOUNT'
                : 'BILL_REF_AMOUNT_MISMATCH';

            const paymentResult = await c.query(
                `INSERT INTO payments (
                    merchant_id,
                    sale_id,
                    mpesa_transaction_id,
                    payment_method,
                    amount,
                    currency,
                    status,
                    match_method,
                    payment_reference,
                    paid_at
                 )
                 VALUES (
                    $1, $2, $3, 'MPESA_C2B', $4, 'KES',
                    $5, $6, $7, $8
                 )
                 RETURNING id`,
                [
                    transaction.merchant_id,
                    sale.id,
                    transaction.id,
                    amount,
                    status,
                    matchMethod,
                    billRef,
                    transTime
                ]
            );

            if (status === 'MATCHED') {
                matchedPaymentId = paymentResult.rows[0].id;
            }
        });
    } catch (error) {
        console.error(
            'C2B confirmation processing failed:',
            error.message
        );

        return s.status(500).json({
            ResultCode: 1,
            ResultDesc: 'Transaction processing failed'
        });
    }

    if (matchedPaymentId) {
        try {
            await tx.processMatchedPayment(matchedPaymentId);
        } catch (error) {
            console.error(
                'Matched payment processing failed:',
                error.message
            );

            return s.status(500).json({
                ResultCode: 1,
                ResultDesc: 'Matched payment processing failed'
            });
        }
    }

    return s.json({
        ResultCode: 0,
        ResultDesc: 'Accepted'
    });
}));

r.get('/payments', wrap(async (q, s) => {
    const result = await db.query(
        `SELECT
            p.*,
            mt.trans_id,
            mt.business_shortcode,
            mt.bill_ref_number,
            mt.payer_name,
            mt.trans_time
         FROM payments p
         LEFT JOIN mpesa_transactions mt
            ON mt.id = p.mpesa_transaction_id
         ORDER BY p.created_at DESC
         LIMIT 200`
    );

    s.json({
        payments: result.rows
    });
}));

r.post('/c2b/register', wrap(async (q, s) => {
    const shortcode = String(q.body?.shortcode || '').trim();

    if (!/^\d{5,7}$/.test(shortcode)) {
        throw fail('Invalid shortcode', 400);
    }

    const result = await mpesa.registerUrls(shortcode);

    if (!result.ok) {
        throw fail(result.error || 'Daraja registration failed', 502);
    }

    s.json(result);
}));

module.exports = r;
