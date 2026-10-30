require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const base = (process.env.OSCU_BASE_URL || 'https://etims-api-sbx.kra.go.ke/etims-api').replace(/\/+$/, '');
const h = { tin: process.env.KRA_PIN, bhfId: process.env.KRA_BRANCH_ID || '00', cmcKey: process.env.KRA_CMC_KEY };
const pin = process.argv[2];
fetch(base + '/selectCustomer', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ ...h, custmTin: pin }) })
  .then(r => r.json()).then(j => console.log(JSON.stringify(j).slice(0, 400)))
  .catch(e => console.log('ERR', e.message));
