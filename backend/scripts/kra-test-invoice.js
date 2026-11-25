// One-off KRA sandbox test: sends a single Diesel invoice with a chosen invcNo.
// Writes nothing to the database. Dry run by default; add --send to submit.
//   node scripts/kra-test-invoice.js 43            (prints the request only)
//   node scripts/kra-test-invoice.js 43 --send     (submits to the sandbox)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

const pad = (n) => String(n).padStart(2, '0');
const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

(async () => {
  const invcNo = Number(process.argv[2]);
  const send = process.argv.includes('--send');

  if (!Number.isInteger(invcNo) || invcNo <= 0) {
    console.log('Give the invoice number to test, as a whole number. Example: node scripts/kra-test-invoice.js 43');
    process.exit(1);
  }

  const env = process.env;
  const tin = env.KRA_PIN;
  const bhf = env.KRA_BRANCH_ID || '01';
  const cmcKey = env.KRA_CMC_KEY;
  const base = env.OSCU_BASE_URL || 'https://etims-api-sbx.kra.go.ke/etims-api';

  if (!tin || !cmcKey) {
    console.log('KRA_PIN or KRA_CMC_KEY is missing in .env');
    process.exit(1);
  }

  const diesel = (await db.query(
    `SELECT i.name, i.unit_price, m.item_cls_code, m.item_code
     FROM items i
     JOIN merchants mc ON mc.id = i.merchant_id AND mc.kra_pin = $1
     JOIN item_kra_mappings m ON m.item_id = i.id AND m.active = true
     WHERE upper(i.name) = 'DIESEL'
       AND i.status = 'ACTIVE'
     ORDER BY i.updated_at DESC
     LIMIT 1`,
    [tin]
  )).rows[0];

  if (!diesel) {
    console.log('No active Diesel item with a KRA code was found.');
    process.exit(1);
  }

  const price = Number(diesel.unit_price);
  const tax = Math.round(price * 0.08 * 100) / 100;
  const total = price + tax;
  const now = stamp();

  const payload = {
    tin,
    bhfId: bhf,
    trdInvcNo: `TEST-DIESEL-${invcNo}`,
    invcNo,
    orgInvcNo: 0,
    custTin: null,
    custNm: null,
    salesTyCd: 'N',
    rcptTyCd: 'S',
    pmtTyCd: '06',
    salesSttsCd: '02',
    cfmDt: now,
    salesDt: now.slice(0, 8),
    stockRlsDt: null,
    cnclReqDt: null,
    cnclDt: null,
    rfdDt: null,
    rfdRsnCd: null,
    totItemCnt: 1,
    taxblAmtA: 0,
    taxblAmtB: 0,
    taxblAmtC: 0,
    taxblAmtD: 0,
    taxblAmtE: price,
    taxRtA: 0,
    taxRtB: 16,
    taxRtC: 0,
    taxRtD: 0,
    taxRtE: 8,
    taxAmtA: 0,
    taxAmtB: 0,
    taxAmtC: 0,
    taxAmtD: 0,
    taxAmtE: tax,
    totTaxblAmt: price,
    totTaxAmt: tax,
    totAmt: total,
    prchrAcptcYn: 'N',
    receipt: {
      custTin: null,
      custMblNo: null,
      rptNo: 1,
      trdeNm: 'Masterclass Solution',
      adrs: null,
      topMsg: null,
      btmMsg: 'Thank you',
      rcptPbctDt: now,
      prchrAcptcYn: 'N'
    },
    remark: null,
    regrId: 'MASTERCLASS',
    regrNm: 'MASTERCLASS',
    modrId: 'MASTERCLASS',
    modrNm: 'MASTERCLASS',
    itemList: [
      {
        itemSeq: 1,
        itemCd: diesel.item_code,
        itemClsCd: diesel.item_cls_code,
        itemNm: diesel.name,
        bcd: null,
        pkgUnitCd: 'NT',
        pkg: 1,
        qtyUnitCd: 'LTR',
        qty: 1,
        prc: price,
        splyAmt: price,
        dcRt: 0,
        dcAmt: 0,
        isrccCd: null,
        isrccNm: null,
        isrcRt: null,
        isrcAmt: null,
        taxTyCd: 'E',
        taxblAmt: price,
        taxAmt: tax,
        totAmt: total
      }
    ]
  };

  console.log(`Diesel item used: ${diesel.name} at KES ${price}, code ${diesel.item_code}`);
  console.log('Request that would be sent:');
  console.log(JSON.stringify(payload, null, 2));

  if (!send) {
    console.log('\nDry run. Nothing was sent. Add --send to submit to the sandbox.');
    process.exit(0);
  }

  const response = await fetch(`${base}/saveTrnsSalesOsdc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', tin, bhfId: bhf, cmcKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  });
  const body = await response.json().catch(() => ({}));
  console.log(`\nKRA answered HTTP ${response.status}:`);
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
})().catch((e) => { console.error('Test failed:', e.message); process.exit(1); });
