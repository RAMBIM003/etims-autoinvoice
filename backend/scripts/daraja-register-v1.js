require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const base = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';
const [rootRaw, ...codes] = process.argv.slice(2);
const root = String(rootRaw || '').trim().replace(/\/+$/, '');
(async () => {
  const auth = 'Basic ' + Buffer.from(process.env.MPESA_CONSUMER_KEY + ':' + process.env.MPESA_CONSUMER_SECRET).toString('base64');
  const token = (await (await fetch(base + '/oauth/v1/generate?grant_type=client_credentials', { headers: { Authorization: auth } })).json()).access_token;
  console.log('token ok:', !!token);
  for (const code of codes) {
    const r = await fetch(base + '/mpesa/c2b/v1/registerurl', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ShortCode: code, ResponseType: 'Completed', ConfirmationURL: root + '/api/pay/c2b/confirmation', ValidationURL: root + '/api/pay/c2b/validation' }) });
    console.log(code, '->', r.status, (await r.text()).replace(/\s+/g, ' ').slice(0, 160));
    await new Promise(x => setTimeout(x, 2500));
  }
  process.exit(0);
})().catch(e => { console.log('ERR', e.cause || e.message); process.exit(1); });

