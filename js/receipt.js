(function () {
    const root = document.getElementById('receipt');
    const actions = document.getElementById('actions');

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

    // KRA timestamps look like 20261010122032 (yyyyMMddHHmmss).
    const kraDate = value => {
        const s = String(value || '');

        return /^\d{14}$/.test(s)
            ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`
            : '-';
    };

    const show = html => {
        root.innerHTML = html;
    };

    const fail = message =>
        show(`<div class="error">${esc(message)}</div>`);

    const render = data => {
        const inv = data.invoice;
        const cur = inv.currency || 'KES';

        const rows = (data.items || []).map(item => `
            <tr>
                <td>${esc(item.item_name)}</td>
                <td class="num">${esc(Number(item.quantity))}</td>
                <td class="num">${money(item.unit_price)}</td>
                <td class="num">${money(item.line_total)}</td>
            </tr>`).join('');

        const buyerBlock = data.buyer.pin
            ? `<div><span>Buyer</span>${esc(data.buyer.name || '')} (${esc(data.buyer.pin)})</div>`
            : '';

        const paymentBlock = data.payment
            ? `<div><span>Payment</span>${esc(String(data.payment.payment_method || '').replace('_', ' '))}</div>
               <div><span>M-Pesa transaction</span><b class="mono">${esc(data.payment.trans_id || '-')}</b></div>`
            : '';

        show(`
            <div class="brand">
                <h1>${esc(data.merchant.name)}</h1>
                <div class="pin">KRA PIN: ${esc(data.merchant.pin)}</div>
                <div class="tag">TAX INVOICE</div>
            </div>

            <div class="meta">
                <div><span>Invoice no.</span>${esc(inv.number)}</div>
                <div><span>Order</span>${esc(inv.order_reference || '-')}</div>
                <div><span>Date</span>${esc(kraDate(inv.sdc_date_time))}</div>
                <div><span>KRA receipt no.</span>${esc(inv.kra_receipt_number || '-')}</div>
                ${buyerBlock}
                ${paymentBlock}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="num">Qty</th>
                        <th class="num">Price</th>
                        <th class="num">Total</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <div class="totals">
                <div><span>Subtotal</span><span>${esc(cur)} ${money(inv.subtotal)}</span></div>
                <div><span>VAT</span><span>${esc(cur)} ${money(inv.tax_amount)}</span></div>
                <div class="grand"><span>Total</span><span>${esc(cur)} ${money(inv.total_amount)}</span></div>
            </div>

            <div class="kra">
                <b>KRA eTIMS fiscal details</b>
                <div>Control unit: <span class="mono">${esc(inv.cu_serial_number || '-')}</span></div>
                <div>Receipt signature: <span class="mono">${esc(inv.receipt_signature || '-')}</span></div>
                <div>Internal data: <span class="mono">${esc(inv.kra_internal_data || '-')}</span></div>
                <div>Signed: ${esc(kraDate(inv.sdc_date_time))}</div>
            </div>

            <div class="qr" id="qr"></div>
        `);

        // Sandbox POC: the QR encodes this receipt's own link. It is not
        // KRA's official verification link.
        const qrBox = document.getElementById('qr');

        if (window.QRCode) {
            new QRCode(qrBox, {
                text: location.href,
                width: 140,
                height: 140
            });
        } else {
            qrBox.textContent = 'QR code unavailable (offline).';
        }

        actions.hidden = false;
    };

    const token = new URLSearchParams(location.search).get('t');

    if (!token) {
        fail('This receipt link is missing its access code.');
        return;
    }

    API.get('/receipts/public/' + encodeURIComponent(token))
        .then(render)
        .catch(error => fail(error.message || 'Could not load this receipt.'));
})();
