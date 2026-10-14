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
        alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
        bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
        calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
        pie: 'M21 12A9 9 0 1 1 12 3v9zM15 3.5A9 9 0 0 1 20.5 9H15z',
        tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
        copy: 'M9 9h11v11H9zM5 15V4h11',
        plus: 'M12 5v14M5 12h14',
        chev: 'M9 6l6 6-6 6',
        search: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
        filter: 'M3 5h18l-7 8v6l-4 2v-8z',
        receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6',
        user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
        phone: 'M7 2h10v20H7zM11 18h2',
        eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
    };

    const icon = n => `<svg viewBox="0 0 24 24"><path d="${P[n] || P.chart}"/></svg>`;

    // Smooth curve through points (Catmull-Rom converted to cubic beziers).
    // Control points are clamped so the curve never dips below the baseline.
    function smooth(pts, floor) {
        if (!pts.length) return '';
        if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
        let d = `M${pts[0][0]},${pts[0][1]}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
            const c1x = p1[0] + (p2[0] - p0[0]) / 6;
            const c1y = Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6);
            const c2x = p2[0] - (p3[0] - p1[0]) / 6;
            const c2y = Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6);
            d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
        }
        return d;
    }

    const nice = v => {
        const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
        return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    };
    const kfmt = v => v >= 1000 ? (+(v / 1000).toFixed(1)) + 'k' : String(Math.round(v));

    // Charts redraw at their real pixel width, so text stays readable at any size.
    const live = new Set();
    let rt;
    window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => live.forEach(el => {
            if (!el.isConnected) { live.delete(el); return; }
            lines(el, ...el._a);
        }), 150);
    });

    // Two smooth lines over a list of days: sales (left axis, red, soft fill)
    // and orders (right axis, dark).
    function lines(el, labels, sales, orders) {
        el._a = [labels, sales, orders];
        live.add(el);

        const W = Math.max(320, Math.round(el.clientWidth) || 640), H = 232;
        const L = 54, R = 40, T = 16, B = 32, n = labels.length;
        const ms = nice(Math.max(1, ...sales) / 4) * 4;
        const mo = Math.max(4, Math.ceil(Math.max(0, ...orders) / 4) * 4);
        const base = H - B, ph = base - T;
        const y = v => T + ph * (1 - v / ms), y2 = v => T + ph * (1 - v / mo);
        const x = i => n > 1 ? L + 16 + i * ((W - L - R - 32) / (n - 1)) : (L + W - R) / 2;

        let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="chart" role="img" aria-label="Sales overview">` +
            `<defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">` +
            `<stop offset="0" stop-color="#d9162b" stop-opacity=".22"/><stop offset="1" stop-color="#d9162b" stop-opacity="0"/></linearGradient></defs>`;

        for (let i = 0; i <= 4; i++) {
            const yy = T + ph * (1 - i / 4);
            s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#e9ecf2"/>` +
                `<text x="${L - 10}" y="${yy + 4}" text-anchor="end" font-size="12" fill="#64748b">${kfmt(ms * i / 4)}</text>` +
                `<text x="${W - R + 10}" y="${yy + 4}" text-anchor="start" font-size="12" fill="#64748b">${Math.round(mo * i / 4)}</text>`;
        }

        const sp = sales.map((v, i) => [x(i), y(v)]);
        const op = orders.map((v, i) => [x(i), y2(v)]);
        const sd = smooth(sp, base);

        if (sp.length > 1) {
            s += `<path d="${sd} L${sp[sp.length - 1][0]},${base} L${sp[0][0]},${base}Z" fill="url(#salesFill)"/>`;
        }
        s += `<path d="${smooth(op, base)}" fill="none" stroke="#111827" stroke-width="2.5" stroke-linecap="round"/>`;
        s += `<path d="${sd}" fill="none" stroke="#d9162b" stroke-width="2.8" stroke-linecap="round"/>`;

        sales.forEach((v, i) => {
            s += `<circle cx="${sp[i][0]}" cy="${sp[i][1]}" r="4.5" fill="#fff" stroke="#d9162b" stroke-width="2.4"><title>${labels[i]}: KES ${Number(v).toLocaleString()}</title></circle>`;
        });
        orders.forEach((v, i) => {
            s += `<circle cx="${op[i][0]}" cy="${op[i][1]}" r="3.8" fill="#111827"><title>${labels[i]}: ${v} order(s)</title></circle>`;
        });

        const every = Math.ceil(n / Math.max(2, Math.floor((W - L - R) / 62)));
        labels.forEach((l, i) => {
            if (i % every === 0) {
                s += `<text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="12" fill="#64748b">${l}</text>`;
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

    // Small smooth trend line with a soft fill, used on the stat cards.
    function spark(vals, color) {
        const w = 120, h = 36, m = Math.max(1, ...vals);
        const pts = vals.map((v, i) => [i * w / (vals.length - 1 || 1), h - 3 - (h - 8) * v / m]);
        const d = smooth(pts, h - 2);
        return `<svg viewBox="0 0 ${w} ${h}" class="spark" preserveAspectRatio="none">` +
            `<path d="${d} L${w},${h} L0,${h}Z" fill="${color}" fill-opacity=".1"/>` +
            `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
    }

    // "bars" kept as an alias so any older call still works.
    return { icon, bars: lines, lines, donut, spark };
})();
