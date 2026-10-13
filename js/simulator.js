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

    const state = { orders: [], timer: null, polls: 0 };

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
            const error = new Error('Please sign in first.');
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

    const gate = html => {
        $('gate').hidden = false;
        $('gate').innerHTML = html;
        $('form').hidden = true;
    };

    function fillFromOrder() {
        const order = state.orders[Number($('order').value)];

        if (!order) {
            return;
        }

        if (order.shortcode) {
            $('shortcode').value = order.shortcode;
        }

        $('reference').value = order.order_reference;
        $('amount').value = Number(order.total_amount);
    }

    async function init() {
        if (!localStorage.token) {
            return gate('<b>Sign in first.</b> <a href="log.html">Sign in</a> as the merchant (or a buyer), then reopen this page.');
        }

        try {
            const ctx = await call('/simulator/context');

            state.orders = ctx.orders || [];

            $('order').innerHTML =
                '<option value="">Enter details manually</option>' +
                state.orders
                    .map(
                        (o, i) =>
                            `<option value="${i}">${esc(o.order_reference)} &middot; ${esc(o.trading_name)} &middot; KES ${money(o.total_amount)}</option>`
                    )
                    .join('');

            if (ctx.shortcodes && ctx.shortcodes.length) {
                $('shortcode').value = ctx.shortcodes[0];
            }

            if (state.orders.length) {
                $('order').value = '0';
                fillFromOrder();
            }
        } catch (error) {
            if (error.auth) {
                return gate('<b>Your session expired.</b> <a href="log.html">Sign in again</a>.');
            }

            gate(`<div class="error">${esc(error.message)}</div>`);
        }
    }

    function stopPolling() {
        clearTimeout(state.timer);
        state.timer = null;
    }

    function row(label, value) {
        return `<tr><td>${label}</td><td>${value}</td></tr>`;
    }

    function renderResult(r) {
        if (!r.found) {
            say('result', '<div class="muted">Waiting for the callback to arrive...</div>');
            return false;
        }

        const done =
            r.fiscalization_status === 'FISCALIZED' ||
            r.fiscalization_status === 'FAILED' ||
            ['UNMATCHED', 'AMOUNT_MISMATCH'].includes(r.payment_status);

        say(
            'result',
            `<table>
                ${row('M-Pesa code', `<span class="mono">${esc(r.trans_id)}</span>`)}
                ${row('Account reference', `<span class="mono">${esc(r.bill_ref_number || '(none)')}</span>`)}
                ${row('Amount', `KES ${money(r.amount)}`)}
                ${row('Payer (as received)', `${esc(r.payer_ref || '-')} &middot; ${esc(r.payer_name || '-')}`)}
                ${row('Matching', `${esc(r.payment_status || 'pending')}${r.match_method ? ' (' + esc(r.match_method) + ')' : ''}`)}
                ${row('Order', esc(r.order_reference || 'no order matched'))}
                ${row('Invoice', esc(r.invoice_number || 'not created yet'))}
                ${row('KRA signing', esc(r.fiscalization_status || '-'))}
                ${row('KRA receipt no.', esc(r.kra_receipt_number || '-'))}
            </table>`
        );

        return done;
    }

    async function poll(params) {
        stopPolling();

        try {
            const r = await call('/simulator/result?' + params);

            if (renderResult(r)) {
                return;
            }
        } catch (error) {
            // Keep polling through transient errors.
        }

        state.polls += 1;

        if (state.polls < 40) {
            state.timer = setTimeout(() => poll(params), 2000);
        }
    }

    $('order').onchange = fillFromOrder;

    $('form').onsubmit = async event => {
        event.preventDefault();
        say('msg', '');
        stopPolling();

        const amount = Number($('amount').value);

        if (!Number.isInteger(amount) || amount < 1) {
            return say(
                'msg',
                '<div class="error">M-Pesa C2B amounts are whole shillings. If an order total has cents, it cannot be paid exactly through M-Pesa.</div>'
            );
        }

        const mode = document.querySelector('input[name="mode"]:checked').value;

        $('send').disabled = true;

        try {
            const result = await call('/simulator/c2b', {
                method: 'POST',
                body: JSON.stringify({
                    mode,
                    shortcode: $('shortcode').value.trim(),
                    reference: $('reference').value.trim(),
                    amount,
                    phone: $('phone').value,
                    firstName: $('first').value,
                    lastName: $('last').value
                })
            });

            $('resultCard').hidden = false;

            if (!result.ok) {
                const detail =
                    result.error ||
                    (result.daraja_response && result.daraja_response.ResultDesc) ||
                    'The payment was not accepted.';

                say('msg', `<div class="error">${esc(detail)}</div>`);
                say('result', '');
                say('sentBox', '');
                return;
            }

            say(
                'msg',
                `<div class="ok">${
                    result.mode === 'DARAJA'
                        ? 'Sent to the Daraja sandbox. If your URLs are registered and the tunnel is up, the callback should arrive in a few seconds.'
                        : 'Callback delivered to this server.'
                }</div>`
            );

            say(
                'sentBox',
                result.sent
                    ? `<h2 style="margin-top:18px">Callback payload sent</h2><pre>${esc(JSON.stringify(result.sent, null, 2))}</pre>`
                    : ''
            );

            state.polls = 0;

            const params = result.trans_id
                ? 'transId=' + encodeURIComponent(result.trans_id)
                : 'reference=' + encodeURIComponent(result.reference || '');

            say('result', '<div class="muted">Waiting for the callback to arrive...</div>');
            poll(params);
        } catch (error) {
            say('msg', `<div class="error">${esc(error.message)}</div>`);
        }

        $('send').disabled = false;
    };

    init();
})();
