let tok = null;
let exp = 0;

const fail = (m, status) =>
  Object.assign(new Error(m), { status });

async function token() {
  if (tok && Date.now() < exp) return tok;

  const k = process.env.KRA_CONSUMER_KEY;
  const s = process.env.KRA_CONSUMER_SECRET;
  const url = process.env.KRA_TOKEN_URL;

  if (!k || !s) {
    throw fail('KRA credentials are not configured', 500);
  }

  if (!url || !/^https?:\/\//i.test(url)) {
    throw fail('KRA_TOKEN_URL is missing or invalid', 500);
  }

  const r = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization:
        'Basic ' + Buffer.from(`${k}:${s}`).toString('base64'),
      Accept: 'application/json'
    }
  });

  const raw = await r.text();

  console.log('KRA TOKEN HTTP:', r.status);

  let j = {};
  try {
    j = raw ? JSON.parse(raw) : {};
  } catch {
    j = {};
  }

  if (!r.ok || !j.access_token) {
    throw fail(
      j.Message ||
      j.message ||
      j.error_description ||
      raw ||
      `KRA authorization failed (HTTP ${r.status})`,
      502
    );
  }

  tok = j.access_token;

  exp =
    Date.now() +
    (Number(j.expires_in || 3600) - 60) * 1000;

  return tok;
}

/*
 * Test PINs are listed in KRA_TEST_PINS (comma separated) in .env, never in the code.
 * A listed PIN is accepted without asking KRA, so a test account can be created.
 * Every use is logged. Remove the PIN from .env when testing is finished.
 */
function testPins() {
  return String(process.env.KRA_TEST_PINS || '')
    .split(',')
    .map(p => p.trim().toUpperCase())
    .filter(Boolean);
}

function isTestPin(pin) {
  return testPins().includes(String(pin || '').trim().toUpperCase());
}

async function validatePin(pin) {
  if (isTestPin(pin)) {
    const p = String(pin).trim().toUpperCase();
    console.warn('TEST KRA PIN accepted without a KRA check:', p);
    return {
      valid: true,
      unavailable: false,
      test: true,
      pin: p,
      name: 'Test taxpayer',
      type: 'Test',
      status: 'Active (test PIN)',
      code: 'TEST',
      message: 'Accepted as a test PIN by server configuration',
      raw: { test: true }
    };
  }

  const url = process.env.KRA_PIN_CHECK_URL;

  if (!url || !/^https?:\/\//i.test(url)) {
    throw fail('KRA_PIN_CHECK_URL is missing or invalid', 500);
  }

  const call = async t =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + t
      },
      body: JSON.stringify({
        KRAPIN: String(pin).trim().toUpperCase()
      })
    });

  let r = await call(await token());

  if (r.status === 401) {
    tok = null;
    r = await call(await token());
  }

  const raw = await r.text();

  console.log('KRA PIN CHECK HTTP:', r.status);

  let j = {};
  try {
    j = raw ? JSON.parse(raw) : {};
  } catch {
    j = {};
  }

  /*
   * KRA sandbox PIN Checker may not contain the real taxpayer
   * PIN used by the sandbox OSCU configuration.
   *
   * 19005 therefore means the PIN could not be verified by
   * the sandbox checker. It must not automatically be treated
   * as proof that the taxpayer PIN is invalid.
   */
  if (j.ResponseCode === '19005' || j.ErrorCode === '19005') {
    return {
      valid: false,
      unavailable: true,
      code: '19005',
      message: j.Message || j.ErrorMessage || 'PIN could not be verified by the KRA sandbox PIN Checker',
      raw: j
    };
  }

  if (!r.ok || !j.PINDATA) {
    throw fail(
      j.Message ||
      j.message ||
      j.ErrorMessage ||
      j.error_description ||
      `KRA PIN check failed (HTTP ${r.status})`,
      502
    );
  }

  const d = j.PINDATA;

  return {
    valid: true,
    unavailable: false,
    pin: d.KRAPIN,
    name: d.Name,
    type: d.TypeOfTaxpayer,
    status: d.StatusOfPIN,
    code: j.ResponseCode,
    message: j.Message,
    raw: j
  };
}

module.exports = {
  isTestPin,
  validatePin
};
