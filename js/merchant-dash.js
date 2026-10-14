(function () {
    const NAV = [
        ['dashboard', 'Dashboard', 'home'], ['orders', 'Orders', 'cart'],
        ['payments', 'Payments', 'card'], ['invoices', 'Invoices', 'file'],
        ['items', 'Items', 'box'], ['branches', 'Branches', 'pin'],
        ['connections', 'Connections', 'link'], ['profile', 'Business Profile', 'store']
    ];

    const RED = '#d9162b', INK = '#111827';
    const $ = id => document.getElementById(id);
    const E = v => App.esc(v), M = v => App.money(v);
    const UI = App.ui;

    $('nav').innerHTML = NAV
        .map(n => `<button data-view="${n[0]}">${Charts.icon(n[2])}<span>${n[1]}</span><span class="chev">${Charts.icon('chev')}</span></button>`)
        .join('');

    const hm = t => { const d = new Date(t); return isNaN(d) ? '—' : d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }); };
    const same = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
    const PAID = ['PAID', 'FISCALIZATION_PENDING', 'CLOSED'];

    const ago = t => {
        const s = (Date.now() - new Date(t)) / 1000;
        return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago';
    };

    /* =====================================================================
       Notifications: live in the bell dropdown, available on every page
       ===================================================================== */
    let notes = [];
    const seenAt = () => { try { return +localStorage.notifSeen || 0; } catch (e) { return 0; } };
    const markSeen = () => { try { localStorage.notifSeen = Date.now(); } catch (e) {} };
    const unreadCount = () => notes.filter(n => new Date(n.t) > seenAt()).length;

    function renderNotes() {
        const n = unreadCount();
        const bc = $('bellCount'), nc = $('nCount');
        bc.textContent = n > 9 ? '9+' : n;
        bc.classList.toggle('hide', !n);
        nc.textContent = n;
        nc.classList.toggle('hide', !n);

        const seen = seenAt();
        $('noteList').innerHTML = notes.length
            ? notes.map(e => `<li class="${new Date(e.t) > seen ? 'unread' : ''}"><span class="ic ${e.ok ? 'good' : 'warnic'}">${Charts.icon(e.ok ? 'check' : 'alert')}</span><div><b>${e.x}</b><small>${e.y}</small><small>${ago(e.t)}</small></div></li>`).join('')
            : '<li class="none">No activity yet.</li>';
    }

    async function loadNotes() {
        try {
            const [pa, iv] = await Promise.all([API.payments(), API.invoices()]);
            const P = pa.payments || [], I = iv.invoices || [];

            notes = [
                ...P.map(p => ({ t: p.created_at, ok: p.status === 'MATCHED', x: 'Payment ' + String(p.status || '').toLowerCase().replaceAll('_', ' '), y: `KES ${M(p.amount)} &middot; ${E(p.payment_reference || p.trans_id || '')}` })),
                ...I.filter(i => i.fiscalized_at).map(i => ({ t: i.fiscalized_at, ok: true, x: 'Invoice fiscalized', y: `${E(i.invoice_number)} signed by KRA` })),
                ...I.filter(i => i.fiscalization_status === 'FAILED').map(i => ({ t: i.updated_at || i.created_at, ok: false, x: 'Invoice needs attention', y: `${E(i.invoice_number)}: KRA signing failed` }))
            ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 12);
        } catch (e) { /* keep what we have */ }
        renderNotes();
    }

    const pop = $('npop'), bell = $('bell');
    const openNotes = open => {
        pop.classList.toggle('hide', !open);
        bell.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) loadNotes();
    };
    const closeNotes = () => openNotes(false);

    bell.onclick = e => { e.stopPropagation(); openNotes(pop.classList.contains('hide')); };
    pop.onclick = e => e.stopPropagation();
    document.addEventListener('click', closeNotes);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNotes(); });

    $('mar').onclick = () => { markSeen(); renderNotes(); };

    /* =====================================================================
       Shell: business name, badge. (Connection status now lives on the
       dashboard strip and the Connections page, not the top bar.)
       ===================================================================== */
    const shell = App.renderShell;

    App.renderShell = function () {
        shell.call(this);

        API.connections().then(c => {
            const ok = !!c.kra && c.kra.status === 'CONNECTED' && (c.mpesa || []).some(x => x.status === 'ACTIVE');
            $('bizBadge').textContent = ok ? 'Active' : 'Setup pending';
            $('bizBadge').classList.toggle('off', !ok);
        }).catch(() => {});

        loadNotes();
        setInterval(loadNotes, 60000);
    };

    // Top search: filters the table on screen (paged tables search every row)
    const q = $('q');
    q.oninput = () => {
        if (App.tbl) App.tbl.setTerm(q.value);
        else document.querySelectorAll('#app tbody tr').forEach(tr => {
            tr.style.display = tr.textContent.toLowerCase().includes(q.value.toLowerCase()) ? '' : 'none';
        });
    };

    // Reset search and close the dropdown whenever a view loads; stamp "last updated"
    const loadView = App.loadView;
    App.loadView = async function () {
        q.value = '';
        App.tbl = null;
        closeNotes();
        await loadView.call(this);
        $('updated').textContent = 'Last updated: ' + hm(new Date());
    };

    /* =====================================================================
       Dashboard
       ===================================================================== */
    const delta = (a, b) => b > 0
        ? `<span class="delta ${a >= b ? 'up' : 'down'}">${a >= b ? '&#9650;' : '&#9660;'} ${Math.abs(Math.round((a - b) / b * 100))}% vs yesterday</span>`
        : '<span class="delta muted">No data yesterday</span>';

    App.dashboard = async function (root) {
        const [sa, pa, iv, cn] = await Promise.all([API.sales(), API.payments(), API.invoices(), API.connections()]);
        const S = sa.sales || [], P = pa.payments || [], Iv = iv.invoices || [];

        const series = n => {
            const D = [...Array(n)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d; });
            return {
                D,
                sales: D.map(d => S.filter(s => PAID.includes(s.status) && same(s.created_at, d)).reduce((t, s) => t + Number(s.total_amount), 0)),
                orders: D.map(d => S.filter(s => same(s.created_at, d)).length)
            };
        };

        const w = series(7);
        const m7 = w.D.map(d => P.filter(p => p.status === 'MATCHED' && same(p.created_at, d)).length);
        const f7 = w.D.map(d => Iv.filter(i => i.fiscalization_status === 'FISCALIZED' && i.fiscalized_at && same(i.fiscalized_at, d)).length);
        const last = a => a[a.length - 1], prev = a => a[a.length - 2];
        const cnt = s => P.filter(p => p.status === s).length;
        const fiscalized = Iv.filter(i => i.fiscalization_status === 'FISCALIZED').length;

        const kpi = (t, v, sub, sp, col, ic) =>
            `<div class="kpi"><span class="ic" style="background:${col}14;color:${col}">${Charts.icon(ic)}</span><div style="flex:1;min-width:0"><small>${t}</small><b>${v}</b>${sub}${Charts.spark(sp, col)}</div></div>`;

        const orderRows = S.slice(0, 5).map((s, i) => `<tr style="--i:${i}"><td>${UI.idc('cart', s.order_reference)}</td><td class="opt">${E(s.customer_name || 'Customer')}</td><td><span class="amt">KES ${M(s.total_amount)}</span></td><td>${this.pill(s.status)}</td></tr>`).join('');
        const payRows = P.slice(0, 5).map((p, i) => `<tr style="--i:${i}"><td>${UI.idc('card', p.trans_id || '—')}</td><td class="opt2"><span class="mono">${E(p.payment_reference || '—')}</span></td><td><span class="amt">KES ${M(p.amount)}</span></td><td>${this.pill(p.status)}</td><td class="muted opt">${hm(p.created_at)}</td></tr>`).join('');
        const mpesaOk = (cn.mpesa || []).some(x => x.status === 'ACTIVE');
        const allOk = cn.kra && cn.kra.status === 'CONNECTED' && mpesaOk;

        root.innerHTML =
            UI.hero({
                crumb: 'Merchant / Dashboard', title: 'Your', accent: 'Dashboard', icon: 'home',
                sub: 'Live transaction view for your eTIMS AutoInvoice account.'
            }) + `
        <div class="kpis">
            ${kpi("Today's sales", 'KES ' + M(last(w.sales)), delta(last(w.sales), prev(w.sales)), w.sales, RED, 'cart')}
            ${kpi('Orders', S.length, `<span class="delta muted">${last(w.orders)} today</span>`, w.orders, INK, 'cart')}
            ${kpi('Matched payments', cnt('MATCHED'), delta(last(m7), prev(m7)), m7, RED, 'card')}
            ${kpi('Fiscalized invoices', fiscalized, delta(last(f7), prev(f7)), f7, INK, 'file')}
        </div>
        <div class="charts">
            <section class="panel">
                <div class="ph"><span class="ic">${Charts.icon('chart')}</span><h3>Sales overview</h3>
                <select id="rng" aria-label="Date range"><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></div>
                <div class="lg"><span><i class="dot" style="background:${RED}"></i>Sales (KES)</span><span><i class="dot" style="background:${INK}"></i>Orders</span></div>
                <div id="c1"></div>
            </section>
            <section class="panel"><div class="ph"><span class="ic">${Charts.icon('pie')}</span><h3>Payments by status</h3></div><div id="c2"></div></section>
        </div>
        <div class="grid2">
            <section class="panel cq"><div class="ph"><span class="ic">${Charts.icon('cart')}</span><h3>Recent orders</h3><a href="#orders">View all &rarr;</a></div>
                ${orderRows ? `<div class="tc-scroll"><table class="tbl"><thead><tr><th>Reference</th><th class="opt">Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${orderRows}</tbody></table></div>` : '<div class="empty">No orders yet.</div>'}</section>
            <section class="panel cq"><div class="ph"><span class="ic">${Charts.icon('card')}</span><h3>Recent payments</h3><a href="#payments">View all &rarr;</a></div>
                ${payRows ? `<div class="tc-scroll"><table class="tbl"><thead><tr><th>Transaction</th><th class="opt2">Reference</th><th>Amount</th><th>Status</th><th class="opt">Time</th></tr></thead><tbody>${payRows}</tbody></table></div>` : '<div class="empty">No payments yet.</div>'}</section>
        </div>
        <section class="panel strip ${allOk ? '' : 'warn'}"><span class="ic">${Charts.icon(allOk ? 'shield' : 'alert')}</span>
            <div style="flex:1"><b>${allOk ? 'Your business is connected' : 'Check your connections'}</b><br><small>KRA eTIMS and M-Pesa integration status</small></div>
            <span class="conn">KRA eTIMS ${this.pill((cn.kra && cn.kra.status) || 'NOT_CONNECTED')}</span><span class="conn">M-Pesa ${this.pill(mpesaOk ? 'ACTIVE' : 'PENDING')}</span><a class="btnlink" href="#connections">View connections &rarr;</a>
        </section>`;

        const draw = n => {
            const s = series(n);
            Charts.lines($('c1'), s.D.map(d => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })), s.sales, s.orders);
        };

        draw(7);
        $('rng').onchange = e => draw(+e.target.value);

        const known = cnt('MATCHED') + cnt('UNMATCHED') + cnt('AMOUNT_MISMATCH');

        Charts.donut($('c2'), [
            { n: 'Matched', v: cnt('MATCHED'), c: INK },
            { n: 'Unmatched', v: cnt('UNMATCHED'), c: '#f59e0b' },
            { n: 'Amount mismatch', v: cnt('AMOUNT_MISMATCH'), c: RED },
            { n: 'Other', v: P.length - known, c: '#cbd5e1' }
        ], 'payments');
    };
})();
