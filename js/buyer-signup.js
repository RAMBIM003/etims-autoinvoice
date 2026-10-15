localStorage.removeItem('token');

const $ = id => document.getElementById(id);
const say = (text, ok) => { const m = $('msg'); m.textContent = text || ''; m.className = 'msg' + (ok ? ' ok' : ''); };
const phoneValid = v => /^(?:\+?254|0)[17]\d{8}$/.test(String(v || '').replace(/[\s\-()]/g, ''));
const pinValid = v => /^[AP]\d{9}[A-Z]$/.test(String(v || '').trim().toUpperCase());
const nameValid = v => String(v || '').trim().split(/\s+/).filter(Boolean).length >= 2;
const boxes = [...document.querySelectorAll('.otp input')];
const code = () => boxes.map(b => b.value).join('');

let phoneVerified = false;
let kra = null; // set only when a PIN has been connected

const LABELS = {
    phone: 'Phone number verified with a code',
    pin: 'KRA PIN connected, or left blank (optional)',
    name: 'Your name (first and last)',
    password: 'Password of 8+ characters, matching confirmation',
    consent: 'Both consent boxes ticked'
};

const pinTyped = () => $('pin').value.trim() !== '';

function checks() {
    const pw = $('password').value;
    return {
        phone: phoneVerified,
        pin: !pinTyped() || !!kra,
        name: nameValid($('mpesaName').value),
        password: pw.length >= 8 && pw === $('confirm').value,
        consent: $('consent').checked && $('mpesaConsent').checked
    };
}

function refresh() {
    const c = checks();
    $('checklist').innerHTML = Object.keys(LABELS)
        .map(k => `<li class="${c[k] ? 'done' : ''}">${c[k] ? '&#10003;' : '&#9675;'} ${LABELS[k]}</li>`)
        .join('');
    $('create').disabled = !Object.values(c).every(Boolean);
    return c;
}

boxes.forEach((b, i) => {
    b.oninput = () => {
        b.value = b.value.replace(/\D/g, '').slice(0, 1);
        if (b.value && boxes[i + 1]) boxes[i + 1].focus();
    };
    b.onkeydown = e => {
        if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus();
    };
});

$('sendOtp').onclick = async () => {
    say('');
    const phone = $('phone').value.trim();
    if (!phoneValid(phone)) return say('Enter a valid mobile number, e.g. 0712 345 678.');
    $('sendOtp').disabled = true;
    try {
        await API.post('/otp/send', { phone, purpose: 'SIGNUP_BUYER' });
        $('sentTo').textContent = phone;
        $('otpBox').classList.remove('hide');
        boxes[0].focus();
        say('Code sent. In development the code is printed in the backend window.', true);
    } catch (e) {
        say(e.message);
    }
    $('sendOtp').disabled = false;
};
$('resend').onclick = e => { e.preventDefault(); $('sendOtp').click(); };

$('verify').onclick = async () => {
    say('');
    if (code().length < 6) return say('Enter the 6-digit code.');
    try {
        await API.post('/otp/verify', { phone: $('phone').value.trim(), code: code(), purpose: 'SIGNUP_BUYER' });
        phoneVerified = true;
        $('phone').readOnly = true;
        $('sendOtp').disabled = true;
        $('otpBox').classList.add('hide');
        $('pOk').classList.remove('hide');
        say('Phone verified. Next, your name and password.', true);
    } catch (e) {
        say(e.message);
    }
    refresh();
};

$('pin').oninput = () => {
    const v = $('pin').value.trim().toUpperCase();
    if (kra && v !== kra.pin) {
        kra = null;
        $('pin').readOnly = false;
        $('connect').classList.remove('hide');
        $('kraInfo').classList.add('hide');
    }
    $('connect').disabled = !pinValid(v);
    refresh();
};

$('connect').onclick = async () => {
    say('');
    const pin = $('pin').value.trim().toUpperCase();
    $('connect').disabled = true;
    try {
        const r = await API.post('/kra/validate-pin', { pin });
        if (r.status === 'UNAVAILABLE') {
            kra = { pin, name: 'Not verified (sandbox)', status: 'UNVERIFIED' };
        } else if (r.verified) {
            kra = { pin: r.pin || pin, name: r.name, status: r.status };
        } else {
            throw new Error('KRA did not confirm this PIN.');
        }
        $('kraInfo').textContent = `PIN ${kra.pin} · ${kra.name || ''} · ${kra.status || ''}`;
        $('kraInfo').classList.remove('hide');
        $('pin').readOnly = true;
        $('connect').classList.add('hide');
        say('PIN connected.', true);
    } catch (e) {
        $('connect').disabled = false;
        say(e.message);
    }
    refresh();
};

['mpesaName', 'password', 'confirm', 'consent', 'mpesaConsent', 'email'].forEach(id => {
    $(id).addEventListener('input', refresh);
    $(id).addEventListener('change', refresh);
});

$('f').onsubmit = async e => {
    e.preventDefault();
    say('');
    const c = refresh();
    if (!Object.values(c).every(Boolean)) return say('Finish every item in the checklist first.');
    const email = $('email').value.trim();
    if (email && !$('email').checkValidity()) return say('Enter a valid email address or leave it empty.');
    const name = $('mpesaName').value.trim();
    $('create').disabled = true;
    try {
        const r = await API.post('/buyer/register', {
            phone: $('phone').value.trim(),
            pin: kra ? kra.pin : '',
            name,
            consent: true,
            email,
            password: $('password').value
        });
        localStorage.token = r.token;
    } catch (x) {
        say(x.message);
        refresh();
        return;
    }
    try {
        await API.put('/buyer-identity/mpesa', { mpesa_name: name, consent: true });
    } catch (x) {
        // The account exists; the buyer page offers the M-Pesa link again if this step failed.
    }
    location = 'buyer.html';
};

refresh();
