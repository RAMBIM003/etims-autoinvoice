// Changes a buyer's registered phone number in the local database.
//
// Usage (from C:\etims\backend):
//   node scripts\change-buyer-phone.js OLD NEW                          dry run, changes nothing
//   node scripts\change-buyer-phone.js OLD NEW --apply                  makes the change
//   node scripts\change-buyer-phone.js OLD NEW --release-merchant --apply
//       also removes NEW from the merchant account that currently holds it
//       (the merchant keeps email sign-in, but loses phone sign-in and its phone number)
//
// The phone is stored twice (a keyed hash for lookups and an encrypted copy for SMS),
// so the change is made through the app's own crypto service rather than raw SQL.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../db');
const C = require('../services/cryptoService');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const releaseMerchant = args.includes('--release-merchant');
const [oldRaw, newRaw] = args.filter(a => !a.startsWith('--'));

const fail = message => {
    throw new Error(message);
};

(async () => {
    if (!oldRaw || !newRaw) {
        fail('Usage: node scripts\\change-buyer-phone.js OLD_NUMBER NEW_NUMBER [--release-merchant] [--apply]');
    }

    const oldN = C.norm(oldRaw);
    const newN = C.norm(newRaw);

    if (!C.phoneOk(oldN) || !C.phoneOk(newN)) {
        fail('Both numbers must be Kenyan mobile numbers, for example 254722596733');
    }

    if (oldN === newN) {
        fail('The old and new numbers are the same');
    }

    const oldHash = C.phoneHash(oldN);
    const newHash = C.phoneHash(newN);

    const buyerUser = (
        await db.query(
            'SELECT id, email, full_name FROM users WHERE phone_hash = $1',
            [oldHash]
        )
    ).rows[0];

    const buyerPhones = (
        await db.query(
            'SELECT id, buyer_id, status FROM buyer_phones WHERE phone_hash = $1',
            [oldHash]
        )
    ).rows;

    if (!buyerUser && buyerPhones.length === 0) {
        fail(`No buyer account is registered with ${C.mask(oldN)}`);
    }

    // Who currently holds the new number?
    const holderBuyerPhone = (
        await db.query('SELECT id FROM buyer_phones WHERE phone_hash = $1', [newHash])
    ).rows[0];

    const holder = (
        await db.query(
            `SELECT u.id, u.email, u.full_name,
                    EXISTS (SELECT 1 FROM buyers b WHERE b.user_id = u.id) AS is_buyer,
                    (SELECT m.trading_name
                     FROM merchant_users mu
                     JOIN merchants m ON m.id = mu.merchant_id
                     WHERE mu.user_id = u.id AND mu.status = 'ACTIVE'
                     LIMIT 1) AS merchant_name
             FROM users u
             WHERE u.phone_hash = $1`,
            [newHash]
        )
    ).rows[0];

    if (holderBuyerPhone) {
        fail(`${C.mask(newN)} is already a buyer's phone number, so it cannot be used`);
    }

    if (holder && holder.is_buyer) {
        fail(`${C.mask(newN)} belongs to a buyer account, so it cannot be used`);
    }

    if (holder && !releaseMerchant) {
        fail(
            `${C.mask(newN)} belongs to ${holder.full_name || holder.email} ` +
            `(merchant: ${holder.merchant_name || 'none'}). ` +
            'Run again with --release-merchant to free it from that account.'
        );
    }

    console.log('\nCurrent records');
    console.log('  buyer users row:   ' + (buyerUser ? `${buyerUser.full_name || '(no name)'} <${buyerUser.email || 'no email'}>` : 'none'));
    console.log('  buyer_phones rows: ' + (buyerPhones.length ? buyerPhones.map(r => `${r.id} (${r.status})`).join(', ') : 'none'));
    if (holder) {
        console.log(`  number holder:     ${holder.full_name || '(no name)'} <${holder.email || 'no email'}> merchant=${holder.merchant_name || 'none'}`);
        console.log('  WILL BE RELEASED from that account: its phone number is removed');
    }
    console.log(`\nChange: ${C.mask(oldN)}  ->  ${C.mask(newN)}`);

    if (!apply) {
        console.log('\nDRY RUN. Nothing was changed. Run the same command with --apply to make the change.\n');
        return;
    }

    await db.tx(async c => {
        if (holder) {
            await c.query(
                'UPDATE users SET phone_hash = NULL, phone_encrypted = NULL WHERE id = $1',
                [holder.id]
            );
        }

        if (buyerUser) {
            await c.query(
                'UPDATE users SET phone_hash = $1, phone_encrypted = $2 WHERE id = $3',
                [newHash, C.enc(newN), buyerUser.id]
            );
        }

        await c.query(
            `UPDATE buyer_phones
             SET phone_hash = $1, phone_encrypted = $2
             WHERE phone_hash = $3`,
            [newHash, C.enc(newN), oldHash]
        );
    });

    console.log('\nDone. The buyer now uses ' + C.mask(newN) + '.' +
        (holder ? ' The number was removed from ' + (holder.full_name || holder.email) + '.' : '') + '\n');
})()
    .catch(error => {
        console.log('\nERR ' + error.message + '\n');
        process.exitCode = 1;
    })
    .finally(() => setTimeout(() => process.exit(process.exitCode || 0), 300));
