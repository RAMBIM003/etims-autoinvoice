// Read-only. Shows which account(s) a phone number belongs to.
//
// Usage (from C:\etims\backend):
//   node scripts\find-phone-owner.js 254722596733
//
// Changes nothing in the database.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../db');
const C = require('../services/cryptoService');

(async () => {
    const raw = process.argv[2];

    if (!raw) {
        throw new Error('Usage: node scripts\\find-phone-owner.js 254XXXXXXXXX');
    }

    const hash = C.phoneHash(C.norm(raw));
    console.log('\nPhone ' + C.mask(C.norm(raw)) + '\n');

    const users = (
        await db.query(
            `SELECT u.id, u.email, u.full_name, u.status, u.created_at,
                    EXISTS (SELECT 1 FROM buyers b WHERE b.user_id = u.id) AS is_buyer,
                    (SELECT m.trading_name
                     FROM merchant_users mu
                     JOIN merchants m ON m.id = mu.merchant_id
                     WHERE mu.user_id = u.id AND mu.status = 'ACTIVE'
                     LIMIT 1) AS merchant_name
             FROM users u
             WHERE u.phone_hash = $1`,
            [hash]
        )
    ).rows;

    const buyerPhones = (
        await db.query(
            `SELECT bp.id, bp.status, bp.buyer_id, b.user_id, u.email, u.full_name
             FROM buyer_phones bp
             JOIN buyers b ON b.id = bp.buyer_id
             JOIN users u ON u.id = b.user_id
             WHERE bp.phone_hash = $1`,
            [hash]
        )
    ).rows;

    console.log('Main user account(s):');
    console.log(users.length ? users.map(u => `  ${u.full_name || '(no name)'} <${u.email || 'no email'}>  status=${u.status}  buyer=${u.is_buyer}  merchant=${u.merchant_name || 'none'}  created=${u.created_at}`).join('\n') : '  none');

    console.log('\nBuyer phone record(s):');
    console.log(buyerPhones.length ? buyerPhones.map(p => `  ${p.full_name || '(no name)'} <${p.email || 'no email'}>  phone status=${p.status}`).join('\n') : '  none');

    console.log('');
})()
    .catch(error => {
        console.log('\nERR ' + error.message + '\n');
        process.exitCode = 1;
    })
    .finally(() => setTimeout(() => process.exit(process.exitCode || 0), 300));
