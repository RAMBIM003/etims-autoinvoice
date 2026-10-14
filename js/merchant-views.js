/* merchant-views.js: Orders, Items, Payments, Invoices, Branches, Connections, Business Profile
   in the new banner + stat cards + live table layout. Same API calls and element IDs as before.
   Load after merchant-app.js and before merchant-dash.js. */
(function () {
    const A = window.App;
    const I = n => Charts.icon(n);
    const E = v => A.esc(v), M = v => A.money(v);
    const $ = id => document.getElementById(id);
    const PAID = ['PAID', 'FISCALIZATION_PENDING', 'CLOSED'];

    const pretty = s => String(s || '').replaceAll('_', ' ');
    const dt = t => {
        const d = new Date(t);
        return isNaN(d) ? '—' : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) + ', ' +
            d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    };

    /* ---------- Banner illustrations ---------- */
    const glow = '<circle cx="118" cy="62" r="50" fill="#d9162b" opacity=".18"/>';
    const svg = body => `<svg viewBox="0 0 220 120" aria-hidden="true">${glow}${body}</svg>`;
    const ART = {
        home: svg('<rect x="70" y="64" width="16" height="38" rx="4" fill="#e8ebf1"/><rect x="94" y="48" width="16" height="54" rx="4" fill="#e8ebf1"/><rect x="118" y="30" width="16" height="72" rx="4" fill="#e11d2e"/><rect x="142" y="52" width="16" height="50" rx="4" fill="#e8ebf1"/><path d="M66 70l30-18 24-22 40 20" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
        box: svg('<path d="M62 52h58l-6 52H68z" fill="#e11d2e"/><path d="M78 52c0-18 28-18 28 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><rect x="104" y="42" width="66" height="62" rx="8" fill="#e8ebf1"/><rect x="112" y="54" width="50" height="6" rx="3" fill="#b8bfcc"/><g fill="#111"><rect x="116" y="74" width="2" height="18"/><rect x="121" y="74" width="4" height="18"/><rect x="128" y="74" width="2" height="18"/><rect x="133" y="74" width="3" height="18"/><rect x="139" y="74" width="2" height="18"/><rect x="144" y="74" width="4" height="18"/><rect x="151" y="74" width="2" height="18"/></g><circle cx="160" cy="40" r="9" fill="#e11d2e"/>'),
        cart: svg('<rect x="88" y="16" width="70" height="90" rx="9" fill="#fff"/><rect x="108" y="9" width="30" height="14" rx="5" fill="#e11d2e"/><rect x="100" y="38" width="46" height="5" rx="2.5" fill="#c9ced8"/><rect x="100" y="52" width="36" height="5" rx="2.5" fill="#c9ced8"/><rect x="100" y="66" width="42" height="5" rx="2.5" fill="#c9ced8"/><circle cx="72" cy="84" r="22" fill="#e11d2e"/><path d="M62 76h6l3 12h11l3-9H70" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
        card: svg('<rect x="60" y="34" width="100" height="62" rx="10" fill="#fff"/><rect x="60" y="48" width="100" height="14" fill="#111"/><rect x="72" y="74" width="36" height="6" rx="3" fill="#c9ced8"/><rect x="138" y="22" width="44" height="80" rx="9" fill="#e11d2e"/><circle cx="160" cy="62" r="12" fill="#fff"/><path d="M154 62l4.5 4.5L167 58" fill="none" stroke="#e11d2e" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
        file: svg('<rect x="80" y="12" width="68" height="92" rx="8" fill="#fff"/><rect x="92" y="28" width="44" height="5" rx="2.5" fill="#c9ced8"/><rect x="92" y="42" width="34" height="5" rx="2.5" fill="#c9ced8"/><rect x="92" y="56" width="40" height="5" rx="2.5" fill="#e11d2e"/><path d="M146 66l24 9v18c0 16-11 25-24 31-13-6-24-15-24-31V75z" transform="translate(-6 -14) scale(.9)" fill="#e11d2e" stroke="#fff" stroke-width="3"/><path d="M137 84l6 6 12-13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
        pin: svg('<rect x="58" y="62" width="48" height="40" rx="4" fill="#fff"/><path d="M54 62l6-20h44l6 20z" fill="#e11d2e"/><rect x="118" y="70" width="44" height="32" rx="4" fill="#e8ebf1"/><path d="M114 70l5-14h38l5 14z" fill="#111"/><path d="M140 14c-14 0-22 10-22 22 0 14 22 34 22 34s22-20 22-34c0-12-8-22-22-22z" transform="translate(-16 -6) scale(.9)" fill="#e11d2e" stroke="#fff" stroke-width="3"/><circle cx="124" cy="32" r="6" fill="#fff"/>'),
        link: svg('<circle cx="74" cy="60" r="24" fill="#fff"/><circle cx="154" cy="60" r="24" fill="#e11d2e"/><path d="M98 60h32" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-dasharray="7 6"/><path d="M66 60l6 6 12-13" fill="none" stroke="#e11d2e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M146 52v16M162 52v16M142 60h24" stroke="#fff" stroke-width="4" stroke-linecap="round"/>'),
        store: svg('<rect x="70" y="52" width="80" height="52" rx="5" fill="#fff"/><path d="M62 52l9-30h78l9 30z" fill="#e11d2e"/><path d="M88 24v28M110 24v28M132 24v28" stroke="#fff" stroke-width="9"/><rect x="82" y="70" width="26" height="22" rx="3" fill="#111"/><rect x="118" y="70" width="22" height="34" rx="3" fill="#e8ebf1"/>')
    };

    /* ---------- Shared building blocks ---------- */
    const hero = o => `
        <section class="hero">
            <span class="hero-ic">${I(o.icon)}</span>
            <div class="hero-tx"><small>${o.crumb}</small><h1>${o.title} <em>${o.accent}</em></h1><p>${o.sub}</p></div>
            <div class="hero-art">${ART[o.art || o.icon] || ''}</div>
            ${o.action || ''}
        </section>`;

    const stat = (label, val, cap, icon, dark) => `
        <div class="stat"><span class="ic${dark ? ' dk' : ''}">${I(icon)}</span>
        <div><small>${label}</small><b>${val}</b>${cap ? `<em>${cap}</em>` : ''}</div></div>`;

    const idc = (icon, txt) => `<div class="cell-id"><span class="tile">${I(icon)}</span><span class="mono">${E(txt)}</span></div>`;
    const cp = (v, t) => v ? `<button class="icbtn" type="button" data-copy="${E(v)}" title="${t}" aria-label="${t}">${I('copy')}</button>` : '';

    /* Table card: header, search, status filter, dark column row, live rows, pager. */
    function tcard(cfg) {
        const sts = [...new Set(cfg.rows.map(r => r.s).filter(Boolean))];
        return `
        <section class="tcard" id="${cfg.id}">
            <div class="tc-head">
                <span class="tc-ic">${I(cfg.icon)}</span>
                <div><h2>${cfg.title} <span class="tc-n">(${cfg.rows.length})</span></h2><p>${cfg.sub}</p></div>
                <div class="tc-tools">
                    <label class="tc-s">${I('search')}<input class="tc-q" placeholder="${cfg.ph}" aria-label="${cfg.ph}"></label>
                    ${sts.length > 1 ? `<label class="tc-f">${I('filter')}<select class="tc-sel" aria-label="Filter by status"><option value="">All Statuses</option>${sts.map(s => `<option value="${E(s)}">${E(pretty(s))}</option>`).join('')}</select></label>` : ''}
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
                ? slice.map((r, i) => `<tr style="--i:${i}">${r.c(from + i + 1).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')
                : `<tr><td colspan="${cfg.cols.length}" class="empty">${cfg.empty || 'Nothing found.'}</td></tr>`;

            info.textContent = rows.length ? `Showing ${from + 1} – ${from + slice.length} of ${rows.length} ${cfg.noun}` : '';

            if (pages < 2) { pg.innerHTML = ''; return; }
            const a = Math.max(1, Math.min(page - 2, pages - 4)), b = Math.min(pages, a + 4);
            let h = `<button class="pg" data-p="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">&lsaquo;</button>`;
            for (let p = a; p <= b; p++) h += `<button class="pg ${p === page ? 'on' : ''}" data-p="${p}">${p}</button>`;
            h += `<button class="pg" data-p="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Next page">&rsaquo;</button>`;
            pg.innerHTML = h;
        }

        pg.onclick = e => {
            const b = e.target.closest('[data-p]');
            if (b && !b.disabled) { page = +b.dataset.p; draw(); }
        };
        q.oninput = () => { term = q.value.trim().toLowerCase(); page = 1; const top = $('q'); if (top) top.value = q.value; draw(); };
        if (sel) sel.onchange = () => { st = sel.value; page = 1; draw(); };

        A.tbl = { setTerm(v) { q.value = v; term = String(v).trim().toLowerCase(); page = 1; draw(); } };
        draw();
    }

    /* Copy-to-clipboard buttons (reference, transaction id, invoice number, SKU) */
    function toast(t) {
        let el = $('toast');
        if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
        el.textContent = t;
        el.classList.add('show');
        clearTimeout(toast.t);
        toast.t = setTimeout(() => el.classList.remove('show'), 1500);
    }
    document.addEventListener('click', e => {
        const b = e.target.closest('[data-copy]');
        if (!b) return;
        (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject())
            .then(() => toast('Copied'), () => toast('Copy failed'));
    });

    A.ui = { hero, stat, idc, cp, tcard, mount, dt, pretty, ART, I };

    /* ---------- Orders ---------- */
    A.orders = async function (root) {
        const [sd, idata] = await Promise.all([API.sales(), API.items()]);
        this.cache.items = idata.items || [];
        const active = this.cache.items.filter(i => i.status === 'ACTIVE');

        root.innerHTML = hero({ crumb: 'Merchant / Orders', title: 'Your', accent: 'Orders', icon: 'cart', sub: 'Create an order that can be paid using its reference.' }) +
            '<div id="orderStats"></div>' +
            `<section class="panel cform">
                <div class="ph"><span class="ic">${I('plus')}</span><h3>Create Order</h3></div>
                <form id="orderForm">
                    <div class="fgrid">
                        <label>Item
                            <select id="oi" required>${active.map(item => `<option value="${E(item.id)}">${E(item.name)} — KES ${M(item.unit_price)}</option>`).join('')}</select>
                        </label>
                        <label>Quantity
                            <input id="oq" type="number" min="0.01" step="any" value="1" required>
                        </label>
                        <button class="primary" type="submit">Create order</button>
                    </div>
                    <div id="orderMsg" aria-live="polite"></div>
                </form>
            </section>` +
            '<div id="ordersTableContainer"></div>';

        const paint = sales => {
            const awaiting = sales.filter(s => s.status === 'AWAITING_PAYMENT').length;
            const closed = sales.filter(s => s.status === 'CLOSED').length;
            const total = sales.reduce((t, s) => t + Number(s.total_amount || 0), 0);

            $('orderStats').innerHTML = `<div class="stats">${stat('Total Orders', sales.length, '', 'cart')}${stat('Awaiting Payment', awaiting, '', 'card')}${stat('Closed', closed, '', 'check', true)}${stat('Total Value', 'KES ' + M(total), '', 'receipt', true)}</div>`;

            const cfg = {
                id: 'ordersCard', icon: 'cart', title: 'Orders', sub: 'Every order and its payment status', ph: 'Search orders...', noun: 'orders', empty: 'No orders yet.',
                cols: ['Reference', 'Customer', 'Total', 'Status', 'Date', ''],
                rows: sales.map(s => ({
                    s: s.status,
                    t: [s.order_reference, s.customer_name, s.total_amount, s.status].join(' '),
                    c: () => [idc('cart', s.order_reference), E(s.customer_name || 'Customer'), `<span class="amt">KES ${M(s.total_amount)}</span>`, A.pill(s.status), `<span class="muted">${dt(s.created_at)}</span>`, cp(s.order_reference, 'Copy reference')]
                }))
            };
            $('ordersTableContainer').innerHTML = tcard(cfg);
            mount(cfg);
        };
        paint(sd.sales || []);

        $('orderForm').onsubmit = async event => {
            event.preventDefault();
            const message = $('orderMsg');
            const button = event.currentTarget.querySelector('button[type="submit"]');
            button.disabled = true;
            message.textContent = '';

            try {
                const result = await API.createSale({ items: [{ item_id: $('oi').value, quantity: Number($('oq').value) }] });
                message.innerHTML = `<div class="notice">Order <b>${E(result.sale.order_reference)}</b> created for KES ${M(result.sale.total_amount)}. Use the reference as the Paybill account reference.</div>`;
                const fresh = await API.sales();
                paint(fresh.sales || []);
            } catch (error) {
                message.innerHTML = `<div class="error">${E(error.message)}</div>`;
            } finally {
                button.disabled = false;
            }
        };
    };

    /* ---------- Items ---------- */
    A.items = async function (root) {
        const [data, sd] = await Promise.all([API.items(), API.sales().catch(() => ({ sales: [] }))]);
        const L = data.items || [], S = sd.sales || [];
        const act = L.filter(i => i.status === 'ACTIVE').length;
        const value = S.filter(s => PAID.includes(s.status)).reduce((t, s) => t + Number(s.total_amount || 0), 0);

        const cfg = {
            id: 'itemsCard', icon: 'tag', title: 'Items', sub: 'All your products and services', ph: 'Search items...', noun: 'items', empty: 'No items yet.', per: 6,
            cols: ['#', 'Item', 'SKU', 'Unit', 'Price (KES)', 'Tax', 'Status'],
            rows: L.map((item, k) => ({
                s: item.status,
                t: [item.sku, item.name, item.unit_code, item.status].join(' '),
                c: n => [n, `<div class="cell-id"><span class="tile ${k % 2 ? 'dk' : ''}">${E(((item.name || '?').trim()[0] || '?').toUpperCase())}</span><b>${E(item.name)}</b></div>`,
                    `<span class="mono">${E(item.sku || '—')}</span>`, E(item.unit_code), `<span class="amt">${M(item.unit_price)}</span>`, `${M(item.tax_rate || 0)}%`, A.pill(item.status)]
            }))
        };

        root.innerHTML = hero({
            crumb: 'Merchant / Items', title: 'Your', accent: 'Items', icon: 'tag', art: 'box', sub: 'Your merchant product catalogue.',
            action: `<button class="primary hero-btn" type="button" onclick="document.getElementById('newItem').showModal()">${I('plus')}Add Item</button>`
        }) +
            `<div class="stats">${stat('Total Items', L.length, act + ' active', 'box')}${stat('Total Sales Value', 'KES ' + M(value), '', 'receipt')}${stat('Active Items', act, '', 'check')}${stat('Inactive Items', L.length - act, '', 'tag', true)}</div>` +
            tcard(cfg) +
            `<dialog id="newItem" class="dlg">
                <div class="dlg-h"><span class="tc-ic">${I('tag')}</span><h2>Add item</h2></div>
                <form id="itemForm">
                    <label>Item name <input id="in" placeholder="Item name" required></label>
                    <label>SKU <input id="is" placeholder="SKU"></label>
                    <label>Unit code <input id="iu" placeholder="e.g. LTR for litres" required></label>
                    <div class="fgrid2">
                        <label>Unit price <input id="ip" type="number" min="0" step="0.01" placeholder="Unit price" required></label>
                        <label>Tax rate (%) <input id="it" type="number" min="0" step="0.01" value="0"></label>
                    </div>
                    <div id="itemMsg" aria-live="polite"></div>
                    <div class="dlg-f">
                        <button type="button" class="secondary" onclick="document.getElementById('newItem').close()">Cancel</button>
                        <button class="primary" type="submit">Save</button>
                    </div>
                </form>
            </dialog>`;
        mount(cfg);

        $('itemForm').onsubmit = async event => {
            event.preventDefault();
            const message = $('itemMsg');
            try {
                await API.createItem({
                    name: $('in').value.trim(), sku: $('is').value.trim(), unit_code: $('iu').value.trim(),
                    unit_price: Number($('ip').value), tax_rate: Number($('it').value || 0)
                });
                await this.items(root);
            } catch (error) {
                message.innerHTML = `<div class="error">${E(error.message)}</div>`;
            }
        };
    };

    /* ---------- Payments ---------- */
    A.payments = async function (root) {
        const data = await API.payments();
        const P = data.payments || [];
        const count = s => P.filter(p => p.status === s).length;
        const received = P.filter(p => p.status === 'MATCHED').reduce((t, p) => t + Number(p.amount || 0), 0);

        const cfg = {
            id: 'paymentsCard', icon: 'card', title: 'Payments', sub: 'Payment callbacks and their matching results', ph: 'Search payments...', noun: 'payments', empty: 'No payments yet.',
            cols: ['Transaction', 'Reference', 'Amount', 'Status', 'Date', ''],
            rows: P.map(p => ({
                s: p.status,
                t: [p.trans_id, p.payment_reference, p.amount, p.status].join(' '),
                c: () => [idc('card', p.trans_id || '—'), `<span class="mono">${E(p.payment_reference || '—')}</span>`, `<span class="amt">KES ${M(p.amount)}</span>`, A.pill(p.status), `<span class="muted">${dt(p.created_at)}</span>`, cp(p.trans_id, 'Copy transaction ID')]
            }))
        };

        root.innerHTML = hero({ crumb: 'Merchant / Payments', title: 'Your', accent: 'Payments', icon: 'card', sub: 'Payment callbacks and their matching results.' }) +
            `<div class="stats">${stat('Total Payments', P.length, '', 'card')}${stat('Matched', count('MATCHED'), 'KES ' + M(received), 'check')}${stat('Unmatched', count('UNMATCHED'), '', 'alert', true)}${stat('Amount Mismatch', count('AMOUNT_MISMATCH'), '', 'alert', true)}</div>` +
            tcard(cfg);
        mount(cfg);
    };

    /* ---------- Invoices ---------- */
    A.invoices = async function (root) {
        const data = await API.invoices();
        const V = data.invoices || [];
        const done = V.filter(i => i.fiscalization_status === 'FISCALIZED').length;
        const failed = V.filter(i => i.fiscalization_status === 'FAILED').length;

        const cfg = {
            id: 'invoicesCard', icon: 'file', title: 'Invoices', sub: 'Internal invoices and KRA fiscalization status', ph: 'Search invoices...', noun: 'invoices', empty: 'No invoices yet.',
            cols: ['Invoice', 'Order', 'Total', 'Status', 'KRA receipt', ''],
            rows: V.map(i => ({
                s: i.fiscalization_status,
                t: [i.invoice_number, i.sale_id, i.total_amount, i.fiscalization_status, i.kra_receipt_number].join(' '),
                c: () => [idc('file', i.invoice_number), `<span class="mono">${E(i.sale_id)}</span>`, `<span class="amt">KES ${M(i.total_amount)}</span>`, A.pill(i.fiscalization_status),
                    `<span class="mono">${E(i.kra_receipt_number || '—')}</span>`,
                    (i.fiscalization_status === 'FISCALIZED' ? `<button class="secondary sm" type="button" onclick="App.openReceipt('${E(i.id)}')">View receipt</button> ` : '') + cp(i.invoice_number, 'Copy invoice number')]
            }))
        };

        root.innerHTML = hero({ crumb: 'Merchant / Invoices', title: 'Your', accent: 'Invoices', icon: 'file', sub: 'Internal invoices and KRA fiscalization status.' }) +
            `<div class="stats">${stat('Total Invoices', V.length, '', 'file')}${stat('Fiscalized', done, '', 'check')}${stat('Pending', V.length - done - failed, '', 'receipt', true)}${stat('Failed', failed, '', 'alert', true)}</div>` +
            tcard(cfg);
        mount(cfg);
    };

    /* ---------- Branches ---------- */
    A.branches = async function (root) {
        const data = await API.connections();
        const B = data.branches || [];
        const act = B.filter(b => b.status === 'ACTIVE').length;

        const cfg = {
            id: 'branchesCard', icon: 'pin', title: 'Branches', sub: 'Branches associated with the merchant eTIMS connection', ph: 'Search branches...', noun: 'branches', empty: 'No branches yet.',
            cols: ['Branch', 'KRA ID', 'Head office', 'Status'],
            rows: B.map(b => ({
                s: b.status,
                t: [b.branch_name, b.branch_code, b.kra_bhf_id, b.status].join(' '),
                c: () => [`<div class="cell-id"><span class="tile">${I('pin')}</span><b>${E(b.branch_name)}</b><span class="muted">(${E(b.branch_code)})</span></div>`,
                    `<span class="mono">${E(b.kra_bhf_id || '—')}</span>`, b.is_head_office ? '<span class="pill ok">YES</span>' : '<span class="pill">NO</span>', A.pill(b.status)]
            }))
        };

        root.innerHTML = hero({ crumb: 'Merchant / Branches', title: 'Your', accent: 'Branches', icon: 'pin', sub: 'Branches associated with the merchant eTIMS connection.' }) +
            `<div class="stats">${stat('Total Branches', B.length, '', 'pin')}${stat('Active', act, '', 'check')}${stat('Head Office', B.filter(b => b.is_head_office).length, '', 'store', true)}${stat('Inactive', B.length - act, '', 'alert', true)}</div>` +
            tcard(cfg);
        mount(cfg);
    };

    /* ---------- Connections ---------- */
    A.connections = async function (root) {
        const data = await API.connections();
        const firstMpesa = data.mpesa && data.mpesa[0] || null;
        const kra = data.kra || {};

        root.innerHTML = hero({ crumb: 'Merchant / Connections', title: 'Your', accent: 'Connections', icon: 'link', sub: 'Technical credentials remain server-side.' }) +
            `<div class="concards">
                <section class="concard">
                    <div class="cc-top"><span class="ic big">${I('shield')}</span><div><h3>KRA eTIMS</h3>${this.pill(kra.status || 'NOT_CONNECTED')}</div></div>
                    <p class="cc-t">${E(kra.last_result || 'No connection check recorded.')}</p>
                    <div class="cc-kv"><span>KRA PIN</span><b class="mono">${E((data.merchant && data.merchant.kra_pin) || '—')}</b></div>
                    <button class="secondary" id="kraCheck">Check KRA</button>
                    <div id="kraMsg" aria-live="polite"></div>
                </section>
                <section class="concard">
                    <div class="cc-top"><span class="ic big">${I('card')}</span><div><h3>M-Pesa / Daraja</h3>${this.pill(firstMpesa ? firstMpesa.status : 'NOT_CONFIGURED')}</div></div>
                    <p class="cc-t">${E(firstMpesa ? firstMpesa.business_shortcode : 'No shortcode')}</p>
                    <div class="cc-kv"><span>Shortcode</span><b class="mono">${E((firstMpesa && firstMpesa.business_shortcode) || '—')}</b></div>
                    <button class="secondary" id="mpReg" ${firstMpesa ? '' : 'disabled'}>Register callbacks</button>
                    <div id="mpMsg" aria-live="polite"></div>
                </section>
            </div>`;

        $('kraCheck').onclick = async () => {
            try {
                await API.checkKra(data.merchant.kra_pin);
                await this.connections(root);
            } catch (error) {
                $('kraMsg').innerHTML = `<div class="error">${E(error.message)}</div>`;
            }
        };

        $('mpReg').onclick = async () => {
            try {
                if (!firstMpesa || !firstMpesa.business_shortcode) throw new Error('No M-Pesa shortcode is configured.');
                await API.registerMpesa(firstMpesa.business_shortcode);
                await this.connections(root);
            } catch (error) {
                $('mpMsg').innerHTML = `<div class="error">${E(error.message)}</div>`;
            }
        };
    };

    /* ---------- Business profile ---------- */
    A.profile = function (root) {
        const m = this.cache.me.merchant || {};
        const row = (icon, label, val, mono) => `<div class="prow"><span class="tile">${I(icon)}</span><div><small>${label}</small><b${mono ? ' class="mono"' : ''}>${val}</b></div></div>`;

        root.innerHTML = hero({ crumb: 'Merchant / Business Profile', title: 'Business', accent: 'Profile', icon: 'store', sub: 'Merchant account information.' }) +
            `<section class="panel profile">
                ${row('store', 'Trading name', E(m.trading_name))}
                ${row('receipt', 'KRA PIN', E(m.kra_pin), true)}
                ${row('phone', 'Business phone', E(m.business_phone || '—'))}
            </section>`;
    };
})();
