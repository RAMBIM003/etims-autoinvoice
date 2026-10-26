const base = () =>
    process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';

async function token() {
    const k = process.env.MPESA_CONSUMER_KEY;
    const s = process.env.MPESA_CONSUMER_SECRET;

    if (!k || !s) {
        throw new Error('Daraja credentials are not configured');
    }

    const r = await fetch(
        base() + '/oauth/v1/generate?grant_type=client_credentials',
        {
            headers: {
                Authorization:
                    'Basic ' + Buffer.from(`${k}:${s}`).toString('base64')
            }
        }
    );

    const j = await r.json().catch(() => ({}));

    if (!r.ok || !j.access_token) {
        throw new Error('Daraja authorization failed');
    }

    return j.access_token;
}

// Daraja rejects callback URLs containing words like "mpesa",
// so the paths use /api/pay/c2b
const callbackPath = kind => '/api/pay/c2b/' + encodeURIComponent(process.env.MPESA_CALLBACK_TOKEN || '') + '/' + kind;

async function registerUrls(shortcode) {
    const pub = process.env.PUBLIC_BASE_URL;

    if (!pub) {
        return { ok: false, error: 'PUBLIC_BASE_URL is not set' };
    }

    try {
        const r = await fetch(base() + '/mpesa/c2b/v2/registerurl', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + (await token()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ShortCode: shortcode,
                ResponseType: 'Completed',
                ConfirmationURL: pub + callbackPath('confirmation'),
                ValidationURL: pub + callbackPath('validation')
            })
        });

        const j = await r.json().catch(() => ({}));

        return r.ok &&
            (j.ResponseCode === '0' ||
                /success/i.test(j.ResponseDescription || ''))
            ? { ok: true }
            : {
                  ok: false,
                  error: String(
                      j.errorMessage ||
                          j.ResponseDescription ||
                          'Daraja rejected the registration'
                  ).slice(0, 200)
              };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// Sandbox only. Needs the C2B URLs to be registered first; Daraja then sends
// the confirmation callback to our registered URL. The sandbox simulator
// takes whole-shilling amounts.
async function simulateC2B({ shortcode, amount, billRef }) {
    try {
        const r = await fetch(base() + '/mpesa/c2b/v1/simulate', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + (await token()),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ShortCode: Number(shortcode),
                CommandID: 'CustomerPayBillOnline',
                Amount: Math.round(Number(amount)),
                Msisdn: '254708374149',
                BillRefNumber: String(billRef)
            })
        });

        const j = await r.json().catch(() => ({}));

        return r.ok
            ? { ok: true, response: j }
            : {
                  ok: false,
                  error: String(
                      j.errorMessage ||
                          j.ResponseDescription ||
                          'Daraja rejected the simulation'
                  ).slice(0, 200)
              };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

module.exports = { registerUrls, simulateC2B, callbackPath };
