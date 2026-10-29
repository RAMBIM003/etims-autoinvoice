// One-off admin tool: create a merchant account directly in the DB,
// bypassing phone-OTP verification and the live OSCU/KRA connectivity
// check that /api/merchant/register normally requires.
//
// Usage:
//   node scripts/create-merchant-manual.js "<email>" "<fullName>" "<phone>" "<password>" "<tradingName>" ["<kraPin>"]
//
// kraPin is optional; if omitted a placeholder is generated (format
// matches KRA's A/P + 9 digits + letter) since merchants.kra_pin is
// NOT NULL UNIQUE. Edit it later from the dashboard once you have a
// real one.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');
const C = require('../services/cryptoService');

const [, , email, fullName, phone, password, tradingName, kraPinArg] = process.argv;

if (!email || !fullName || !phone || !password || !tradingName) {
  console.error(
    'Usage: node scripts/create-merchant-manual.js "<email>" "<fullName>" "<phone>" "<password>" "<tradingName>" ["<kraPin>"]'
  );
  process.exit(1);
}

if (!C.phoneOk(phone)) {
  console.error('Phone number is not a valid Kenyan number (07xx/01xx or +254...).');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const randPlaceholderPin = () =>
  'A' + String(Math.floor(100000000 + Math.random() * 900000000)) + 'Z';

const kraPin = (kraPinArg || randPlaceholderPin()).toUpperCase();
if (!/^[AP]\d{9}[A-Z]$/.test(kraPin)) {
  console.error('kraPin must match format: A/P + 9 digits + letter, e.g. A123456789Z');
  process.exit(1);
}

const bhf = process.env.KRA_BRANCH_ID || '00';

(async () => {
  const out = await db.tx(async (c) => {
    const u = (
      await c.query(
        'INSERT INTO users(email,full_name,password_hash,phone_hash,phone_encrypted) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [
          email.trim().toLowerCase(),
          fullName.trim(),
          await bcrypt.hash(password, 10),
          C.phoneHash(phone),
          C.enc(C.norm(phone)),
        ]
      )
    ).rows[0];

    const m = (
      await c.query(
        "INSERT INTO merchants(trading_name,kra_pin,kra_status,business_phone,business_type) VALUES($1,$2,'UNVERIFIED',$3,'RETAIL') RETURNING id",
        [tradingName.trim(), kraPin, C.norm(phone)]
      )
    ).rows[0];

    await c.query(
      "INSERT INTO merchant_users(merchant_id,user_id,role) VALUES($1,$2,'OWNER')",
      [m.id, u.id]
    );

    const br = (
      await c.query(
        "INSERT INTO merchant_branches(merchant_id,branch_code,branch_name,kra_bhf_id,is_head_office) VALUES($1,'HQ','Head office',$2,true) RETURNING id",
        [m.id, bhf]
      )
    ).rows[0];

    await c.query(
      "INSERT INTO merchant_onboarding(merchant_id,current_step,status) VALUES($1,'ITEMS','IN_PROGRESS')",
      [m.id]
    );

    await c.query(
      "INSERT INTO kra_connections(merchant_id,branch_id,environment,kra_pin,bhf_id,status,last_result) VALUES($1,$2,$3,$4,$5,'NOT_CONNECTED','Created manually; not yet verified against OSCU')",
      [m.id, br.id, process.env.KRA_ENV || 'SANDBOX', kraPin, bhf]
    );

    await c.query(
      "INSERT INTO consent_records(user_id,subject_type,subject_id,purpose,policy_version,action) VALUES($1,'MERCHANT',$2,'ACCOUNT_TERMS','v1','GRANTED')",
      [u.id, m.id]
    );

    return { uid: u.id, mid: m.id };
  });

  console.log('Created user', out.uid, 'and merchant', out.mid);
  console.log('KRA PIN on file:', kraPin, kraPinArg ? '' : '(placeholder — update it later)');
  await db.pool.end();
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
