const App = {
    view: 'dashboard',
    cache: {},

    esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[char]);
    },

    money(value) {
        return Number(value || 0).toLocaleString('en-KE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    pill(value) {
        const status = String(value || 'UNKNOWN');

        const className = [
            'ACTIVE', 'CONNECTED', 'MATCHED', 'FISCALIZED'
        ].includes(status)
            ? 'ok'
            : [
                'PENDING', 'AWAITING_PAYMENT',
                'UNMATCHED', 'PROCESSING',
                'FISCALIZATION_PENDING'
            ].includes(status)
                ? 'warn'
                : 'bad';

        return `<span class="pill ${className}">${this.esc(
            status.replaceAll('_', ' ')
        )}</span>`;
    },

    async init() {
        if (!localStorage.token) {
            location.href = '/sign_merchant.html';
            return;
        }

        try {
            this.cache.me = await API.me();
            this.renderShell();
            this.navigate(location.hash.slice(1) || 'dashboard');
        } catch (error) {
            this.fail(error.message);
        }
    },

    renderShell() {
        const business = document.getElementById('business');

        if (business) {
            business.textContent =
                this.cache.me.merchant?.trading_name || 'Business';
        }

        document.querySelectorAll('[data-view]').forEach(element => {
            element.onclick = () => this.navigate(element.dataset.view);
        });

        const logout = document.getElementById('logout');

        if (logout) {
            logout.onclick = () => {
                localStorage.removeItem('token');
                location.href = '/sign_merchant.html';
            };
        }
    },

    navigate(view) {
        this.view = view || 'dashboard';

        if (location.hash.slice(1) !== this.view) {
            location.hash = this.view;
        }

        document.querySelectorAll('[data-view]').forEach(element => {
            element.classList.toggle(
                'active',
                element.dataset.view === this.view
            );
        });

        this.loadView();
    },

    async loadView() {
        const root = document.getElementById('app');

        if (!root) {
            return;
        }

        root.innerHTML = '<div class="loading">Loading...</div>';

        try {
            switch (this.view) {
                case 'dashboard':
                    await this.dashboard(root);
                    return;
                case 'orders':
                    await this.orders(root);
                    return;
                case 'items':
                    await this.items(root);
                    return;
                case 'payments':
                    await this.payments(root);
                    return;
                case 'invoices':
                    await this.invoices(root);
                    return;
                case 'branches':
                    await this.branches(root);
                    return;
                case 'connections':
                    await this.connections(root);
                    return;
                case 'profile':
                    this.profile(root);
                    return;
                default:
                    this.navigate('dashboard');
            }
        } catch (error) {
            this.fail(error.message);
        }
    },

    async dashboard(root) {
        const data = await API.dashboard();
        this.cache.dashboard = data;

        root.innerHTML = `
            <header>
                <div>
                    <small>Merchant / Dashboard</small>
                    <h1>${this.esc(data.merchant.trading_name)}</h1>
                    <p>Live transaction view for your eTIMS AutoInvoice account.</p>
                </div>
                <button class="primary" onclick="App.navigate('orders')">
                    + Create Order
                </button>
            </header>

            <div class="cards">
                <div>
                    <small>Today's sales</small>
                    <strong>KES ${this.money(data.stats.today_sales)}</strong>
                </div>
                <div>
                    <small>Orders</small>
                    <strong>${data.stats.orders}</strong>
                </div>
                <div>
                    <small>Matched payments</small>
                    <strong>${data.stats.matched_payments}</strong>
                </div>
                <div>
                    <small>Fiscalized invoices</small>
                    <strong>${data.stats.fiscalized_invoices}</strong>
                </div>
            </div>

            <div class="grid2">
                <section class="panel">
                    <h2>Recent Orders</h2>
                    ${this.orderTable(data.orders)}
                </section>
                <section class="panel">
                    <h2>Recent Payments</h2>
                    ${this.paymentTable(data.payments)}
                </section>
            </div>

            <section class="panel">
                <h2>Connections</h2>
                <div class="connection-row">
                    <span>KRA eTIMS</span>
                    ${this.pill(data.connections.kra?.status || 'NOT_CONNECTED')}
                    <span>M-Pesa</span>
                    ${this.pill(
                        data.connections.mpesa?.some(
                            item => item.status === 'ACTIVE'
                        ) ? 'ACTIVE' : 'PENDING'
                    )}
                </div>
            </section>
        `;
    },

    orderTable(rows) {
        if (!rows?.length) {
            return '<div class="empty">No orders yet.</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>Reference</th>
                        <th>Customer</th>
                        <th>Total</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(item => `
                        <tr>
                            <td class="mono">${this.esc(item.order_reference)}</td>
                            <td>${this.esc(item.customer_name || 'Customer')}</td>
                            <td>KES ${this.money(item.total_amount)}</td>
                            <td>${this.pill(item.status)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    paymentTable(rows) {
        if (!rows?.length) {
            return '<div class="empty">No payments yet.</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>Transaction</th>
                        <th>Reference</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(item => `
                        <tr>
                            <td class="mono">${this.esc(item.trans_id || '—')}</td>
                            <td>${this.esc(item.payment_reference || '—')}</td>
                            <td>KES ${this.money(item.amount)}</td>
                            <td>${this.pill(item.status)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async orders(root) {
        const [salesData, itemsData] = await Promise.all([
            API.sales(),
            API.items()
        ]);

        this.cache.items = itemsData.items || [];

        root.innerHTML = `
            <header>
                <div>
                    <small>Merchant / Orders</small>
                    <h1>Orders</h1>
                    <p>Create an order that can be paid using its reference.</p>
                </div>
            </header>

            <section class="panel">
                <h2>Create Order</h2>
                <form id="orderForm">
                    <div class="formgrid">
                        <label>
                            Item
                            <select id="oi" required>
                                ${this.cache.items
                                    .filter(item => item.status === 'ACTIVE')
                                    .map(item => `
                                        <option value="${this.esc(item.id)}">
                                            ${this.esc(item.name)} — KES${this.money(item.unit_price)}
                                        </option>
                                    `).join('')}
                            </select>
                        </label>

                        <label>
                            Quantity
                            <input id="oq" type="number" min="0.01"
                                step="any" value="1" required>
                        </label>
                    </div>

                    <button class="primary" type="submit">Create order</button>
                    <div id="orderMsg" aria-live="polite"></div>
                </form>
            </section>

            <section class="panel">
                <h2>Orders</h2>
                <div id="ordersTableContainer">
                    ${this.orderTable(salesData.sales)}
                </div>
            </section>
        `;

        document.getElementById('orderForm').onsubmit = async event => {
            event.preventDefault();

            const message = document.getElementById('orderMsg');
            const button = event.currentTarget.querySelector(
                'button[type="submit"]'
            );

            button.disabled = true;
            message.textContent = '';

            try {
                const result = await API.createSale({
                    items: [{
                        item_id: document.getElementById('oi').value,
                        quantity: Number(document.getElementById('oq').value)
                    }]
                });

                message.innerHTML = `
                    <div class="notice">
                        Order <b>${this.esc(result.sale.order_reference)}</b>
                        created for KES ${this.money(result.sale.total_amount)}.
                        Use the reference as the Paybill account reference.
                    </div>
                `;

                const refreshedSales = await API.sales();

                document.getElementById('ordersTableContainer').innerHTML =
                    this.orderTable(refreshedSales.sales);
            } catch (error) {
                message.innerHTML = `
                    <div class="error">${this.esc(error.message)}</div>
                `;
            } finally {
                button.disabled = false;
            }
        };
    },

    async items(root) {
        const data = await API.items();

        root.innerHTML = `
            <header>
                <div>
                    <small>Merchant / Items</small>
                    <h1>Items</h1>
                    <p>Your merchant product catalogue.</p>
                </div>
                <button class="primary"
                    onclick="document.getElementById('newItem').showModal()">
                    + Add Item
                </button>
            </header>

            <section class="panel">
                <table>
                    <thead>
                        <tr>
                            <th>SKU</th><th>Item</th><th>Unit</th>
                            <th>Price</th><th>Tax</th><th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.items || []).map(item => `
                            <tr>
                                <td class="mono">${this.esc(item.sku || '—')}</td>
                                <td>${this.esc(item.name)}</td>
                                <td>${this.esc(item.unit_code)}</td>
                                <td>KES ${this.money(item.unit_price)}</td>
                                <td>${this.money(item.tax_rate || 0)}%</td>
                                <td>${this.pill(item.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </section>

            <dialog id="newItem">
                <form id="itemForm">
                    <h2>Add item</h2>
                    <label>Item name
                        <input id="in" placeholder="Item name" required>
                    </label>
                    <label>SKU
                        <input id="is" placeholder="SKU">
                    </label>
                    <label>Unit code
                        <input id="iu" placeholder="e.g. LTR for litres" required>
                    </label>
                    <label>Unit price
                        <input id="ip" type="number" min="0"
                            step="0.01" placeholder="Unit price" required>
                    </label>
                    <label>Tax rate (%)
                        <input id="it" type="number" min="0"
                            step="0.01" value="0">
                    </label>
                    <div id="itemMsg" aria-live="polite"></div>
                    <button class="primary" type="submit">Save</button>
                    <button type="button"
                        onclick="document.getElementById('newItem').close()">
                        Cancel
                    </button>
                </form>
            </dialog>
        `;

        document.getElementById('itemForm').onsubmit = async event => {
            event.preventDefault();

            const message = document.getElementById('itemMsg');

            try {
                await API.createItem({
                    name: document.getElementById('in').value.trim(),
                    sku: document.getElementById('is').value.trim(),
                    unit_code: document.getElementById('iu').value.trim(),
                    unit_price: Number(document.getElementById('ip').value),
                    tax_rate: Number(document.getElementById('it').value || 0)
                });

                await this.items(root);
            } catch (error) {
                message.innerHTML =
                    `<div class="error">${this.esc(error.message)}</div>`;
            }
        };
    },

    async payments(root) {
        const data = await API.payments();

        root.innerHTML = `
            <header>
                <div>
                    <small>Merchant / Payments</small>
                    <h1>Payments</h1>
                    <p>Payment callbacks and their matching results.</p>
                </div>
            </header>
            <section class="panel">
                ${this.paymentTable(data.payments)}
            </section>
        `;
    },

    async invoices(root) {
        const data = await API.invoices();

        root.innerHTML = `
            <header>
                <div>
                    <small>Merchant / Invoices</small>
                    <h1>Invoices</h1>
                    <p>Internal invoices and KRA fiscalization status.</p>
                </div>
            </header>

            <section class="panel">
                <table>
                    <thead>
                        <tr>
                            <th>Invoice</th><th>Order</th><th>Total</th>
                            <th>Status</th><th>KRA receipt</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.invoices || []).map(item => `
                            <tr>
                                <td class="mono">${this.esc(item.invoice_number)}</td>
                                <td class="mono">${this.esc(item.sale_id)}</td>
                                <td>KES ${this.money(item.total_amount)}</td>
                                <td>${this.pill(item.fiscalization_status)}${item.fiscalization_status === 'FISCALIZED' ? ` <button class="secondary" onclick="App.openReceipt('${item.id}')">View receipt</button>` : ''}</td>
                                <td>${this.esc(item.kra_receipt_number || '—')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </section>
        `;
    },

    async openReceipt(id) {
        try {
            const result = await API.get('/receipts/link/' + encodeURIComponent(id));
            const w = window.open(result.url, '_blank');
            if (!w) location.href = result.url;
        } catch (error) {
            alert(error.message);
        }
    },

    async branches(root) {
        const data = await API.connections();

        root.innerHTML = `
            <header>
                <div>
                    <small>Merchant / Branches</small>
                    <h1>Branches</h1>
                    <p>Branches associated with the merchant eTIMS connection.</p>
                </div>
            </header>

            <section class="panel">
                <table>
                    <thead>
                        <tr>
                            <th>Branch</th><th>KRA ID</th>
                            <th>Head office</th><th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.branches || []).map(item => `
                            <tr>
                                <td>${this.esc(item.branch_name)} (${this.esc(item.branch_code)})</td>
                                <td class="mono">${this.esc(item.kra_bhf_id || '—')}</td>
                                <td>${item.is_head_office ? 'Yes' : 'No'}</td>
                                <td>${this.pill(item.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </section>
        `;
    },

    async connections(root) {
        const data = await API.connections();
        const firstMpesa = data.mpesa?.[0] || null;

        root.innerHTML = `
            <header>
                <div>
                    <small>Merchant / Connections</small>
                    <h1>Connections</h1>
                    <p>Technical credentials remain server-side.</p>
                </div>
            </header>

            <div class="cards">
                <div>
                    <small>KRA eTIMS</small>
                    <strong>${this.pill(data.kra?.status || 'NOT_CONNECTED')}</strong>
                    <p>${this.esc(data.kra?.last_result || 'No connection check recorded.')}</p>
                    <button class="secondary" id="kraCheck">Check KRA</button>
                    <div id="kraMsg" aria-live="polite"></div>
                </div>

                <div>
                    <small>M-Pesa / Daraja</small>
                    <strong>${this.pill(firstMpesa?.status || 'NOT_CONFIGURED')}</strong>
                    <p>${this.esc(firstMpesa?.business_shortcode || 'No shortcode')}</p>
                    <button class="secondary" id="mpReg"
                        ${firstMpesa ? '' : 'disabled'}>
                        Register callbacks
                    </button>
                    <div id="mpMsg" aria-live="polite"></div>
                </div>
            </div>
        `;

        document.getElementById('kraCheck').onclick = async () => {
            const message = document.getElementById('kraMsg');

            try {
                await API.checkKra(data.merchant.kra_pin);
                await this.connections(root);
            } catch (error) {
                message.innerHTML =
                    `<div class="error">${this.esc(error.message)}</div>`;
            }
        };

        document.getElementById('mpReg').onclick = async () => {
            const message = document.getElementById('mpMsg');

            try {
                if (!firstMpesa?.business_shortcode) {
                    throw new Error('No M-Pesa shortcode is configured.');
                }

                await API.registerMpesa(firstMpesa.business_shortcode);
                await this.connections(root);
            } catch (error) {
                message.innerHTML =
                    `<div class="error">${this.esc(error.message)}</div>`;
            }
        };
    },

    profile(root) {
        const merchant = this.cache.me.merchant || {};

        root.innerHTML = `
            <header>
                <div>
                    <small>Merchant / Business Profile</small>
                    <h1>Business Profile</h1>
                    <p>Merchant account information.</p>
                </div>
            </header>

            <section class="panel profile">
                <p><b>Trading name</b><br>${this.esc(merchant.trading_name)}</p>
                <p><b>KRA PIN</b><br><span class="mono">${this.esc(merchant.kra_pin)}</span></p>
                <p><b>Business phone</b><br>${this.esc(merchant.business_phone || '—')}</p>
            </section>
        `;
    },

    fail(message) {
        const root = document.getElementById('app');

        if (root) {
            root.innerHTML =
                `<div class="error">${this.esc(message || 'An unexpected error occurred.')}</div>`;
        }
    }
};

window.App = App;

window.addEventListener('hashchange', () => {
    App.navigate(location.hash.slice(1));
});

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
