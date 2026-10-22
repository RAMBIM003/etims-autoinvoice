require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const base = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';
const tunnel = (process.argv[2] || '').replace(/\/+$/, '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const auth = 'Basic ' + Buffer.from(process.env.MPESA_CONSUMER_KEY + ':' + process.env.MPESA_CONSUMER_SECRET).toString('base64');
  const tokenRes = await fetch(base + '/oauth/v1/generate?grant_type=client_credentials', { headers: { Authorization: auth } });
  const token = (await tokenRes.json()).access_token;
  console.log('token ok:', !!token);
  const tests = [['600980', 'https://mydomain.com'], ['600978', 'https://mydomain.com'], ['600980', tunnel], ['600978', tunnel]];
  for (const [shortcode, root] of tests) {
    const r = await fetch(base + '/mpesa/c2b/v2/registerurl', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ShortCode: shortcode, ResponseType: 'Completed', ConfirmationURL: root + '/api/pay/c2b/' + encodeURIComponent(process.env.MPESA_CALLBACK_TOKEN || '') + '/confirmation', ValidationURL: root + '/api/pay/c2b/' + encodeURIComponent(process.env.MPESA_CALLBACK_TOKEN || '') + '/validation' }) });
    console.log(shortcode, root, '->', r.status, (await r.text()).replace(/\s+/g, ' ').slice(0, 220));
    await wait(3000);
  }
  process.exit(0);
})().catch(e => { console.log('ERR', e.cause || e.message); process.exit(1); });
