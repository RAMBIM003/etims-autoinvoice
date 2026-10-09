require('dotenv').config();

async function main() {
  const e = process.env;

  const url =
    (e.OSCU_BASE_URL || '') +
    (e.OSCU_CHECK_PATH || '/selectCodeList');

  console.log('OSCU URL:', url);
  console.log('KRA PIN:', e.KRA_PIN);
  console.log('Branch ID:', e.KRA_BRANCH_ID);
  console.log('Device Serial:', e.KRA_DEVICE_SERIAL);
  console.log('CMC Key configured:', !!e.KRA_CMC_KEY);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      tin: e.KRA_PIN,
      bhfId: e.KRA_BRANCH_ID,
      cmcKey: e.KRA_CMC_KEY
    },
    body: JSON.stringify({
      tin: e.KRA_PIN,
      bhfId: e.KRA_BRANCH_ID,
      lastReqDt: '20180523000000'
    })
  });

  const text = await response.text();

  console.log('\nHTTP STATUS:', response.status);
  console.log('KRA RESPONSE:');
  console.log(text);
}

main().catch(err => {
  console.error('\nOSCU TEST ERROR:');
  console.error(err);
  process.exit(1);
});
