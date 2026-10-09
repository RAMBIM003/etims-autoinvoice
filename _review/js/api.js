const API = {
  BASE: 'http://localhost:5000/api',

  norm(v) {
    v = String(v || '').replace(/[\s+]/g, '');
    return v.startsWith('0') ? '254' + v.slice(1) : v;
  },

  phoneOk(v) {
    return /^254[17]\d{8}$/.test(this.norm(v));
  },

  async req(path, options = {}) {
    const opts = { ...options };

    opts.headers = {
      ...(options.headers || {})
    };

    if (localStorage.token) {
      opts.headers.Authorization =
        'Bearer ' + localStorage.token;
    }

    let response;

    try {
      response = await fetch(this.BASE + path, opts);
    } catch (err) {
      throw new Error(
        'Cannot reach the API. Start the backend with npm start.'
      );
    }

    const data = await response
      .json()
      .catch(() => ({}));

    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/sign_merchant.html';
      throw new Error('Your session has expired.');
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        'Request failed'
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });
  },

  put(path, body) {
    return this.req(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });
  },

  delete(path) {
    return this.req(path, {
      method: 'DELETE'
    });
  },

  dashboard() {
    return this.get('/dashboard');
  },

  me() {
    return this.get('/auth/me');
  },

  items() {
    return this.get('/items');
  },

  sales() {
    return this.get('/sales');
  }
};

window.API = API;
