// Read-only. Finds a buyer in the database and prints the details needed to recreate
// the account on another server. Password hashes and encrypted values are NOT printed.
//
// Usage (from C:\etims\backend):
//   node scripts\find-buyer.js rambim
//   node scripts\find-buyer.js tobosorodney75@gmail.com
//   node scripts\find-buyer.js 254722596733
//
// Changes nothing in the database.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../db');
const C = require('../services/cryptoService');

(async () => {
    const term = process.argv[2];

    if (!term) {
        throw new Error('Usage: node scripts\\find-buyer.js NAME_OR_EMAIL_OR_PHONE');
    }

    const like = `%${term.trim()}%`;
    const phoneHash = C.phoneOk(C.norm(term)) ? C.phoneHash(C.norm(term)) : null;

    const users = (
        await db.query(
            `SELECT u.id, u.email, u.full_name, u.status, u.created_at, u.phone_encrypted,
                    b.id AS buyer_id, b.kra_pin, b.*
             FROM users u
             LEFT JOIN buyers b ON b.user_id = u.id
             WHERE u.full_name ILIKE $1
                OR u.email ILIKE $1
                OR u.phone_hash = $2
                OR u.id IN (
                    SELECT b2.user_id FROM buyers b2
                    JOIN buyer_phones bp ON bp.buyer_id = b2.id
                    WHERE bp.phone_hash = $2
                )
             ORDER BY u.created_at`,
            [like, phoneHash]
        )
    ).rows;

    if (users.length === 0) {
        console.log('\nNo buyer matches "' + term + '".\n');
        return;
    }

    for (const u of users) {
        const phones = (
            await db.query(
                `SELECT phone_encrypted, status, verified_at
                 FROM buyer_phones
                 WHERE buyer_id = $1
                 ORDER BY created_at`,
                [u.buyer_id]
            )
        ).rows;

        const mainPhone = u.phone_encrypted ? C.dec(u.phone_encrypted) : null;

        console.log('\n----------------------------------------');
        console.log('Name:          ' + (u.full_name || '(none)'));
        console.log('Email:         ' + (u.email || '(none)'));
        console.log('Main phone:    ' + (mainPhone ? C.mask(mainPhone) + '  (full number: ' + mainPhone + ')' : '(none)'));
        console.log('Account status: ' + u.status);
        console.log('Created:       ' + u.created_at);
        console.log('Buyer profile: ' + (u.buyer_id ? 'yes' : 'NO BUYER PROFILE'));

        if (u.buyer_id) {
            // Print all non-sensitive buyer columns
            const skip = new Set(['id', 'user_id', 'buyer_id', 'email', 'full_name', 'status', 'created_at', 'phone_encrypted', 'password_hash']);
            for (const [key, value] of Object.entries(u)) {
                if (skip.has(key) || value === null || value === undefined || /hash|encrypted|token|secret/i.test(key)) continue;
                console.log(`${key.padEnd(15)} ${value}`);
            }
        }

        console.log('Phone records: ' + (phones.length ? '' : 'none'));
        for (const p of phones) {
            const full = C.dec(p.phone_encrypted);
            console.log(`  ${full}  status=${p.status}  verified=${p.verified_at || 'no'}`);
        }
    }

    console.log('\n----------------------------------------\n');
})()
    .catch(error => {
        console.log('\nERR ' + error.message + '\n');
        process.exitCode = 1;
    })
    .finally(() => setTimeout(() => process.exit(process.exitCode || 0), 300));
