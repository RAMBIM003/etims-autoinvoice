/* buyer.js: buyer dashboard. Same API calls as before:
   /buyer-app/profile, /buyer-app/orders, /buyer-app/receipts/:id/sms, /buyer-identity/mpesa (GET, PUT, DELETE).
   Views: Dashboard, Purchases, Receipts, M-Pesa Link. */
(function () {
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
    const money = v => Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const I = n => Charts.icon(n);
    const show = (id, html) => { $(id).innerHTML = html; };

    const STAGE = {
        AWAITING_PAYMENT: ['Awaiting payment', 'warn'], PAYMENT_RECEIVED: ['Payment received', 'warn'],
        FISCALIZING: ['Signing with KRA', 'warn'], RECEIPT_READY: ['Receipt ready', 'ok'],
        FISCALIZATION_FAILED: ['KRA signing failed', 'bad'], PAYMENT_MISMATCH: ['Amount mismatch', 'bad'],
        CANCELLED: ['Cancelled', 'bad']
    };
    const label = s => (STAGE[s] || [s || ''])[0];
    const pill = s => `<span class="pill ${(STAGE[s] || [])[1] || ''}">${esc(label(s))}</span>`;
    const PAID = ['PAYMENT_RECEIVED', 'FISCALIZING', 'RECEIPT_READY'];
    const BAD = ['FISCALIZATION_FAILED', 'PAYMENT_MISMATCH'];
    const day = t => { const d = new Date(t); return isNaN(d) ? '—' : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }); };
    const ago = t => {
        const s = (Date.now() - new Date(t)) / 1000;
        return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago';
    };
    const hm = t => { const d = new Date(t); return isNaN(d) ? '—' : d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }); };

    async function call(path, o = {}) {
        const h = { ...(o.headers || {}) };
        if (localStorage.token) h.Authorization = 'Bearer ' + localStorage.token;
        if (o.body) h['Content-Type'] = 'application/json';
        let r;
        try { r = await fetch(API.BASE + path, { ...o, headers: h }); }
        catch { throw new Error('Cannot reach the API. Start the backend with npm start.'); }
        const d = await r.json().catch(() => ({}));
        if (r.status === 401) { const e = new Error('Please sign in with a buyer account.'); e.auth = true; throw e; }
        if (!r.ok) throw new Error(d.error || 'Request failed (' + r.status + ')');
        return d;
    }

    const state = { orders: [], notes: [], profile: null, view: 'dashboard', tbl: null };

    /* ---------- Banner illustrations ---------- */
    const glow = '<circle cx="118" cy="62" r="50" fill="#d9162b" opacity=".18"/>';
    const svg = b => `<svg viewBox="0 0 220 120" aria-hidden="true">${glow}${b}</svg>`;
    const ART = {
        home: svg('<rect x="70" y="64" width="16" height="38" rx="4" fill="#e8ebf1"/><rect x="94" y="48" width="16" height="54" rx="4" fill="#e8ebf1"/><rect x="118" y="30" width="16" height="72" rx="4" fill="#e11d2e"/><rect x="142" y="52" width="16" height="50" rx="4" fill="#e8ebf1"/><path d="M66 70l30-18 24-22 40 20" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
        cart: svg('<rect x="88" y="16" width="70" height="90" rx="9" fill="#fff"/><rect x="108" y="9" width="30" height="14" rx="5" fill="#e11d2e"/><rect x="100" y="38" width="46" height="5" rx="2.5" fill="#c9ced8"/><rect x="100" y="52" width="36" height="5" rx="2.5" fill="#c9ced8"/><rect x="100" y="66" width="42" height="5" rx="2.5" fill="#c9ced8"/><circle cx="72" cy="84" r="22" fill="#e11d2e"/><path d="M62 76h6l3 12h11l3-9H70" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
        receipt: svg('<rect x="80" y="12" width="68" height="92" rx="8" fill="#fff"/><rect x="92" y="28" width="44" height="5" rx="2.5" fill="#c9ced8"/><rect x="92" y="42" width="34" height="5" rx="2.5" fill="#c9ced8"/><rect x="92" y="56" width="40" height="5" rx="2.5" fill="#e11d2e"/><circle cx="140" cy="84" r="18" fill="#e11d2e"/><path d="M131 84l6 6 12-13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
        link: svg('<circle cx="74" cy="60" r="24" fill="#fff"/><circle cx="154" cy="60" r="24" fill="#e11d2e"/><path d="M98 60h32" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-dasharray="7 6"/><path d="M66 60l6 6 12-13" fill="none" stroke="#e11d2e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M146 52v16M162 52v16M142 60h24" stroke="#fff" stroke-width="4" stroke-linecap="round"/>')
    };

    /* ---------- Building blocks (same look as the merchant side) ---------- */
    const hero = o => `
        <section class="hero">
            <span class="hero-ic">${I(o.icon)}</span>
            <div class="hero-tx"><small>${o.crumb}</small><h1>${o.title} <em>${o.accent}</em></h1><p>${o.sub}</p></div>
            <div class="hero-art">${ART[o.art || o.icon] || ''}</div>
        </section>`;

    const stat = (l, v, icon, dark) => `<div class="stat"><span class="ic${dark ? ' dk' : ''}">${I(icon)}</span><div><small>${l}</small><b>${v}</b></div></div>`;
    const tile = (icon, dark) => `<span class="tile${dark ? ' dk' : ''}">${I(icon)}</span>`;
    const cp = (v, t) => v ? `<button class="icbtn" type="button" data-copy="${esc(v)}" title="${t}" aria-label="${t}">${I('copy')}</button>` : '';

    function tcard(cfg) {
        const sts = [...new Set(cfg.rows.map(r => r.s).filter(Boolean))];
        return `
        <section class="tcard" id="${cfg.id}">
            <div class="tc-head">
                <span class="tc-ic">${I(cfg.icon)}</span>
                <div><h2>${cfg.title} <span class="tc-n">(${cfg.rows.length})</span></h2><p>${cfg.sub}</p></div>
                <div class="tc-tools">
                    <label class="tc-s">${I('search')}<input class="tc-q" placeholder="${cfg.ph}" aria-label="${cfg.ph}"></label>
                    ${sts.length > 1 ? `<label class="tc-f">${I('filter')}<select class="tc-sel" aria-label="Filter by status"><option value="">All Statuses</option>${sts.map(s => `<option value="${esc(s)}">${esc(label(s))}</option>`).join('')}</select></label>` : ''}
                </div>
            </div>
            <div class="tc-scroll"><table class="tbl"><thead><tr>${cfg.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody class="tc-body"></tbody></table></div>
            <div class="tc-foot"><span class="tc-info"></span><div class="tc-pg"></div></div>
        </section>`;
    }

    function mount(cfg) {
        const root = $(cfg.id), body = root.querySelector('.tc-body');
        const q = root.querySelector('.tc-q'), sel = root.querySelector('.tc-sel');
        const info = root.querySelector('.tc-info'), pg = root.querySelector('.tc-pg');
        const per = cfg.per || 6;
        let page = 1, term = '', st = '';
        const list = () => cfg.rows.filter(r => (!st || r.s === st) && (!term || r.t.toLowerCase().includes(term)));

        function draw() {
            const rows = list(), pages = Math.max(1, Math.ceil(rows.length / per));
            page = Math.min(page, pages);
            const from = (page - 1) * per, slice = rows.slice(from, from + per);

            body.innerHTML = slice.length
                ? slice.map((r, i) => `<tr style="--i:${i}">${r.c().map(c => `<td>${c}</td>`).join('')}</tr>`).join('')
                : `<tr><td colspan="${cfg.cols.length}" class="empty">${cfg.empty || 'Nothing found.'}</td></tr>`;

            info.textContent = rows.length ? `Showing ${from + 1} – ${from + slice.length} of ${rows.length} ${cfg.noun}` : '';

            if (pages < 2) { pg.innerHTML = ''; return; }
            const a = Math.max(1, Math.min(page - 2, pages - 4)), b = Math.min(pages, a + 4);
            let h = `<button class="pg" data-p="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">&lsaquo;</button>`;
            for (let p = a; p <= b; p++) h += `<button class="pg ${p === page ? 'on' : ''}" data-p="${p}">${p}</button>`;
            h += `<button class="pg" data-p="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Next page">&rsaquo;</button>`;
            pg.innerHTML = h;
        }

        pg.onclick = e => { const b = e.target.closest('[data-p]'); if (b && !b.disabled) { page = +b.dataset.p; draw(); } };
        q.oninput = () => { term = q.value.trim().toLowerCase(); page = 1; $('q').value = q.value; draw(); };
        if (sel) sel.onchange = () => { st = sel.value; page = 1; draw(); };
        state.tbl = { setTerm(v) { q.value = v; term = String(v).trim().toLowerCase(); page = 1; draw(); } };
        draw();
    }

    function toast(t, ms) {
        let el = $('toast');
        if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
        el.textContent = t;
        el.classList.add('show');
        clearTimeout(toast.t);
        toast.t = setTimeout(() => el.classList.remove('show'), ms || 1500);
    }

    /* ---------- Notifications (bell dropdown) ---------- */
    const seenAt = () => { try { return +localStorage.buyerNotifSeen || 0; } catch (e) { return 0; } };
    const markSeen = () => { try { localStorage.buyerNotifSeen = Date.now(); } catch (e) {} };

    function buildNotes() {
        state.notes = state.orders.map(o => ({
            t: o.order.created_at,
            ok: PAID.includes(o.stage),
            x: esc(label(o.stage)),
            y: `${esc(o.order.merchant_name)} &middot; KES ${money(o.order.total_amount)}`
        })).sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 12);
        renderNotes();
    }

    function renderNotes() {
        const seen = seenAt(), n = state.notes.filter(e => new Date(e.t) > seen).length;
        const bc = $('bellCount'), nc = $('nCount');
        bc.textContent = n > 9 ? '9+' : n; bc.classList.toggle('hide', !n);
        nc.textContent = n; nc.classList.toggle('hide', !n);
        $('noteList').innerHTML = state.notes.length
            ? state.notes.map(e => `<li class="${new Date(e.t) > seen ? 'unread' : ''}"><span class="ic ${e.ok ? 'good' : 'warnic'}">${I(e.ok ? 'check' : 'alert')}</span><div><b>${e.x}</b><small>${e.y}</small><small>${ago(e.t)}</small></div></li>`).join('')
            : '<li class="none">No activity yet.</li>';
    }

    async function loadOrders() {
        const d = await call('/buyer-app/orders');
        state.orders = d.orders || [];
        buildNotes();
    }

    const pop = $('npop'), bell = $('bell');
    const openNotes = open => {
        pop.classList.toggle('hide', !open);
        bell.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && localStorage.token) loadOrders().catch(() => {});
    };
    bell.onclick = e => { e.stopPropagation(); openNotes(pop.classList.contains('hide')); };
    pop.onclick = e => e.stopPropagation();
    document.addEventListener('click', () => openNotes(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') openNotes(false); });
    $('mar').onclick = () => { markSeen(); renderNotes(); };
    setInterval(() => { if (localStorage.token) loadOrders().catch(() => {}); }, 60000);

    // Copy buttons + "Send to my phone"
    document.addEventListener('click', async e => {
        const c = e.target.closest('[data-copy]');
        if (c) {
            (navigator.clipboard ? navigator.clipboard.writeText(c.dataset.copy) : Promise.reject())
                .then(() => toast('Copied'), () => toast('Copy failed'));
            return;
        }
        const b = e.target.closest('[data-sms]');
        if (!b) return;
        const id = b.dataset.sms, was = b.textContent;
        b.disabled = true;
        b.textContent = 'Sending...';
        try {
            const r = await call(`/buyer-app/receipts/${encodeURIComponent(id)}/sms`, { method: 'POST', body: '{}' });
            toast('Sent to ' + (r.to || 'your phone') + '.', 2600);
        } catch (x) {
            toast(x.message, 4200);
        }
        b.disabled = false;
        b.textContent = was;
    });

    /* ---------- M-Pesa link card (used on Dashboard and M-Pesa Link) ---------- */
    function renderLink(box, l) {
        if (l.linked) {
            box.innerHTML = `<div class="ph"><span class="ic">${I('link')}</span><h3>Your M-Pesa link</h3></div>
                <div class="lk">
                    <p>Name: <b>${esc(l.mpesa_name)}</b> &middot; phone ending <b>${esc(l.phone_last3)}</b></p>
                    <p class="muted">Payments made from this name and number appear in your account. Unlinking affects new payments only.</p>
                    <button class="secondary" id="unlink" type="button">Unlink M-Pesa</button>
                </div>`;
            $('unlink').onclick = async () => {
                if (!confirm('Unlink your M-Pesa name? New payments will no longer appear here.')) return;
                try {
                    await call('/buyer-identity/mpesa', { method: 'DELETE' });
                    await render();
                } catch (e) { toast(e.message, 4200); }
            };
            return;
        }

        box.innerHTML = `<div class="ph"><span class="ic">${I('link')}</span><h3>Link your M-Pesa name</h3></div>
            <div class="lk">
                <p class="muted">Enter your name exactly as it appears on M-Pesa. Payments from this name and your phone number will then appear here.</p>
                <div class="lk-row">
                    <input id="mname" type="text" placeholder="e.g. JOHN DOE" aria-label="M-Pesa name">
                    <button class="primary" id="linkBtn" type="button">Link</button>
                </div>
                <label class="lc"><input type="checkbox" id="lc"><span>Payments made from my M-Pesa name and phone number may be linked to me, so that my receipts and purchases appear in my account. I can remove this link at any time.</span></label>
                <div id="linkMsg" aria-live="polite"></div>
            </div>`;
        $('linkBtn').onclick = async () => {
            const name = $('mname').value.trim();
            if (name.split(/\s+/).filter(Boolean).length < 2) return show('linkMsg', '<div class="error">Enter your full name as it appears on M-Pesa.</div>');
            if (!$('lc').checked) return show('linkMsg', '<div class="error">Tick the consent box to link.</div>');
            try {
                await call('/buyer-identity/mpesa', { method: 'PUT', body: JSON.stringify({ mpesa_name: name, consent: true }) });
                await render();
            } catch (e) { show('linkMsg', `<div class="error">${esc(e.message)}</div>`); }
        };
    }

    /* ---------- Views ---------- */
    const readyOf = () => state.orders.filter(o => o.stage === 'RECEIPT_READY' && o.receipt_url && o.invoice);
    const counts = () => {
        const O = state.orders;
        return {
            total: O.length,
            spent: O.filter(o => PAID.includes(o.stage)).reduce((t, o) => t + Number(o.order.total_amount || 0), 0),
            ready: O.filter(o => o.stage === 'RECEIPT_READY').length,
            waiting: O.filter(o => o.stage === 'AWAITING_PAYMENT').length,
            bad: O.filter(o => BAD.includes(o.stage)).length
        };
    };

    const purchaseRow = o => ({
        s: o.stage,
        t: [o.order.merchant_name, o.order.order_reference, o.order.total_amount, label(o.stage)].join(' '),
        c: () => [`<span class="muted">${day(o.order.created_at)}</span>`,
            `<div class="cell-id">${tile('cart')}<b>${esc(o.order.merchant_name)}</b></div>`,
            `<span class="mono">${esc(o.order.order_reference)}</span>`,
            `<span class="amt">KES ${money(o.order.total_amount)}</span>`, pill(o.stage), cp(o.order.order_reference, 'Copy reference')]
    });
    const PCOLS = ['Date', 'Merchant', 'Reference', 'Total', 'Status', ''];

    const receiptActions = o => `<a class="secondary sm" href="${esc(o.receipt_url)}" target="_blank" rel="noopener">View / Download</a> <button class="primary sm" type="button" data-sms="${esc(o.invoice.id)}">Send to my phone</button>`;

    async function dashboard(root) {
        const l = await call('/buyer-identity/mpesa');
        const k = counts(), O = state.orders, ready = readyOf().slice(0, 3);

        const rl = ready.map(o => `<div class="rl">${tile('receipt')}<div class="meta"><b>${esc(o.order.merchant_name)}</b><small class="muted">${esc(o.invoice.number)} &middot; KES ${money(o.order.total_amount)}</small></div><div class="btns">${receiptActions(o)}</div></div>`).join('');
        const rows = O.slice(0, 5).map((o, i) => `<tr style="--i:${i}"><td class="muted opt">${day(o.order.created_at)}</td><td><div class="cell-id">${tile('cart')}<b>${esc(o.order.merchant_name)}</b></div></td><td class="opt2"><span class="mono">${esc(o.order.order_reference)}</span></td><td><span class="amt">KES ${money(o.order.total_amount)}</span></td><td>${pill(o.stage)}</td></tr>`).join('');

        root.innerHTML = hero({ crumb: 'Buyer / Dashboard', title: 'Your', accent: 'Dashboard', icon: 'home', sub: 'Your receipts, all in one place.' }) +
            `<div class="stats">${stat('Total Purchases', k.total, 'cart')}${stat('Total Spent', 'KES ' + money(k.spent), 'receipt')}${stat('Receipts Ready', k.ready, 'check')}${stat('Needs Attention', k.bad, 'alert', true)}</div>
            <div class="grid2">
                <section class="panel" id="linkCard"></section>
                <section class="panel cq" id="receipts"><div class="ph"><span class="ic">${I('receipt')}</span><h3>Receipts</h3><a href="#receipts">View all &rarr;</a></div>
                    ${rl || '<p class="muted">No receipts yet. They appear once KRA has signed a purchase.</p>'}</section>
            </div>
            <section class="panel cq" id="purchases"><div class="ph"><span class="ic">${I('cart')}</span><h3>Purchases</h3><a href="#purchases">View all &rarr;</a></div>
                ${rows ? `<div class="tc-scroll"><table class="tbl"><thead><tr><th class="opt">Date</th><th>Merchant</th><th class="opt2">Reference</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
                    : '<p class="muted">No purchases yet. Purchases appear here once a merchant payment is matched to your account.</p>'}</section>`;

        renderLink($('linkCard'), l);
    }

    async function purchases(root) {
        const k = counts();
        const cfg = {
            id: 'purchases', icon: 'cart', title: 'Purchases', sub: 'Every purchase and its receipt stage', ph: 'Search purchases...', noun: 'purchases',
            empty: 'No purchases yet. Purchases appear here once a merchant payment is matched to your account.',
            cols: PCOLS, rows: state.orders.map(purchaseRow)
        };
        root.innerHTML = hero({ crumb: 'Buyer / Purchases', title: 'Your', accent: 'Purchases', icon: 'cart', sub: 'Purchases appear here once a merchant payment is matched to your account.' }) +
            `<div class="stats">${stat('Total Purchases', k.total, 'cart')}${stat('Awaiting Payment', k.waiting, 'card')}${stat('Receipts Ready', k.ready, 'check', true)}${stat('Needs Attention', k.bad, 'alert', true)}</div>` + tcard(cfg);
        mount(cfg);
    }

    async function receipts(root) {
        const ready = readyOf();
        const total = ready.reduce((t, o) => t + Number(o.order.total_amount || 0), 0);
        const cfg = {
            id: 'receipts', icon: 'receipt', title: 'Receipts', sub: 'Signed by KRA and ready to download', ph: 'Search receipts...', noun: 'receipts',
            empty: 'No receipts yet. They appear once KRA has signed a purchase.',
            cols: ['Merchant', 'Invoice', 'KRA receipt', 'Total', 'Actions'],
            rows: ready.map(o => ({
                t: [o.order.merchant_name, o.invoice.number, o.invoice.kra_receipt_number, o.order.total_amount].join(' '),
                c: () => [`<div class="cell-id">${tile('receipt')}<b>${esc(o.order.merchant_name)}</b></div>`, `<span class="mono">${esc(o.invoice.number)}</span>`,
                    `<span class="mono">${esc(o.invoice.kra_receipt_number || '-')}</span>`, `<span class="amt">KES ${money(o.order.total_amount)}</span>`, receiptActions(o)]
            }))
        };
        root.innerHTML = hero({ crumb: 'Buyer / Receipts', title: 'Your', accent: 'Receipts', icon: 'receipt', art: 'receipt', sub: 'Receipts appear once KRA has signed a purchase.' }) +
            `<div class="stats">${stat('Receipts Ready', ready.length, 'check')}${stat('Total Value', 'KES ' + money(total), 'receipt', true)}</div>` + tcard(cfg);
        mount(cfg);
    }

    async function mpesa(root) {
        const l = await call('/buyer-identity/mpesa');
        root.innerHTML = hero({ crumb: 'Buyer / M-Pesa Link', title: 'Your', accent: 'M-Pesa Link', icon: 'link', sub: 'Payments made from your M-Pesa name and phone number appear in your account.' }) +
            '<section class="panel" id="linkCard"></section>';
        renderLink($('linkCard'), l);
    }

    /* ---------- Shell + routing ---------- */
    const NAV = [['dashboard', 'Dashboard', 'home', dashboard], ['purchases', 'Purchases', 'cart', purchases],
        ['receipts', 'Receipts', 'receipt', receipts], ['mpesa', 'M-Pesa Link', 'link', mpesa]];

    $('nav').innerHTML = NAV.map(n => `<button data-view="${n[0]}">${I(n[2])}<span>${n[1]}</span><span class="chev">${I('chev')}</span></button>`).join('');
    document.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => go(b.dataset.view); });

    const q = $('q');
    q.oninput = () => {
        if (state.tbl) state.tbl.setTerm(q.value);
        else document.querySelectorAll('#app tbody tr').forEach(tr => { tr.style.display = tr.textContent.toLowerCase().includes(q.value.toLowerCase()) ? '' : 'none'; });
    };

    function go(view) {
        if (location.hash.slice(1) !== view) location.hash = view;
        else render();
    }

    async function render() {
        const root = $('app');
        state.view = NAV.some(n => n[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
        document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
        q.value = ''; state.tbl = null;
        openNotes(false);

        if (!localStorage.token) {
            root.innerHTML = '<section class="panel gate"><p>Please <a href="log.html">sign in</a> or <a href="sign_buyer.html">register as a buyer</a>.</p></section>';
            return;
        }

        root.innerHTML = '<div class="loading">Loading...</div>';
        try {
            if (!state.profile) {
                state.profile = await call('/buyer-app/profile');
                show('who', esc(state.profile.name));
                $('pin').textContent = state.profile.pin_masked || '';
                $('pin').classList.toggle('hide', !state.profile.pin_masked);
            }
            await loadOrders();
            await NAV.find(n => n[0] === state.view)[3](root);
            $('updated').textContent = 'Last updated: ' + hm(new Date());
        } catch (e) {
            root.innerHTML = `<div class="error">${esc(e.message)}</div>`;
            if (e.auth) localStorage.removeItem('token');
        }
    }

    $('logout').onclick = () => { localStorage.removeItem('token'); location = 'log.html'; };
    window.addEventListener('hashchange', render);
    render();
})();