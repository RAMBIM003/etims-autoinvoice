require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const base = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';
const [hook, passkey] = process.argv.slice(2);
(async () => {
  const auth = 'Basic ' + Buffer.from(process.env.MPESA_CONSUMER_KEY + ':' + process.env.MPESA_CONSUMER_SECRET).toString('base64');
  const token = (await (await fetch(base + '/oauth/v1/generate?grant_type=client_credentials', { headers: { Authorization: auth } })).json()).access_token;
  const ts = new Date(Date.now() + 3*3600*1000).toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  const sc = '174379';
  const body = { BusinessShortCode: sc, Password: Buffer.from(sc + passkey + ts).toString('base64'), Timestamp: ts, TransactionType: 'CustomerPayBillOnline', Amount: 1, PartyA: '254708374149', PartyB: sc, PhoneNumber: '254708374149', CallBackURL: hook, AccountReference: 'TEST', TransactionDesc: 'Callback test' };
  const r = await fetch(base + '/mpesa/stkpush/v1/processrequest', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  console.log(r.status, (await r.text()).replace(/\s+/g,' ').slice(0,300));
  process.exit(0);
})().catch(e => { console.log('ERR', e.cause || e.message); process.exit(1); });
