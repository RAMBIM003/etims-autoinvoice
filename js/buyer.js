(function () {
    const $ = id => document.getElementById(id);

    const esc = value =>
        String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[ch]));

    const money = value =>
        Number(value || 0).toLocaleString('en-KE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    const STAGE = {
        AWAITING_PAYMENT: ['Awaiting payment', 'warn'],
        PAYMENT_RECEIVED: ['Payment received', 'warn'],
        FISCALIZING: ['Signing with KRA', 'warn'],
        RECEIPT_READY: ['Receipt ready', 'ok2'],
        FISCALIZATION_FAILED: ['KRA signing failed', 'bad'],
        PAYMENT_MISMATCH: ['Payment amount mismatch', 'bad'],
        CANCELLED: ['Cancelled', 'bad']
    };

    const TERMINAL = [
        'RECEIPT_READY',
        'FISCALIZATION_FAILED',
        'PAYMENT_MISMATCH',
        'CANCELLED'
    ];

    const state = {
        items: [],
        orderId: null,
        timer: null,
        polls: 0,
        simulation: 'off'
    };

    async function call(path, options = {}) {
        const headers = { ...(options.headers || {}) };

        if (localStorage.token) {
            headers.Authorization = 'Bearer ' + localStorage.token;
        }

        if (options.body) {
            headers['Content-Type'] = 'application/json';
        }

        let res;

        try {
            res = await fetch(API.BASE + path, { ...options, headers });
        } catch {
            throw new Error('Cannot reach the API. Start the backend with npm start.');
        }

        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            const error = new Error('Please sign in with a buyer account first.');
            error.auth = true;
            throw error;
        }

        if (!res.ok) {
            throw new Error(data.error || `Request failed (${res.status})`);
        }

        return data;
    }

    const say = (id, html) => {
        $(id).innerHTML = html;
    };

    const signInHint =
        'Please <a href="log.html">sign in</a> or ' +
        '<a href="sign_buyer.html">register as a buyer</a> first.';

    // ---------- header ----------
    function renderAuth() {
        if (localStorage.token) {
            say('auth', '<button class="secondary" id="logout">Sign out</button>');
            $('logout').onclick = () => {
                localStorage.removeItem('token');
                location.reload();
            };
        } else {
            say(
                'auth',
                '<a href="log.html">Sign in</a><a href="sign_buyer.html">Register</a>'
            );
        }
    }

    // ---------- catalogue and cart ----------
    async function loadMerchants() {
        const data = await call('/buyer/merchants');
        const merchants = data.merchants || [];

        $('merchant').innerHTML = merchants.length
            ? merchants
                  .map(m => `<option value="${esc(m.id)}">${esc(m.trading_name)}</option>`)
                  .join('')
            : '<option value="">No merchants available</option>';

        await loadItems();
    }

    async function loadItems() {
        const id = $('merchant').value;

        if (!id) {
            state.items = [];
            renderCatalog();
            return;
        }

        const data = await call('/buyer/merchants/' + encodeURIComponent(id) + '/items');

        state.items = (data.items || []).map(item => ({ ...item, qty: 0 }));
        renderCatalog();
    }

    function renderCatalog() {
        $('catalog').innerHTML = state.items.length
            ? state.items
                  .map((x, i) => {
                      const vat = Number(x.tax_rate)
                          ? ` + ${Number(x.tax_rate)}% VAT`
                          : '';

                      return `
                        <div class="item">
                            <b>${esc(x.name)}</b>
                            <div class="muted">KES ${money(x.unit_price)} / ${esc(x.unit_code)}${vat}</div>
                            <div class="qty">
                                <button data-i="${i}" data-d="-1">&minus;</button>
                                <span>${x.qty}</span>
                                <button data-i="${i}" data-d="1">+</button>
                            </div>
                        </div>`;
                  })
                  .join('')
            : '<p class="muted">This merchant has no items yet.</p>';

        renderCart();
    }

    function renderCart() {
        const rows = state.items.filter(x => x.qty > 0);

        if (!rows.length) {
            say('cart', 'Add items above.');
            $('create').disabled = true;
            return;
        }

        let subtotal = 0;
        let vat = 0;

        const lines = rows
            .map(x => {
                const sub = x.qty * Number(x.unit_price);

                subtotal += sub;
                vat += (sub * Number(x.tax_rate || 0)) / 100;

                return `<div class="line"><span>${esc(x.name)} &times; ${x.qty}</span><span>KES ${money(sub)}</span></div>`;
            })
            .join('');

        say(
            'cart',
            `${lines}
             <div class="line"><span>VAT</span><span>KES ${money(vat)}</span></div>
             <div class="line total"><span>Total</span><span>KES ${money(subtotal + vat)}</span></div>`
        );

        $('create').disabled = false;
    }

    async function createOrder() {
        const lines = state.items
            .filter(x => x.qty > 0)
            .map(x => ({ item_id: x.id, quantity: x.qty }));

        if (!lines.length) {
            return;
        }

        say('msg', '');
        $('create').disabled = true;

        try {
            const result = await call('/buyer/orders', {
                method: 'POST',
                body: JSON.stringify({
                    merchant_id: $('merchant').value,
                    items: lines
                })
            });

            state.items.forEach(x => {
                x.qty = 0;
            });

            renderCatalog();
            await openOrder(result.order.id);
            loadOrders();
        } catch (error) {
            say(
                'msg',
                `<div class="error">${error.auth ? signInHint : esc(error.message)}</div>`
            );
            renderCart();
        }
    }

    // ---------- payment and status ----------
    async function openOrder(id) {
        state.orderId = id;

        const data = await call(`/buyer-app/orders/${encodeURIComponent(id)}/status`);

        renderPay(data);
        startPolling();
        $('payCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderPay(d) {
        const stage = d.stage;
        const failed = ['FISCALIZATION_FAILED', 'PAYMENT_MISMATCH', 'CANCELLED'].includes(stage);

        const paid = ['PAYMENT_RECEIVED', 'FISCALIZING', 'RECEIPT_READY', 'FISCALIZATION_FAILED'].includes(stage);
        const signed = stage === 'RECEIPT_READY';

        const flags = [true, paid, signed, signed];
        const labels = ['Order created', 'Payment received', 'Signed by KRA eTIMS', 'Receipt ready'];
        const firstOpen = flags.indexOf(false);

        const steps = labels
            .map((label, i) => {
                const cls = flags[i] ? 'done' : i === firstOpen && !failed ? 'active' : '';
                return `<div class="step ${cls}">${flags[i] ? '&#10003; ' : ''}${label}</div>`;
            })
            .join('');

        const instructions =
            stage === 'AWAITING_PAYMENT'
                ? `
                <div class="pay">
                    <div><small>${esc(d.pay?.type === 'TILL' ? 'Till' : 'Paybill')}</small><b>${esc(d.pay?.shortcode || 'Merchant shortcode')}</b></div>
                    <div><small>Account number</small><b class="mono">${esc(d.pay?.reference)}</b></div>
                    <div><small>Amount (KES)</small><b>${money(d.pay?.amount)}</b></div>
                </div>
                <div class="notice">Pay with M-Pesa using the Paybill, account number and amount above. Use the account number exactly as shown.</div>`
                : '';

        const sandbox =
            stage === 'AWAITING_PAYMENT' && state.simulation !== 'off'
                ? `
                <div class="sandbox">
                    <b>Sandbox only.</b> ${
                        state.simulation === 'daraja'
                            ? 'This sends a test payment through the Safaricom Daraja sandbox simulator.'
                            : 'This sends a simulated Daraja callback to our own server. It is not a real M-Pesa payment.'
                    }
                    <div style="margin-top:8px"><button class="primary" id="simulate">Simulate M-Pesa payment</button></div>
                    <div id="simMsg"></div>
                </div>`
                : '';

        let outcome = '';

        if (stage === 'RECEIPT_READY' && d.receipt_url) {
            outcome = `<div class="ok">Your eTIMS receipt is ready.
                <div style="margin-top:8px"><a class="primary" style="text-decoration:none;display:inline-block" href="${esc(d.receipt_url)}" target="_blank" rel="noopener">View receipt</a></div></div>`;
        } else if (stage === 'FISCALIZATION_FAILED') {
            outcome = '<div class="error">Your payment was received, but KRA signing did not complete. The merchant has been flagged to retry; your payment is safe.</div>';
        } else if (stage === 'PAYMENT_MISMATCH') {
            outcome = '<div class="error">The amount paid did not match the order total. Please contact the merchant.</div>';
        } else if (stage === 'CANCELLED') {
            outcome = '<div class="error">This order was cancelled.</div>';
        }

        say(
            'payCard',
            `<h2>3. Pay and get your receipt</h2>
             <div><b>${esc(d.order.merchant_name)}</b> &middot; <span class="mono">${esc(d.order.order_reference)}</span> &middot; KES ${money(d.order.total_amount)}</div>
             ${instructions}
             ${sandbox}
             <div class="steps">${steps}</div>
             ${outcome}`
        );

        $('payCard').hidden = false;

        const button = $('simulate');

        if (button) {
            button.onclick = simulate;
        }
    }

    async function simulate() {
        const button = $('simulate');

        button.disabled = true;
        say('simMsg', '<div class="muted" style="margin-top:8px">Sending...</div>');

        try {
            const result = await call(
                `/buyer-app/orders/${encodeURIComponent(state.orderId)}/simulate-payment`,
                { method: 'POST', body: '{}' }
            );

            say('simMsg', `<div class="ok">${esc(result.message)}</div>`);
            state.polls = 0;
            poll();
        } catch (error) {
            button.disabled = false;
            say('simMsg', `<div class="error">${esc(error.message)}</div>`);
        }
    }

    function stopPolling() {
        clearTimeout(state.timer);
        state.timer = null;
    }

    function startPolling() {
        stopPolling();
        state.polls = 0;
        state.timer = setTimeout(poll, 3000);
    }

    async function poll() {
        stopPolling();

        if (!state.orderId) {
            return;
        }

        try {
            const data = await call(`/buyer-app/orders/${encodeURIComponent(state.orderId)}/status`);

            renderPay(data);

            if (TERMINAL.includes(data.stage)) {
                loadOrders();
                return;
            }
        } catch (error) {
            // Keep trying; transient network errors should not stop the tracker.
        }

        state.polls += 1;

        if (state.polls < 100) {
            state.timer = setTimeout(poll, 3000);
        }
    }

    // ---------- order history ----------
    async function loadOrders() {
        if (!localStorage.token) {
            say('orders', `<span class="muted">${signInHint}</span>`);
            return;
        }

        try {
            const data = await call('/buyer-app/orders');
            const orders = data.orders || [];

            if (!orders.length) {
                say('orders', '<span class="muted">No orders yet.</span>');
                return;
            }

            say(
                'orders',
                `<table>
                    <thead><tr><th>Reference</th><th>Merchant</th><th>Total</th><th>Status</th><th></th></tr></thead>
                    <tbody>${orders
                        .map(o => {
                            const [label, cls] = STAGE[o.stage] || [o.stage, ''];
                            let action = '';

                            if (o.stage === 'RECEIPT_READY' && o.receipt_url) {
                                action = `<a href="${esc(o.receipt_url)}" target="_blank" rel="noopener">View receipt</a>`;
                            } else if (!TERMINAL.includes(o.stage)) {
                                action = `<button class="secondary" data-open="${esc(o.order.id)}">Open</button>`;
                            }

                            return `<tr>
                                <td class="mono">${esc(o.order.order_reference)}</td>
                                <td>${esc(o.order.merchant_name)}</td>
                                <td>KES ${money(o.order.total_amount)}</td>
                                <td><span class="pill ${cls}">${esc(label)}</span></td>
                                <td>${action}</td>
                            </tr>`;
                        })
                        .join('')}</tbody>
                </table>`
            );
        } catch (error) {
            say('orders', `<div class="error">${esc(error.message)}</div>`);
        }
    }

    // ---------- wiring ----------
    $('catalog').addEventListener('click', event => {
        const button = event.target.closest('button[data-i]');

        if (!button) {
            return;
        }

        const item = state.items[Number(button.dataset.i)];

        item.qty = Math.max(0, item.qty + Number(button.dataset.d));
        renderCatalog();
    });

    $('orders').addEventListener('click', event => {
        const button = event.target.closest('button[data-open]');

        if (button) {
            openOrder(button.dataset.open).catch(error =>
                say('msg', `<div class="error">${esc(error.message)}</div>`)
            );
        }
    });

    $('merchant').onchange = () =>
        loadItems().catch(error =>
            say('msg', `<div class="error">${esc(error.message)}</div>`)
        );

    $('create').onclick = createOrder;

    (async function init() {
        renderAuth();

        try {
            state.simulation = (await call('/buyer-app/simulation')).mode || 'off';
        } catch (error) {
            state.simulation = 'off';
        }

        try {
            await loadMerchants();
        } catch (error) {
            say('msg', `<div class="error">${esc(error.message)}</div>`);
        }

        loadOrders();
    })();
})();
