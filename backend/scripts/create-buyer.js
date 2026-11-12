// Creates one complete buyer account, using the same code paths as the app's sign-up
// and M-Pesa linking, so the stored values match what the app would write.
//
// Usage (from the backend folder on the server, or C:\etims\backend locally):
//   node scripts\create-buyer.js --name "Rodney Rambim" --email tobosorodney75@gmail.com --phone 254722596733 --mpesa-name "Rodney Rambim" --last3 733
//   add --apply to actually write the records; without it, nothing is changed.
//   add --release-merchant to free the phone from a merchant account in the same step.
//
// Optional: --pin A123456789Z (KRA PIN; leave out to store an empty PIN, as the local record does)
//
// The password is asked for in the terminal. It is hashed, never printed or stored in plain form.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../db');
const C = require('../services/cryptoService');
const buyerLink = require('../services/buyerLinkService');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
// --release-merchant: if the phone is held by a merchant (not a buyer), remove it from
// that account first. Both steps run in one transaction, so it either all happens or none.
const releaseMerchant = args.includes('--release-merchant');
const opt = name => {
    const i = args.indexOf('--' + name);
    return i >= 0 ? args[i + 1] : null;
};

const fail = message => {
    throw new Error(message);
};

// Reads a line from the terminal without showing what is typed.
function askHidden(question) {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        rl._writeToOutput = () => {};
        process.stdout.write(question);
        rl.question('', answer => {
            rl.close();
            process.stdout.write('\n');
            resolve(answer);
        });
    });
}

(async () => {
    const name = String(opt('name') || '').trim();
    const email = String(opt('email') || '').trim().toLowerCase();
    const phoneRaw = String(opt('phone') || '');
    const mpesaName = String(opt('mpesa-name') || name).trim();
    const last3Raw = String(opt('last3') || '').trim();
    const pin = opt('pin') ? String(opt('pin')).trim().toUpperCase() : '';

    if (!name) fail('Missing --name');
    if (!email || !email.includes('@')) fail('Missing or invalid --email');
    if (!C.phoneOk(phoneRaw)) fail('--phone must be a Kenyan mobile number, for example 254722596733');
    if (!/^\d{3}$/.test(last3Raw)) fail('--last3 must be the last three digits of the M-Pesa line, for example 733');
    if (pin && !/^[AP]\d{9}[A-Z]$/.test(pin)) fail('--pin must look like A123456789Z');

    const phone = C.norm(phoneRaw);
    const phoneHash = C.phoneHash(phone);

    // Refuse if anything already uses the email or phone.
    const clashes = (
        await db.query(
            `SELECT 'email' AS what FROM users WHERE email = $1
             UNION ALL
             SELECT 'phone' FROM users u WHERE u.phone_hash = $2
                AND (NOT $4::boolean OR EXISTS (SELECT 1 FROM buyers b WHERE b.user_id = u.id))
             UNION ALL
             SELECT 'phone' FROM buyer_phones WHERE phone_hash = $2
             UNION ALL
             SELECT 'pin' FROM buyers WHERE kra_pin = $3 AND $3 <> ''`,
            [email, phoneHash, pin, releaseMerchant]
        )
    ).rows;

    if (clashes.length) {
        fail('Already in use: ' + [...new Set(clashes.map(c => c.what))].join(', ') + '. Nothing was changed.');
    }

    const password = await askHidden('Password for the new buyer (at least 8 characters): ');
    if (password.length < 8) fail('Password must be at least 8 characters. Nothing was changed.');

    const passwordHash = await bcrypt.hash(password, 10);
    const encryptedPhone = C.enc(phone);
    const key = buyerLink.nameKey(mpesaName);

    console.log('\nWill create:');
    console.log('  Name:        ' + name);
    console.log('  Email:       ' + email);
    console.log('  Phone:       ' + C.mask(phone));
    console.log('  KRA PIN:     ' + (pin || '(empty)'));
    console.log('  M-Pesa name: ' + mpesaName);
    console.log('  M-Pesa last3:' + last3Raw);

    if (!apply) {
        console.log('\nDRY RUN. Nothing was changed. Run the same command with --apply to create the buyer.\n');
        return;
    }

    await db.tx(async c => {
        if (releaseMerchant) {
            const freed = await c.query(
                `UPDATE users SET phone_hash = NULL, phone_encrypted = NULL
                 WHERE phone_hash = $1
                   AND NOT EXISTS (SELECT 1 FROM buyers b WHERE b.user_id = users.id)`,
                [phoneHash]
            );
            if (freed.rowCount) console.log('Released the number from its merchant account.');
        }

        const user = (
            await c.query(
                `INSERT INTO users (email, full_name, password_hash, phone_hash, phone_encrypted, status)
                 VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
                 RETURNING id`,
                [email, name, passwordHash, phoneHash, encryptedPhone]
            )
        ).rows[0];

        const buyer = (
            await c.query(
                `INSERT INTO buyers (
                    user_id, kra_pin, kra_taxpayer_name, consent_at,
                    mpesa_name, mpesa_name_key, mpesa_last3, mpesa_consent_at
                 )
                 VALUES ($1, $2, $3, now(), $4, $5, $6, now())
                 RETURNING id`,
                [user.id, pin, name, mpesaName, key, last3Raw]
            )
        ).rows[0];

        await c.query(
            `INSERT INTO buyer_phones (buyer_id, phone_hash, phone_encrypted, msisdn_sha256, verified_at)
             VALUES ($1, $2, $3, $4, now())`,
            [buyer.id, phoneHash, encryptedPhone, buyerLink.phoneHash(phone)]
        );

        await c.query(
            `INSERT INTO consent_records (user_id, subject_type, subject_id, purpose, policy_version, action)
             VALUES ($1, 'BUYER', $2, 'MPESA_NAME_LINKING', 'v1', 'GRANTED')`,
            [user.id, buyer.id]
        );
    });

    console.log('\nDone. Buyer created. The buyer can now sign in with the email or phone and the password entered.\n');
})()
    .catch(error => {
        console.log('\nERR ' + error.message + '\n');
        process.exitCode = 1;
    })
    .finally(() => setTimeout(() => process.exit(process.exitCode || 0), 300));
