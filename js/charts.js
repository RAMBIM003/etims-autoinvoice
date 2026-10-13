window.Charts = (function () {
    const P = {
        home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
        cart: 'M6 6h15l-2 9H8zM6 6L5 2H2M9 20h.01M18 20h.01',
        card: 'M3 5h18v14H3zM3 10h18',
        file: 'M14 2H6a2 2 0 0 0-2 2v16h16V8zM14 2v6h6M8 13h8M8 17h8',
        box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v9',
        pin: 'M12 22s8-6 8-12a8 8 0 0 0-16 0c0 6 8 12 8 12zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
        link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
        store: 'M3 9l2-5h14l2 5M3 9h18v11H3zM9 20v-6h6v6',
        chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
        shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
        check: 'M20 6L9 17l-5-5',
        alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'
    };

    const icon = n => `<svg viewBox="0 0 24 24"><path d="${P[n] || P.chart}"/></svg>`;

    // Bars (left axis) with a line (right axis) over a list of days.
    function bars(el, labels, sales, orders) {
        const W = 640, H = 230, L = 48, R = 30, T = 14, B = 28, n = labels.length;
        const pw = (W - L - R) / n, ms = Math.max(1, ...sales), mo = Math.max(1, ...orders);
        const y = v => T + (H - T - B) * (1 - v / ms), y2 = v => T + (H - T - B) * (1 - v / mo);
        let s = `<svg viewBox="0 0 ${W} ${H}" class="chart">`;

        for (let i = 0; i <= 4; i++) {
            const v = ms * i / 4, yy = y(v);
            s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#e6e9f0"/>` +
                `<text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#64748b">${v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)}</text>`;
        }

        sales.forEach((v, i) => {
            s += `<rect x="${L + i * pw + pw * .2}" y="${y(v)}" width="${pw * .6}" height="${Math.max(0, H - B - y(v))}" rx="4" fill="#2563eb" opacity=".85"><title>${labels[i]}: KES ${Number(v).toLocaleString()}</title></rect>`;
        });

        s += `<polyline fill="none" stroke="#16a34a" stroke-width="2.5" points="${orders.map((v, i) => `${L + i * pw + pw / 2},${y2(v)}`).join(' ')}"/>`;
        orders.forEach((v, i) => {
            s += `<circle cx="${L + i * pw + pw / 2}" cy="${y2(v)}" r="3.5" fill="#16a34a"><title>${v} order(s)</title></circle>`;
        });

        labels.forEach((l, i) => {
            if (n <= 10 || i % Math.ceil(n / 8) === 0) {
                s += `<text x="${L + i * pw + pw / 2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#64748b">${l}</text>`;
            }
        });

        el.innerHTML = s + '</svg>';
    }

    // Donut with a legend. parts: [{n, v, c}]
    function donut(el, parts, label) {
        const t = parts.reduce((a, p) => a + p.v, 0);

        if (!t) {
            el.innerHTML = '<div class="empty">No data yet.</div>';
            return;
        }

        let off = 25, c = '';

        parts.filter(p => p.v).forEach(p => {
            const pc = p.v / t * 100;
            c += `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${p.c}" stroke-width="5" stroke-dasharray="${pc} ${100 - pc}" stroke-dashoffset="${off}"/>`;
            off -= pc;
        });

        el.innerHTML = `<div class="donutwrap"><svg viewBox="0 0 42 42" class="donutsvg"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#eef1f6" stroke-width="5"/>${c}<text x="21" y="21.5" text-anchor="middle" font-size="7" font-weight="700" fill="#0f172a">${t}</text><text x="21" y="26.5" text-anchor="middle" font-size="3" fill="#64748b">${label || ''}</text></svg><ul class="legend">${parts.map(p => `<li><i style="background:${p.c}"></i>${p.n}<b>${p.v}</b><span>${Math.round(p.v / t * 100)}%</span></li>`).join('')}</ul></div>`;
    }

    function spark(vals, color) {
        const w = 120, h = 36, m = Math.max(1, ...vals);
        return `<svg viewBox="0 0 ${w} ${h}" class="spark"><polyline fill="none" stroke="${color}" stroke-width="2" points="${vals.map((v, i) => `${i * w / (vals.length - 1 || 1)},${h - 3 - (h - 8) * v / m}`).join(' ')}"/></svg>`;
    }

    return { icon, bars, donut, spark };
})();
