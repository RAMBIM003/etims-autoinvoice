const crypto = require('crypto');
const db = require('../db');
const C = require('./cryptoService');

const tokens = s =>
    String(s || '')
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .toUpperCase()
        .split(/\s+/)
        .filter(Boolean);

const nameKey = s => tokens(s).sort().join(' ');

const last3 = value => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 3 ? digits.slice(-3) : null;
};

// A SHA-256 hex value (64 characters) is a hashed MSISDN.
const isHash = value => /^[a-f0-9]{64}$/i.test(String(value || '').trim());

// SHA-256 of the normalised number, e.g. 254768670493.
const phoneHash = phone =>
    crypto.createHash('sha256').update(C.norm(phone)).digest('hex');

// Fill in hashes for buyer phones registered before migration 009.
async function syncPhoneHashes(c) {
    const rows = (
        await c.query(`SELECT id, phone_encrypted FROM buyer_phones WHERE msisdn_sha256 IS NULL`)
    ).rows;

    for (const r of rows) {
        await c.query(
            `UPDATE buyer_phones SET msisdn_sha256 = $1 WHERE id = $2`,
            [phoneHash(C.dec(r.phone_encrypted)), r.id]
        );
    }
}

// Returns { status, buyerId?, method, detail }.
// status: LINKED | AMBIGUOUS | NONE | NO_DATA
async function findBuyer(c, fullName, msisdn) {
    const key = nameKey(fullName);

    if (isHash(msisdn)) {
        await syncPhoneHashes(c);

        const rows = (
            await c.query(
                `SELECT b.id, b.mpesa_name_key
                 FROM buyer_phones p
                 JOIN buyers b ON b.id = p.buyer_id
                 WHERE p.msisdn_sha256 = $1
                   AND p.status = 'ACTIVE'
                   AND b.mpesa_consent_at IS NOT NULL`,
                [String(msisdn).trim().toLowerCase()]
            )
        ).rows;

        if (rows.length === 1) {
            const sameName = rows[0].mpesa_name_key === key;
            return {
                status: 'LINKED',
                buyerId: rows[0].id,
                method: sameName ? 'HASH_NAME' : 'HASH',
                detail: sameName
                    ? 'phone hash and name match'
                    : 'phone hash matches; name differs, flagged for review'
            };
        }

        if (rows.length > 1) {
            const named = rows.filter(r => r.mpesa_name_key === key);

            if (named.length === 1) {
                return {
                    status: 'LINKED',
                    buyerId: named[0].id,
                    method: 'HASH_NAME',
                    detail: 'several buyers share this phone; name picked one'
                };
            }

            return {
                status: 'AMBIGUOUS',
                method: 'HASH',
                detail: `${rows.length} buyers share this phone; not linked`
            };
        }

        return { status: 'NONE', method: 'HASH', detail: 'no consenting buyer has this phone' };
    }

    // Masked fallback: full name plus last 3 digits.
    const digits = last3(msisdn);

    if (!key || !digits) {
        return { status: 'NO_DATA', method: 'NAME_LAST3', detail: 'payer name or number missing' };
    }

    const rows = (
        await c.query(
            `SELECT id FROM buyers
             WHERE mpesa_name_key = $1
               AND mpesa_last3 = $2
               AND mpesa_consent_at IS NOT NULL`,
            [key, digits]
        )
    ).rows;

    if (rows.length === 1) {
        return {
            status: 'LINKED',
            buyerId: rows[0].id,
            method: 'NAME_LAST3',
            detail: `name and last digits ${digits}`
        };
    }

    if (rows.length > 1) {
        return { status: 'AMBIGUOUS', method: 'NAME_LAST3', detail: `${rows.length} buyers match; not linked` };
    }

    return { status: 'NONE', method: 'NAME_LAST3', detail: 'no buyer matches' };
}

// Runs after a matched payment, before the KRA invoice is signed.
async function linkSaleFromPayment(paymentId) {
    return db.tx(async c => {
        const row = (
            await c.query(
                `SELECT p.sale_id, s.buyer_id, mt.payer_name, mt.payer_ref
                 FROM payments p
                 JOIN sales s ON s.id = p.sale_id
                 LEFT JOIN mpesa_transactions mt ON mt.id = p.mpesa_transaction_id
                 WHERE p.id = $1
                 FOR UPDATE OF s`,
                [paymentId]
            )
        ).rows[0];

        if (!row) {
            return { status: 'NO_PAYMENT', detail: 'payment not found' };
        }

        if (row.buyer_id) {
            return { status: 'ALREADY_LINKED', detail: 'sale already has a buyer' };
        }

        const m = await findBuyer(c, row.payer_name, row.payer_ref);

        if (m.status === 'LINKED') {
            await c.query(
                `UPDATE sales
                 SET buyer_id = $1,
                     buyer_link_method = $2,
                     buyer_link_detail = $3,
                     updated_at = now()
                 WHERE id = $4 AND buyer_id IS NULL`,
                [m.buyerId, m.method, m.detail, row.sale_id]
            );
        } else {
            await c.query(
                `UPDATE sales
                 SET buyer_link_method = $1,
                     buyer_link_detail = $2,
                     updated_at = now()
                 WHERE id = $3`,
                [m.status, m.detail, row.sale_id]
            );
        }

        return m;
    });
}

// Runs when a buyer registers or sets their M-Pesa name: links earlier payments
// that now match this buyer uniquely.
async function relinkForBuyer(buyerId) {
    return db.tx(async c => {
        const candidates = (
            await c.query(
                `SELECT s.id AS sale_id, mt.payer_name, mt.payer_ref,
                        (SELECT i.fiscalization_status
                         FROM invoices i
                         WHERE i.sale_id = s.id
                         ORDER BY i.created_at DESC
                         LIMIT 1) AS invoice_status
                 FROM sales s
                 JOIN payments p ON p.sale_id = s.id AND p.status = 'MATCHED'
                 JOIN mpesa_transactions mt ON mt.id = p.mpesa_transaction_id
                 WHERE s.buyer_id IS NULL
                   AND s.status <> 'CANCELLED'`
            )
        ).rows;

        let linked = 0;

        for (const x of candidates) {
            const m = await findBuyer(c, x.payer_name, x.payer_ref);

            if (m.status !== 'LINKED' || m.buyerId !== buyerId) {
                continue;
            }

            const signed = x.invoice_status === 'FISCALIZED';

            await c.query(
                `UPDATE sales
                 SET buyer_id = $1,
                     buyer_link_method = $2,
                     buyer_link_detail = $3,
                     updated_at = now()
                 WHERE id = $4 AND buyer_id IS NULL`,
                [
                    buyerId,
                    signed ? `${m.method}_AFTER_SIGNING` : m.method,
                    signed
                        ? `${m.detail}; linked after KRA signing, buyer PIN not on invoice`
                        : m.detail,
                    x.sale_id
                ]
            );

            linked += 1;
        }

        return linked;
    });
}

module.exports = {
    linkSaleFromPayment,
    relinkForBuyer,
    findBuyer,
    phoneHash,
    isHash,
    nameKey,
    last3
};