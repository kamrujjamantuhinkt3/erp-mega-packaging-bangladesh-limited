/* Mega Packaging ERP: the one place the frontend talks to the PHP backend in /api */
const Api = (() => {
  'use strict';

  // Issued by api/session.php; sent back with every POST so the backend knows the request came from this app
  let csrfToken = '';

  /**
   * Calls an API endpoint and resolves to { ok, status, data }.
   * Only rejects when the server can't be reached at all.
   */
  async function request(endpoint, { method = 'GET', data } = {}) {
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
    if (data !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`api/${endpoint}`, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (typeof payload.csrf === 'string') csrfToken = payload.csrf;

    return { ok: response.ok && payload.ok === true, status: response.status, data: payload };
  }

  return {
    session: () => request('session.php'),
    // step one: email or username + password (texts a one-time code to the account's mobile)
    login: (identifier, password) => request('login.php', { method: 'POST', data: { identifier, password } }),
    // step two: the one-time code
    verifyOtp: (code) => request('verify-otp.php', { method: 'POST', data: { code } }),
    resendOtp: () => request('resend-otp.php', { method: 'POST' }),
    logout: () => request('logout.php', { method: 'POST' }),
    // setup.html: is the database ready, and is there an administrator yet?
    setupStatus: () => request('setup.php'),
    // setup.html: create (or replace) the administrator; needs the setup key
    setup: (details) => request('setup.php', { method: 'POST', data: details }),
  };
})();
