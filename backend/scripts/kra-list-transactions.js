// Read-only. Asks KRA which sales and purchase transactions it holds for this PIN and branch
// since a date. Creates nothing. Use it to see what KRA actually has, e.g. its last invoice number.
//   node scripts/kra-list-transactions.js            (since 2026-11-01)
//   node scripts/kra-list-transactions.js 20261114000000
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

(async () => {
  const lastReqDt = process.argv[2] || '20261101000000';
  const tin = process.env.KRA_PIN;
  const bhfId = process.env.KRA_BRANCH_ID || '01';
  const cmcKey = process.env.KRA_CMC_KEY;
  const base = process.env.OSCU_BASE_URL || 'https://etims-api-sbx.kra.go.ke/etims-api';

  if (!tin || !cmcKey) { console.log('KRA_PIN or KRA_CMC_KEY is missing in .env'); process.exit(1); }

  const body = { tin, bhfId, cmcKey, lastReqDt };
  const response = await fetch(`${base}/selectTrnsPurchaseSalesList`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', tin, bhfId, cmcKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const reply = await response.json().catch(() => ({}));
  console.log(`KRA answered HTTP ${response.status} (records since ${lastReqDt}):`);
  console.log(JSON.stringify(reply, null, 2));
  process.exit(0);
})().catch((e) => { console.error('Request failed:', e.message); process.exit(1); });
