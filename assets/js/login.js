/* Mega Packaging ERP: sign-in page (preloader, sign-in form, password toggle) */
(() => {
  'use strict';

  const DASHBOARD_URL = 'dashboard.html';
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const form = document.getElementById('loginForm');
  const alertBox = document.getElementById('formAlert');
  const alertText = alertBox.querySelector('.alert__text');
  const button = form.querySelector('.btn-signin');
  const buttonLabel = button.querySelector('.btn-signin__label');
  const toggle = form.querySelector('.field__toggle');
  const username = form.elements.namedItem('username');
  const password = form.elements.namedItem('password');
  let busy = false;

  document.getElementById('year').textContent = String(new Date().getFullYear());

  /* ---------- Session ---------- */

  // Ask the backend who is signed in: already signed in skips straight to the dashboard,
  // and the reply carries the CSRF token needed to sign in
  function checkSession() {
    const check = Api.session().then((result) => {
      if (result.data.authenticated) window.location.replace(DASHBOARD_URL);
      return result;
    });
    check.catch(() => {}); // if the server is unreachable, that's reported when they try to sign in
    return check;
  }

  let session = checkSession();

  /* ---------- After the preloader ---------- */

  function focusUsername() {
    // Skip on touch screens so the on-screen keyboard doesn't pop up uninvited
    if (window.matchMedia('(pointer: fine)').matches && document.activeElement === body) {
      username.focus({ preventScroll: true });
    }
  }

  // assets/js/preloader.js announces when the sign-in has been uncovered
  if (document.getElementById('preloader')) {
    document.addEventListener('preloader:done', focusUsername, { once: true });
  } else {
    focusUsername();
  }

  /* ---------- Errors ---------- */

  function markInvalid(fields) {
    for (const input of [username, password]) {
      const invalid = fields.includes(input);
      input.closest('.field').classList.toggle('is-invalid', invalid);
      if (invalid) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function showError(message, fields = []) {
    alertText.textContent = message;
    alertBox.classList.add('is-visible');
    markInvalid(fields);
    form.classList.remove('is-shaking');
    void form.offsetWidth; // restart the shake animation
    form.classList.add('is-shaking');
  }

  function clearError() {
    alertBox.classList.remove('is-visible');
    markInvalid([]);
  }

  for (const input of [username, password]) {
    input.addEventListener('input', () => {
      input.closest('.field').classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    });
  }

  /* ---------- Sign in ---------- */

  function setBusy(on) {
    busy = on;
    button.classList.toggle('is-loading', on);
    button.setAttribute('aria-busy', String(on));
    buttonLabel.textContent = on ? 'Signing in…' : 'Sign in';
    username.readOnly = on;
    password.readOnly = on;
  }

  async function signIn() {
    // The first session check may have failed (e.g. server still starting): try it again
    try {
      await session;
    } catch (error) {
      session = checkSession();
      await session;
    }

    const user = username.value.trim();
    let result = await Api.login(user, password.value);
    // 403 = the security token went stale (page left open for hours); the reply carries a new one
    if (result.status === 403) result = await Api.login(user, password.value);
    return result;
  }

  async function finishSignIn() {
    button.classList.remove('is-loading');
    button.classList.add('is-success');
    buttonLabel.textContent = 'Welcome!';
    await wait(reduceMotion ? 150 : 700);
    body.classList.add('is-leaving');
    await wait(reduceMotion ? 50 : 500);
    window.location.assign(DASHBOARD_URL);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;

    const missing = [];
    if (username.value.trim() === '') missing.push(username);
    if (password.value === '') missing.push(password);
    if (missing.length) {
      const message = missing.length === 2
        ? 'Please enter your username and password.'
        : `Please enter your ${missing[0] === username ? 'username' : 'password'}.`;
      showError(message, missing);
      missing[0].focus();
      return;
    }

    clearError();
    setBusy(true);

    try {
      // A short minimum keeps the spinner from flashing on a fast server
      const [result] = await Promise.all([signIn(), wait(reduceMotion ? 0 : 650)]);

      if (result.ok) {
        await finishSignIn();
        return;
      }

      setBusy(false);
      showError(
        result.data.error || 'Sign-in failed. Please try again.',
        result.status === 401 ? [username, password] : []
      );
      password.focus();
      password.select();
    } catch (error) {
      setBusy(false);
      showError('Could not reach the server. Check your connection and try again.');
    }
  });

  /* ---------- Show / hide password ---------- */

  // Keep focus in the password box when the eye is clicked with a mouse
  toggle.addEventListener('mousedown', (event) => event.preventDefault());
  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  // Coming back with the browser's Back button after signing in: reload so the session check runs again
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
})();
