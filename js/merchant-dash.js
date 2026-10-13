(function () {
    const NAV = [
        ['dashboard', 'Dashboard', 'home'], ['orders', 'Orders', 'cart'],
        ['payments', 'Payments', 'card'], ['invoices', 'Invoices', 'file'],
        ['items', 'Items', 'box'], ['branches', 'Branches', 'pin'],
        ['connections', 'Connections', 'link'], ['profile', 'Business Profile', 'store']
    ];

    document.getElementById('nav').innerHTML = NAV
        .map(n => `<button data-view="${n[0]}">${Charts.icon(n[2])}${n[1]}</button>`)
        .join('');

    // Top bar: avatar and connection dots.
    const shell = App.renderShell;

    App.renderShell = function () {
        shell.call(this);

        const m = this.cache.me || {};
        const name = (m.user && (m.user.full_name || m.user.name)) || m.full_name || m.name ||
            (m.merchant && m.merchant.trading_name) || 'M';

        document.getElementById('avatar').textContent = name.trim()[0].toUpperCase();

        API.connections().then(c => {
            document.getElementById('kraDot').classList.toggle('on', !!c.kra && c.kra.status === 'CONNECTED');
            document.getElementById('mpDot').classList.toggle('on', (c.mpesa || []).some(x => x.status === 'ACTIVE'));
        }).catch(() => {});
    };

    // Search box filters whichever table is on screen.
    const q = document.getElementById('q');

    q.oninput = () => document.querySelectorAll('#app tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q.value.toLowerCase()) ? '' : 'none';
    });

    const E = v => App.esc(v), M = v => App.money(v);
    const PAID = ['PAID', 'FISCALIZATION_PENDING', 'CLOSED'];
    const same = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

    const ago = t => {
        const s = (Date.now() - new Date(t)) / 1000;
        return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago';
    };

    const delta = (a, b) => b > 0
        ? `<span class="delta ${a >= b ? 'up' : 'down'}">${a >= b ? '&#9650;' : '&#9660;'} ${Math.abs(Math.round((a - b) / b * 100))}% vs yesterday</span>`
        : '<span class="delta muted">No data yesterday</span>';

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
            `<div class="kpi"><span class="ic" style="background:${col}1a;color:${col}">${Charts.icon(ic)}</span><div style="flex:1"><small>${t}</small><b>${v}</b>${sub}${Charts.spark(sp, col)}</div></div>`;

        const events = [
            ...P.map(p => ({ t: p.created_at, ok: p.status === 'MATCHED', x: 'Payment ' + String(p.status || '').toLowerCase().replace('_', ' '), y: `KES ${M(p.amount)} &middot; ${E(p.payment_reference || p.trans_id || '')}` })),
            ...I.filter(i => i.fiscalized_at).map(i => ({ t: i.fiscalized_at, ok: true, x: 'Invoice fiscalized', y: `${E(i.invoice_number)} signed by KRA` })),
            ...I.filter(i => i.fiscalization_status === 'FAILED').map(i => ({ t: i.updated_at || i.created_at, ok: false, x: 'Invoice needs attention', y: `${E(i.invoice_number)}: KRA signing failed` }))
        ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 6);

        const orderRows = S.slice(0, 5).map(s => `<tr><td class="mono">${E(s.order_reference)}</td><td>KES ${M(s.total_amount)}</td><td>${this.pill(s.status)}</td></tr>`).join('');
        const payRows = P.slice(0, 5).map(p => `<tr><td class="mono">${E(p.trans_id)}</td><td>KES ${M(p.amount)}</td><td>${this.pill(p.status)}</td></tr>`).join('');
        const mpesaOk = (cn.mpesa || []).some(x => x.status === 'ACTIVE');

        root.innerHTML = `
        <header>
            <div><h1>${hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}${first ? ', ' + E(first) : ''}!</h1>
            <p>Here is what is happening with your eTIMS AutoInvoice account.</p></div>
            <div style="text-align:right"><b>${new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b><br>
            <button class="secondary" id="rf" style="margin-top:6px">Refresh</button></div>
        </header>
        <div class="kpis">
            ${kpi("Today's sales", 'KES ' + M(last(w.sales)), delta(last(w.sales), prev(w.sales)), w.sales, '#16a34a', 'cart')}
            ${kpi('Orders', S.length, `<span class="delta muted">${last(w.orders)} today</span>`, w.orders, '#2563eb', 'cart')}
            ${kpi('Matched payments', cnt('MATCHED'), delta(last(m7), prev(m7)), m7, '#7c3aed', 'card')}
            ${kpi('Fiscalized invoices', fiscalized, delta(last(f7), prev(f7)), f7, '#f59e0b', 'file')}
        </div>
        <div class="dgrid"><div>
            <div class="charts">
                <section class="panel">
                    <div style="display:flex;justify-content:space-between;align-items:center"><h3>Sales overview</h3>
                    <select id="rng" style="width:auto"><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></div>
                    <div id="c1"></div>
                    <div class="muted" style="font-size:12px"><i class="dot" style="background:#2563eb"></i>Sales (KES) <i class="dot" style="background:#16a34a;margin-left:12px"></i>Orders</div>
                </section>
                <section class="panel"><h3>Payments by status</h3><div id="c2"></div></section>
            </div>
            <div class="grid2">
                <section class="panel"><h3>Recent orders</h3>${orderRows ? `<table><tbody>${orderRows}</tbody></table>` : '<div class="empty">No orders yet.</div>'}<a href="#orders">View all</a></section>
                <section class="panel"><h3>Recent payments</h3>${payRows ? `<table><tbody>${payRows}</tbody></table>` : '<div class="empty">No payments yet.</div>'}<a href="#payments">View all</a></section>
            </div>
            <section class="panel strip"><span class="ic" style="background:#dcfce7;color:#166534">${Charts.icon('shield')}</span>
                <div style="flex:1"><b>${cn.kra && cn.kra.status === 'CONNECTED' && mpesaOk ? 'Your business is connected' : 'Check your connections'}</b><br><small>KRA eTIMS and M-Pesa integration status</small></div>
                <span>KRA eTIMS ${this.pill((cn.kra && cn.kra.status) || 'NOT_CONNECTED')}</span><span>M-Pesa ${this.pill(mpesaOk ? 'ACTIVE' : 'PENDING')}</span><a href="#connections">View connections</a>
            </section>
        </div>
        <aside class="panel"><h3>Notifications</h3><ul class="notes">${events.length ? events.map(e => `<li><span class="ic" style="background:${e.ok ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e'}">${Charts.icon(e.ok ? 'check' : 'alert')}</span><div><b>${e.x}</b><small>${e.y}</small><small>${ago(e.t)}</small></div></li>`).join('') : '<li class="muted">No activity yet.</li>'}</ul></aside>
        </div>`;

        const draw = n => {
            const s = series(n);
            Charts.bars(document.getElementById('c1'), s.D.map(d => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })), s.sales, s.orders);
        };

        draw(7);
        document.getElementById('rng').onchange = e => draw(+e.target.value);
        document.getElementById('rf').onclick = () => App.loadView();

        const known = cnt('MATCHED') + cnt('UNMATCHED') + cnt('AMOUNT_MISMATCH');

        Charts.donut(document.getElementById('c2'), [
            { n: 'Matched', v: cnt('MATCHED'), c: '#16a34a' },
            { n: 'Unmatched', v: cnt('UNMATCHED'), c: '#f59e0b' },
            { n: 'Amount mismatch', v: cnt('AMOUNT_MISMATCH'), c: '#dc2626' },
            { n: 'Other', v: P.length - known, c: '#94a3b8' }
        ], 'payments');
    };
})();
