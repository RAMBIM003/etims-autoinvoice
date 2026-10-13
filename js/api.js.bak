const API = {
    BASE: 'http://localhost:5000/api',

    async req(path, options = {}) {
        const requestOptions = {
            ...options,
            headers: { ...(options.headers || {}) }
        };

        if (localStorage.token) {
            requestOptions.headers.Authorization =
                'Bearer ' + localStorage.token;
        }

        let response;

        try {
            response = await fetch(this.BASE + path, requestOptions);
        } catch {
            throw new Error(
                'Cannot reach the API. Start the backend with npm start.'
            );
        }

        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            localStorage.removeItem('token');
            location.href = '/sign_merchant.html';
            throw new Error('Your session has expired.');
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                data.ResultDesc ||
                `Request failed (${response.status})`
            );
        }

        return data;
    },

    get(path) {
        return this.req(path);
    },

    post(path, body) {
        return this.req(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        });
    },

    put(path, body) {
        return this.req(path, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        });
    },

    delete(path) {
        return this.req(path, { method: 'DELETE' });
    },

    me() {
        return this.get('/auth/me');
    },

    dashboard() {
        return this.get('/dashboard');
    },

    items() {
        return this.get('/items');
    },

    createItem(body) {
        return this.post('/items', body);
    },

    sales() {
        return this.get('/sales');
    },

    createSale(body) {
        return this.post('/sales', body);
    },

    payments() {
        return this.get('/payments');
    },

    invoices() {
        return this.get('/invoices');
    },

    // connections.js is mounted at /api.
    connections() {
        return this.get('/');
    },

    checkKra(pin) {
        return this.post('/kra/check', { kra_pin: pin });
    },

    registerMpesa(shortcode) {
        return this.post('/mpesa/register', { shortcode });
    },

    fiscalizeSale(saleId) {
        return this.post(
            `/kra/fiscalize/${encodeURIComponent(saleId)}`,
            {}
        );
    }
};

window.API = API;
