const Dashboard = {

  data: null,

  money(value) {
    return Number(value || 0).toLocaleString(
      'en-KE',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
  },

  date(value) {
    if (!value) return '—';

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return '—';
    }

    return d.toLocaleString(
      'en-KE',
      {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    );
  },

  escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  status(value) {
    const v = String(value || 'UNKNOWN');

    const cls =
      v === 'CLOSED' ||
      v === 'MATCHED' ||
      v === 'FISCALIZED' ||
      v === 'ACTIVE'
        ? 'green'
        : v === 'UNMATCHED' ||
          v === 'AWAITING_PAYMENT' ||
          v === 'PROCESSING' ||
          v === 'PENDING'
        ? 'amber'
        : 'gray';

    return `<span class="pill ${cls}">${this.escape(v.replaceAll('_', ' '))}</span>`;
  },

  async load() {
    const root = document.getElementById('dashboard-loading');

    try {
      if (root) root.textContent = 'Loading live business data…';

      this.data = await API.dashboard();

      this.render();

    } catch (error) {

      console.error(error);

      if (root) {
        root.textContent = error.message;
      }

      const errorBox =
        document.getElementById('dashboard-error');

      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = error.message;
      }
    }
  },

  render() {
    const d = this.data;

    if (!d) return;

    const merchant = d.merchant || {};
    const stats = d.stats || {};
    const connections = d.connections || {};

    document.title =
      `${merchant.trading_name || 'Merchant'} | eTIMS AutoInvoice`;

    this.text(
      'business-name',
      merchant.trading_name || 'Business'
    );

    this.text(
      'merchant-name',
      merchant.trading_name || 'Merchant'
    );

    this.text(
      'merchant-pin',
      merchant.kra_pin || '—'
    );

    this.text(
      'stat-sales',
      `KES ${this.money(stats.today_sales)}`
    );

    this.text(
      'stat-payments',
      stats.matched_payments
    );

    this.text(
      'stat-orders',
      stats.orders
    );

    this.text(
      'stat-invoices',
      stats.fiscalized_invoices
    );

    this.text(
      'stat-items',
      stats.items
    );

    this.text(
      'stat-unmatched',
      stats.unmatched_payments
    );

    this.connection(
      'kra-status',
      connections.kra_status
    );

    const mpesa =
      Array.isArray(connections.mpesa)
        ? connections.mpesa
        : [];

    const activeMpesa =
      mpesa.some(x =>
        x.status === 'ACTIVE'
      );

    this.connection(
      'mpesa-status',
      activeMpesa ? 'ACTIVE' : 'PENDING'
    );

    this.renderOrders(d.orders || []);
    this.renderPayments(d.payments || []);
    this.renderInvoices(d.invoices || []);
    this.renderBranches(d.branches || []);
  },

  renderOrders(rows) {
    const body =
      document.getElementById('orders-body');

    if (!body) return;

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="5" class="empty">
            No orders have been created yet.
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows.map(row => `
      <tr>
        <td class="mono">
          ${this.escape(row.order_reference)}
        </td>

        <td>
          ${this.escape(row.customer_name || 'Walk-in customer')}
        </td>

        <td>
          KES ${this.money(row.total_amount)}
        </td>

        <td>
          ${this.status(row.status)}
        </td>

        <td>
          ${this.date(row.created_at)}
        </td>
      </tr>
    `).join('');
  },

  renderPayments(rows) {
    const body =
      document.getElementById('payments-body');

    if (!body) return;

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="5" class="empty">
            No M-Pesa payments have been received yet.
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows.map(row => `
      <tr>
        <td class="mono">
          ${this.escape(row.trans_id || '—')}
        </td>

        <td>
          ${this.escape(row.payer_name || '—')}
        </td>

        <td>
          KES ${this.money(row.amount)}
        </td>

        <td>
          ${this.status(row.status)}
        </td>

        <td>
          ${this.date(row.paid_at)}
        </td>
      </tr>
    `).join('');
  },

  renderInvoices(rows) {
    const body =
      document.getElementById('invoices-body');

    if (!body) return;

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="5" class="empty">
            No invoices have been created yet.
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows.map(row => `
      <tr>
        <td class="mono">
          ${this.escape(row.invoice_number)}
        </td>

        <td>
          ${this.escape(row.buyer_name || 'Walk-in customer')}
        </td>

        <td>
          KES ${this.money(row.total_amount)}
        </td>

        <td>
          ${this.status(row.fiscalization_status)}
        </td>

        <td>
          ${this.escape(row.kra_receipt_number || '—')}
        </td>
      </tr>
    `).join('');
  },

  renderBranches(rows) {
    const body =
      document.getElementById('branches-body');

    if (!body) return;

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4" class="empty">
            No branches have been registered.
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows.map(row => `
      <tr>
        <td>
          ${this.escape(row.branch_name || '—')}
        </td>

        <td class="mono">
          ${this.escape(row.branch_id || '—')}
        </td>

        <td>
          ${this.escape(row.address || '—')}
        </td>

        <td>
          ${this.status(row.status)}
        </td>
      </tr>
    `).join('');
  },

  connection(id, value) {
    const el = document.getElementById(id);

    if (!el) return;

    const active =
      value === 'ACTIVE' ||
      value === 'VERIFIED' ||
      value === 'CONNECTED';

    el.innerHTML = `
      <span class="dot ${active ? 'online' : 'offline'}"></span>
      ${active ? 'Connected' : 'Not connected'}
    `;
  },

  text(id, value) {
    const el = document.getElementById(id);

    if (el) {
      el.textContent = value;
    }
  }
};

document.addEventListener(
  'DOMContentLoaded',
  () => Dashboard.load()
);

window.Dashboard = Dashboard;
