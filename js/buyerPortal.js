(function () {
    const $ = i => document.getElementById(i);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
    const money = v => Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const ST = {
        AWAITING_PAYMENT: ['Awaiting payment', 'warn'], PAYMENT_RECEIVED: ['Payment received', 'warn'],
        FISCALIZING: ['Signing with KRA', 'warn'], RECEIPT_READY: ['Receipt ready', 'ok'],
        FISCALIZATION_FAILED: ['KRA signing failed', 'bad'], PAYMENT_MISMATCH: ['Amount mismatch', 'bad'], CANCELLED: ['Cancelled', 'bad']
    };
    const END = ['RECEIPT_READY', 'FISCALIZATION_FAILED', 'PAYMENT_MISMATCH', 'CANCELLED'];
    const PAID = ['PAYMENT_RECEIVED', 'FISCALIZING', 'RECEIPT_READY', 'FISCALIZATION_FAILED'];
    const TABS = [['overview', 'Overview', 'chart'], ['merchants', 'Merchants', 'store'], ['purchases', 'Purchases', 'cart'], ['receipts', 'Receipts', 'file']];
    const S = { tab: 'overview', orders: [], mid: null, items: [], oid: null, timer: null, sim: 'off', who: null, err: null, auth: false };
    const hint = 'Please <a href="log.html">sign in</a> or <a href="sign_buyer.html">register as a buyer</a> first.';

    async function call(path, o = {}) {
        const h = { ...(o.headers || {}) };
        if (localStorage.token) h.Authorization = 'Bearer ' + localStorage.token;
        if (o.body) h['Content-Type'] = 'application/json';
        let r;
        try { r = await fetch(API.BASE + path, { ...o, headers: h }); } catch { throw new Error('Cannot reach the API. Start the backend with npm start.'); }
        const d = await r.json().catch(() => ({}));
        if (r.status === 401) { const e = new Error('Please sign in with a buyer account first.'); e.auth = true; throw e; }
        if (!r.ok) throw new Error(d.error || 'Request failed (' + r.status + ')');
        return d;
    }

    const view = h => { $('view').innerHTML = h; };
    const pill = s => { const [l, c] = ST[s] || [s, '']; return `<span class="pill ${c}">${esc(l)}</span>`; };
    const kpi = (t, v, ic, c) => `<div class="kpi"><span class="ic" style="background:${c}1a;color:${c}">${Charts.icon(ic)}</span><div><small>${t}</small><b>${v}</b></div></div>`;
    const sum = (a, f) => a.reduce((t, o) => t + Number(f(o) || 0), 0);

    async function loadOrders() {
        S.err = null; S.auth = false;
        if (!localStorage.token) { S.orders = []; S.auth = true; return; }
        try { S.orders = (await call('/buyer-app/orders')).orders || []; }
        catch (e) { S.orders = []; S.auth = !!e.auth; S.err = e.message; }
    }

    const banner = () => S.auth ? `<div class="error">${hint}</div>` : S.err ? `<div class="error">${esc(S.err)}</div>` : '';

    function table(rows) {
        if (!rows.length) return '<div class="empty">No purchases yet.</div>';
        return `<table><thead><tr><th>Reference</th><th>Merchant</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(o => `<tr>
            <td class="mono">${esc(o.order.order_reference)}</td><td>${esc(o.order.merchant_name)}</td><td>KES ${money(o.order.total_amount)}</td><td>${pill(o.stage)}</td>
            <td>${o.stage === 'RECEIPT_READY' && o.receipt_url ? `<a href="${esc(o.receipt_url)}" target="_blank" rel="noopener">View receipt</a>` : END.includes(o.stage) ? '' : `<button class="secondary" data-open="${esc(o.order.id)}">Open</button>`}</td></tr>`).join('')}</tbody></table>`;
    }

    // ---------- Overview ----------
    async function overview() {
        view('<div class="loading">Loading...</div>');
        await loadOrders();
        const O = S.orders, paid = O.filter(o => PAID.includes(o.stage)), rc = O.filter(o => o.stage === 'RECEIPT_READY');
        const D = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
        const same = (a, b) => new Date(a).toDateString() === b.toDateString();
        const spend = D.map(d => sum(paid.filter(o => same(o.order.created_at, d)), o => o.order.total_amount));
        const cnt = D.map(d => O.filter(o => same(o.order.created_at, d)).length);
        const g = {};
        O.filter(o => o.stage !== 'CANCELLED').forEach(o => { g[o.order.merchant_name] = (g[o.order.merchant_name] || 0) + 1; });
        const pal = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#dc2626', '#0891b2'];
        const parts = Object.keys(g).map((k, i) => ({ n: esc(k), v: g[k], c: pal[i % pal.length] }));
        const first = S.who ? esc(S.who.name.split(' ')[0]) : '';

        view(`<div class="hello"><h1>Hello${first ? ', ' + first : ''}!</h1><p class="muted">Your purchases, payments and eTIMS receipts in one place.</p></div>${banner()}
        <div class="kpis">${kpi('Purchases', O.length, 'cart', '#2563eb')}${kpi('Total paid', 'KES ' + money(sum(paid, o => o.order.total_amount)), 'card', '#16a34a')}${kpi('VAT on receipts', 'KES ' + money(sum(rc, o => o.order.tax_amount)), 'file', '#f59e0b')}${kpi('Receipts ready', rc.length, 'check', '#7c3aed')}</div>
        <div class="charts"><section class="panel"><h3>Spending, last 7 days</h3><div id="c1"></div><div class="muted" style="font-size:12px"><i class="dot" style="background:#2563eb"></i>Paid (KES) <i class="dot" style="background:#16a34a;margin-left:12px"></i>Purchases</div></section>
        <section class="panel"><h3>Purchases by merchant</h3><div id="c2"></div></section></div>
        <section class="panel"><h3>Recent purchases</h3>${table(O.slice(0, 5))}</section>`);

        Charts.bars($('c1'), D.map(d => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })), spend, cnt);
        Charts.donut($('c2'), parts, 'purchases');
        wireOpen();
    }

    // ---------- Merchants ----------
    async function merchants() {
        view('<div class="loading">Loading...</div>');
        try {
            const M = (await call('/buyer/merchants')).merchants || [];
            view(`<h1>Merchants</h1><p class="muted">Choose where you are buying from.</p>
            <div class="mgrid" id="mg">${M.map(m => `<button class="mcard ${m.id === S.mid ? 'on' : ''}" data-m="${esc(m.id)}"><b>${esc(m.trading_name)}</b><br><small>${m.connection_type === 'TILL' ? 'Till' : 'Paybill'} ${esc(m.business_shortcode || '')}</small></button>`).join('') || '<div class="empty">No merchants yet.</div>'}</div>
            <section class="panel" id="shop" style="margin-top:16px" hidden></section>`);
            $('mg').onclick = e => {
                const b = e.target.closest('[data-m]');
                if (!b) return;
                S.mid = b.dataset.m;
                document.querySelectorAll('.mcard').forEach(x => x.classList.toggle('on', x === b));
                shop(b.querySelector('b').textContent);
            };
            if (S.mid) { const b = document.querySelector(`[data-m="${S.mid}"]`); if (b) shop(b.querySelector('b').textContent); }
        } catch (e) { view(`<div class="error">${esc(e.message)}</div>`); }
    }

    async function shop(name) {
        const box = $('shop');
        box.hidden = false;
        box.innerHTML = '<div class="loading">Loading items...</div>';
        const d = await call('/buyer/merchants/' + encodeURIComponent(S.mid) + '/items');
        S.items = (d.items || []).map(x => ({ ...x, qty: 0 }));
        box.innerHTML = `<h3>Items from ${esc(name)}</h3><div class="grid" id="cat"></div><div id="cart" style="margin-top:14px"></div><div id="msg"></div>`;
        paintCat();
        $('cat').onclick = e => {
            const b = e.target.closest('button[data-i]');
            if (!b) return;
            const it = S.items[+b.dataset.i];
            it.qty = Math.max(0, it.qty + +b.dataset.d);
            paintCat();
        };
    }

    function paintCat() {
        $('cat').innerHTML = S.items.map((x, i) => `<div class="item"><b>${esc(x.name)}</b><div class="muted">KES ${money(x.unit_price)} / ${esc(x.unit_code)}${+x.tax_rate ? ' + ' + +x.tax_rate + '% VAT' : ''}</div><div class="qty"><button data-i="${i}" data-d="-1">&minus;</button><b>${x.qty}</b><button data-i="${i}" data-d="1">+</button></div></div>`).join('') || '<div class="empty">This merchant has no items yet.</div>';
        const rows = S.items.filter(x => x.qty > 0);
        if (!rows.length) { $('cart').innerHTML = ''; return; }
        let sub = 0, vat = 0;
        rows.forEach(x => { const l = x.qty * +x.unit_price; sub += l; vat += l * +(x.tax_rate || 0) / 100; });
        const total = sub + vat, cents = Math.abs(total - Math.round(total)) > 0.001;
        $('cart').innerHTML = `${rows.map(x => `<div style="display:flex;justify-content:space-between"><span>${esc(x.name)} &times; ${x.qty}</span><span>KES ${money(x.qty * +x.unit_price)}</span></div>`).join('')}
        <div style="display:flex;justify-content:space-between"><span>VAT</span><span>KES ${money(vat)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px"><span>Total</span><span>KES ${money(total)}</span></div>
        ${cents ? '<div class="sandbox">This total includes cents. Real M-Pesa payments are whole shillings, so ask the merchant to round it.</div>' : ''}
        <button class="primary" id="mk" style="margin-top:12px">Create order and get payment details</button>`;
        $('mk').onclick = mkOrder;
    }

    async function mkOrder() {
        const items = S.items.filter(x => x.qty > 0).map(x => ({ item_id: x.id, quantity: x.qty }));
        $('mk').disabled = true;
        try {
            const r = await call('/buyer/orders', { method: 'POST', body: JSON.stringify({ merchant_id: S.mid, items }) });
            S.oid = r.order.id;
            go('purchases');
        } catch (e) { $('msg').innerHTML = `<div class="error">${e.auth ? hint : esc(e.message)}</div>`; $('mk').disabled = false; }
    }

    // ---------- Purchases ----------
    function stop() { clearTimeout(S.timer); S.timer = null; }

    async function purchases() {
        stop();
        view('<h1>Purchases</h1><div id="pay"></div><section class="panel"><h3>Your purchases</h3><div id="tbl" class="loading">Loading...</div></section>');
        await loadOrders();
        $('tbl').className = '';
        $('tbl').innerHTML = S.auth ? hint : S.err ? `<div class="error">${esc(S.err)}</div>` : table(S.orders);
        wireOpen();
        if (S.oid && !S.auth) { try { renderPay(await call(`/buyer-app/orders/${encodeURIComponent(S.oid)}/status`)); poll(); } catch (e) { /* ignore */ } }
    }

    function wireOpen() {
        const t = $('tbl') || $('view');
        t.onclick = e => { const b = e.target.closest('[data-open]'); if (b) { S.oid = b.dataset.open; go('purchases'); } };
    }

    function renderPay(d) {
        const box = $('pay');
        if (!box) return;
        const st = d.stage, bad = ['FISCALIZATION_FAILED', 'PAYMENT_MISMATCH', 'CANCELLED'].includes(st);
        const flags = [true, PAID.includes(st), st === 'RECEIPT_READY', st === 'RECEIPT_READY'];
        const open = flags.indexOf(false);
        const steps = ['Order created', 'Payment received', 'Signed by KRA eTIMS', 'Receipt ready'].map((l, i) => `<div class="step ${flags[i] ? 'done' : i === open && !bad ? 'active' : ''}">${flags[i] ? '&#10003; ' : ''}${l}</div>`).join('');
        const instr = st === 'AWAITING_PAYMENT' ? `<div class="pay"><div><small>${d.pay && d.pay.type === 'TILL' ? 'Till' : 'Paybill'}</small><b>${esc((d.pay && d.pay.shortcode) || 'Merchant shortcode')}</b></div><div><small>Account number</small><b class="mono">${esc(d.pay && d.pay.reference)}</b></div><div><small>Amount (KES)</small><b>${money(d.pay && d.pay.amount)}</b></div></div>
            <div class="notice">Pay with M-Pesa from your phone using these details. This page updates by itself once the merchant receives your payment.</div>
            ${S.sim !== 'off' ? '<div class="sandbox"><b>Sandbox only.</b> In real life you pay from the M-Pesa app. <a href="simulator.html" target="_blank">Open the M-Pesa simulator</a> to send a test payment for this order.</div>' : ''}` : '';
        const out = st === 'RECEIPT_READY' && d.receipt_url ? `<div class="ok">Your eTIMS receipt is ready. <a href="${esc(d.receipt_url)}" target="_blank" rel="noopener">View receipt</a></div>`
            : st === 'FISCALIZATION_FAILED' ? '<div class="error">Your payment was received, but KRA signing did not complete. The merchant can retry; your payment is safe.</div>'
            : st === 'PAYMENT_MISMATCH' ? '<div class="error">The amount paid did not match the order total. Please contact the merchant.</div>'
            : st === 'CANCELLED' ? '<div class="error">This order was cancelled.</div>' : '';
        box.innerHTML = `<section class="panel" style="margin-bottom:16px"><h3>${esc(d.order.merchant_name)} &middot; <span class="mono">${esc(d.order.order_reference)}</span> &middot; KES ${money(d.order.total_amount)}</h3>${instr}<div class="steps">${steps}</div>${out}</section>`;
    }

    async function poll() {
        stop();
        if (S.tab !== 'purchases' || !S.oid) return;
        S.timer = setTimeout(async () => {
            try {
                const d = await call(`/buyer-app/orders/${encodeURIComponent(S.oid)}/status`);
                renderPay(d);
                if (END.includes(d.stage)) { await loadOrders(); if ($('tbl')) { $('tbl').innerHTML = table(S.orders); wireOpen(); } return; }
            } catch (e) { /* keep trying */ }
            poll();
        }, 3000);
    }

    // ---------- Receipts ----------
    async function receipts() {
        view('<h1>Receipts</h1><section class="panel"><div id="rl" class="loading">Loading...</div></section>');
        await loadOrders();
        const R = S.orders.filter(o => o.stage === 'RECEIPT_READY' && o.receipt_url && o.invoice);
        $('rl').className = '';
        $('rl').innerHTML = S.auth ? hint : !R.length ? '<div class="empty">No receipts yet. They appear here once KRA has signed your purchase.</div>' : R.map(o => `<div class="rcard"><div><b>${esc(o.order.merchant_name)}</b> <span class="muted">${esc(o.invoice.number)} &middot; KRA receipt ${esc(o.invoice.kra_receipt_number || '-')}</span><div class="muted">KES ${money(o.order.total_amount)} &middot; VAT KES ${money(o.order.tax_amount)} &middot; ${new Date(o.order.created_at).toLocaleDateString('en-KE')}</div><div id="sm-${esc(o.invoice.id)}"></div></div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><a class="secondary" href="${esc(o.receipt_url)}" target="_blank" rel="noopener">View / Download</a><input id="ph-${esc(o.invoice.id)}" placeholder="Other number (optional)"><button class="primary" data-sms="${esc(o.invoice.id)}">Send to my phone</button></div></div>`).join('');
        $('rl').onclick = async e => {
            const b = e.target.closest('[data-sms]');
            if (!b) return;
            const id = b.dataset.sms, phone = ($('ph-' + id).value || '').trim(), m = $('sm-' + id);
            b.disabled = true;
            m.innerHTML = '<div class="muted">Sending...</div>';
            try {
                const r = await call(`/buyer-app/receipts/${encodeURIComponent(id)}/sms`, { method: 'POST', body: JSON.stringify(phone ? { phone } : {}) });
                m.innerHTML = `<div class="ok">Receipt link sent to ${esc(r.to || 'your phone')}.${r.provider === 'dev-log' ? ' (SMS provider is not configured yet, so the message was only logged on the server.)' : ''}</div>`;
            } catch (x) { m.innerHTML = `<div class="error">${esc(x.message)}</div>`; }
            b.disabled = false;
        };
    }

    // ---------- Shell ----------
    function go(tab) {
        stop();
        S.tab = tab;
        $('title').textContent = TABS.find(t => t[0] === tab)[1];
        document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        ({ overview, merchants, purchases, receipts })[tab]();
    }

    $('nav').innerHTML = TABS.map(t => `<button data-tab="${t[0]}">${Charts.icon(t[2])}${t[1]}</button>`).join('');
    $('nav').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); };
    $('logout').onclick = () => { localStorage.removeItem('token'); location.href = 'log.html'; };

    (async function init() {
        try { S.sim = (await call('/buyer-app/simulation')).mode || 'off'; } catch (e) { S.sim = 'off'; }
        if (localStorage.token) {
            try {
                S.who = await call('/buyer-app/profile');
                $('who').innerHTML = `${esc(S.who.name)}<br><small style="color:#8ea0c4">${esc(S.who.phone_masked || '')}${S.who.pin_masked ? ' &middot; ' + esc(S.who.pin_masked) : ''}</small>`;
            } catch (e) { $('who').textContent = 'Not a buyer account'; }
        } else { $('who').innerHTML = '<a href="log.html" style="color:#fff">Sign in</a>'; }
        go('overview');
    })();
})();
