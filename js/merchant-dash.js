(function () {
    const NAV = [
        ['dashboard', 'Dashboard', 'home'], ['orders', 'Orders', 'cart'],
        ['payments', 'Payments', 'card'], ['invoices', 'Invoices', 'file'],
        ['items', 'Items', 'box'], ['branches', 'Branches', 'pin'],
        ['connections', 'Connections', 'link'], ['profile', 'Business Profile', 'store']
    ];

    // Theme colours used by the dashboard widgets
    const RED = '#d9162b', INK = '#111827';

    const $ = id => document.getElementById(id);

    $('nav').innerHTML = NAV
        .map(n => `<button data-view="${n[0]}">${Charts.icon(n[2])}${n[1]}</button>`)
        .join('');

    // ---------- Notification bookkeeping (unread = newer than last "mark all read") ----------
    const seenAt = () => { try { return +localStorage.notifSeen || 0; } catch (e) { return 0; } };
    const markSeen = () => { try { localStorage.notifSeen = Date.now(); } catch (e) {} };

    const setBell = n => {
        const b = $('bellCount');
        if (!b) return;
        b.textContent = n > 9 ? '9+' : n;
        b.classList.toggle('hide', !n);
    };

    // ---------- Top bar + sidebar: user, connection status, business badge ----------
    const shell = App.renderShell;

    App.renderShell = function () {
        shell.call(this);

        const m = this.cache.me || {};
        const name = (m.user && (m.user.full_name || m.user.name)) || m.full_name || m.name || '';
        const shown = name || (m.merchant && m.merchant.trading_name) || 'Merchant';

        $('avatar').textContent = (shown.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || 'M').toUpperCase();
        $('uname').textContent = shown;

        // Bell jumps to the notifications panel on the dashboard
        $('bell').onclick = () => {
            this.scrollToNotes = true;
            if (this.view !== 'dashboard') this.navigate('dashboard');
            else { const n = $('notif'); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        };

        const setStatus = (dot, txt, ok) => {
            $(dot).classList.toggle('on', ok);
            $(dot).classList.toggle('off', !ok);
            $(txt).textContent = ok ? 'Connected' : 'Not connected';
        };

        API.connections().then(c => {
            const kra = !!c.kra && c.kra.status === 'CONNECTED';
            const mp = (c.mpesa || []).some(x => x.status === 'ACTIVE');
            setStatus('kraDot', 'kraTxt', kra);
            setStatus('mpDot', 'mpTxt', mp);
            $('bizBadge').textContent = kra && mp ? 'Active' : 'Setup pending';
            $('bizBadge').classList.toggle('off', !(kra && mp));
        }).catch(() => {});
    };

    // ---------- Search box filters whichever table is on screen ----------
    const q = $('q');

    q.oninput = () => document.querySelectorAll('#app tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q.value.toLowerCase()) ? '' : 'none';
    });

    // ---------- Helpers ----------
    const E = v => App.esc(v), M = v => App.money(v);
    const PAID = ['PAID', 'FISCALIZATION_PENDING', 'CLOSED'];
    const same = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
    const hm = t => { const d = new Date(t); return isNaN(d) ? '—' : d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }); };

    const ago = t => {
        const s = (Date.now() - new Date(t)) / 1000;
        return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago';
    };

    const delta = (a, b) => b > 0
        ? `<span class="delta ${a >= b ? 'up' : 'down'}">${a >= b ? '&#9650;' : '&#9660;'} ${Math.abs(Math.round((a - b) / b * 100))}% vs yesterday</span>`
        : '<span class="delta muted">No data yesterday</span>';

    // ---------- Dashboard ----------
    App.dashboard = async function (root) {
        const [sa, pa, iv, cn] = await Promise.all([API.sales(), API.payments(), API.invoices(), API.connections()]);
        const S = sa.sales || [], P = pa.payments || [], I = iv.invoices || [], me = this.cache.me || {};
        const first = ((me.user && (me.user.full_name || me.user.name)) || me.full_name || me.name || '').split(' ')[0];
        const hr = new Date().getHours();

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
        const f7 = w.D.map(d => I.filter(i => i.fiscalization_status === 'FISCALIZED' && i.fiscalized_at && same(i.fiscalized_at, d)).length);
        const last = a => a[a.length - 1], prev = a => a[a.length - 2];
        const cnt = s => P.filter(p => p.status === s).length;
        const fiscalized = I.filter(i => i.fiscalization_status === 'FISCALIZED').length;

        const kpi = (t, v, sub, sp, col, ic) =>
            `<div class="kpi"><span class="ic" style="background:${col}14;color:${col}">${Charts.icon(ic)}</span><div style="flex:1;min-width:0"><small>${t}</small><b>${v}</b>${sub}${Charts.spark(sp, col)}</div></div>`;

        const events = [
            ...P.map(p => ({ t: p.created_at, ok: p.status === 'MATCHED', x: 'Payment ' + String(p.status || '').toLowerCase().replace('_', ' '), y: `KES ${M(p.amount)} &middot; ${E(p.payment_reference || p.trans_id || '')}` })),
            ...I.filter(i => i.fiscalized_at).map(i => ({ t: i.fiscalized_at, ok: true, x: 'Invoice fiscalized', y: `${E(i.invoice_number)} signed by KRA` })),
            ...I.filter(i => i.fiscalization_status === 'FAILED').map(i => ({ t: i.updated_at || i.created_at, ok: false, x: 'Invoice needs attention', y: `${E(i.invoice_number)}: KRA signing failed` }))
        ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 6);

        const unread = events.filter(e => new Date(e.t) > seenAt()).length;
        setBell(unread);

        const orderRows = S.slice(0, 5).map(s => `<tr><td class="mono">${E(s.order_reference)}</td><td>${E(s.customer_name || 'Customer')}</td><td>KES ${M(s.total_amount)}</td><td>${this.pill(s.status)}</td></tr>`).join('');
        const payRows = P.slice(0, 5).map(p => `<tr><td class="mono">${E(p.trans_id)}</td><td>KES ${M(p.amount)}</td><td>${this.pill(p.status)}</td><td class="muted">${hm(p.created_at)}</td></tr>`).join('');
        const mpesaOk = (cn.mpesa || []).some(x => x.status === 'ACTIVE');
        const allOk = cn.kra && cn.kra.status === 'CONNECTED' && mpesaOk;
        const now = new Date();

        root.innerHTML = `
        <header class="greet">
            <div><h1>${hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}${first ? ', ' + E(first) : ''}!</h1>
            <p>Here is what is happening with your eTIMS AutoInvoice account.</p></div>
            <div class="when">
                <span class="ic">${Charts.icon('calendar')}</span>
                <div><b>${now.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b><small>${hm(now)}</small></div>
                <button class="secondary" id="rf">Refresh</button>
            </div>
        </header>
        <div class="kpis">
            ${kpi("Today's sales", 'KES ' + M(last(w.sales)), delta(last(w.sales), prev(w.sales)), w.sales, RED, 'cart')}
            ${kpi('Orders', S.length, `<span class="delta muted">${last(w.orders)} today</span>`, w.orders, INK, 'cart')}
            ${kpi('Matched payments', cnt('MATCHED'), delta(last(m7), prev(m7)), m7, RED, 'card')}
            ${kpi('Fiscalized invoices', fiscalized, delta(last(f7), prev(f7)), f7, INK, 'file')}
        </div>
        <div class="dgrid"><div>
            <div class="charts">
                <section class="panel">
                    <div class="ph"><span class="ic">${Charts.icon('chart')}</span><h3>Sales overview</h3>
                    <select id="rng"><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></div>
                    <div class="lg"><span><i class="dot" style="background:${RED}"></i>Sales (KES)</span><span><i class="dot" style="background:${INK}"></i>Orders</span></div>
                    <div id="c1"></div>
                </section>
                <section class="panel"><div class="ph"><span class="ic">${Charts.icon('pie')}</span><h3>Payments by status</h3></div><div id="c2"></div></section>
            </div>
            <div class="grid2">
                <section class="panel"><div class="ph"><span class="ic">${Charts.icon('cart')}</span><h3>Recent orders</h3><a href="#orders">View all &rarr;</a></div>${orderRows ? `<table><thead><tr><th>Reference</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${orderRows}</tbody></table>` : '<div class="empty">No orders yet.</div>'}</section>
                <section class="panel"><div class="ph"><span class="ic">${Charts.icon('card')}</span><h3>Recent payments</h3><a href="#payments">View all &rarr;</a></div>${payRows ? `<table><thead><tr><th>Transaction</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead><tbody>${payRows}</tbody></table>` : '<div class="empty">No payments yet.</div>'}</section>
            </div>
            <section class="panel strip ${allOk ? '' : 'warn'}"><span class="ic">${Charts.icon(allOk ? 'shield' : 'alert')}</span>
                <div style="flex:1"><b>${allOk ? 'Your business is connected' : 'Check your connections'}</b><br><small>KRA eTIMS and M-Pesa integration status</small></div>
                <span class="conn">KRA eTIMS ${this.pill((cn.kra && cn.kra.status) || 'NOT_CONNECTED')}</span><span class="conn">M-Pesa ${this.pill(mpesaOk ? 'ACTIVE' : 'PENDING')}</span><a class="btnlink" href="#connections">View connections &rarr;</a>
            </section>
        </div>
        <aside class="panel" id="notif">
            <div class="ph"><h3>Notifications</h3><em class="count ${unread ? '' : 'hide'}" id="nCount">${unread}</em><button class="linkbtn" id="mar" type="button">Mark all read</button></div>
            <ul class="notes">${events.length ? events.map(e => `<li class="${new Date(e.t) > seenAt() ? 'unread' : ''}"><span class="ic ${e.ok ? 'good' : 'warnic'}">${Charts.icon(e.ok ? 'check' : 'alert')}</span><div><b>${e.x}</b><small>${e.y}</small><small>${ago(e.t)}</small></div></li>`).join('') : '<li class="muted">No activity yet.</li>'}</ul></aside>
        </div>`;

        const draw = n => {
            const s = series(n);
            Charts.lines($('c1'), s.D.map(d => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })), s.sales, s.orders);
        };

        draw(7);
        $('rng').onchange = e => draw(+e.target.value);
        $('rf').onclick = () => App.loadView();

        $('mar').onclick = () => {
            markSeen();
            document.querySelectorAll('.notes li.unread').forEach(li => li.classList.remove('unread'));
            $('nCount').classList.add('hide');
            setBell(0);
        };

        const known = cnt('MATCHED') + cnt('UNMATCHED') + cnt('AMOUNT_MISMATCH');

        Charts.donut($('c2'), [
            { n: 'Matched', v: cnt('MATCHED'), c: INK },
            { n: 'Unmatched', v: cnt('UNMATCHED'), c: '#f59e0b' },
            { n: 'Amount mismatch', v: cnt('AMOUNT_MISMATCH'), c: RED },
            { n: 'Other', v: P.length - known, c: '#cbd5e1' }
        ], 'payments');

        $('updated').textContent = 'Last updated: ' + hm(new Date());

        if (this.scrollToNotes) {
            this.scrollToNotes = false;
            $('notif').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
})();
