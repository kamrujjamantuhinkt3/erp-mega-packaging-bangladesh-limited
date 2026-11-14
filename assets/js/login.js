/* Mega Packaging ERP: sign-in page
   Step 1: email or username + password.  Step 2: the one-time code texted to the
   account's mobile.  Then the dashboard. Every check happens in the PHP API (api.js);
   this file runs the page around it. */
(() => {
  'use strict';

  const DASHBOARD_URL = 'dashboard.html';
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const $ = (id) => document.getElementById(id);

  const steps = $('authSteps');
  const panes = { signin: $('paneSignin'), otp: $('paneOtp'), done: $('paneDone') };
  let pane = 'signin';

  /* ---------- Small things that make the page feel alive ---------- */

  $('year').textContent = String(new Date().getFullYear());

  const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

  function tick() {
    const now = new Date();
    const hour = now.getHours();
    $('clockText').textContent = `${dateFormat.format(now)} · ${timeFormat.format(now)}`;
    $('greeting').textContent = hour >= 5 && hour < 12 ? 'Good morning'
      : hour >= 12 && hour < 17 ? 'Good afternoon'
      : hour >= 17 && hour < 22 ? 'Good evening'
      : 'Welcome back';
  }

  tick();
  setInterval(tick, 15000);

  /* ---------- Panes, messages, buttons ---------- */

  function showPane(name, { back = false } = {}) {
    if (pane === name) return;
    panes[pane].classList.remove('is-active', 'from-left');
    panes[name].classList.toggle('from-left', back);
    panes[name].classList.add('is-active');
    pane = name;
    steps.dataset.step = { signin: '1', otp: '2', done: '3' }[name];
  }

  function showAlert(box, message, tone = 'error') {
    box.querySelector('.alert__text').textContent = message;
    box.classList.toggle('alert--info', tone === 'info');
    box.classList.add('is-visible');
  }

  function hideAlert(box) {
    box.classList.remove('is-visible');
  }

  function shake(el) {
    el.classList.remove('is-shaking');
    void el.offsetWidth; // restart the animation
    el.classList.add('is-shaking');
  }

  function setBusy(button, on, label) {
    button.classList.toggle('is-loading', on);
    button.setAttribute('aria-busy', String(on));
    if (label) button.querySelector('.btn__label').textContent = label;
  }

  /* ---------- Session ---------- */

  // Already signed in: on to the dashboard. Part-way through (password done, code pending,
  // e.g. after a reload): back to the code. The reply also carries the CSRF token.
  function checkSession() {
    const check = Api.session().then((result) => {
      if (result.data.authenticated) window.location.replace(DASHBOARD_URL);
      else if (result.data.otp && pane === 'signin') openOtp(result.data.otp, { resumed: true });
      return result;
    });
    check.catch(() => {}); // if the server is unreachable, that's reported when they try to sign in
    return check;
  }

  let session = checkSession();

  async function ensureSession() {
    try {
      await session;
    } catch (error) {
      session = checkSession();
      await session;
    }
  }

  // A 403 means the security token went stale (page left open a long time); the reply carries a new one
  async function withFreshToken(call) {
    const result = await call();
    return result.status === 403 ? call() : result;
  }

  /* ---------- Step 1: email or username, and password ---------- */

  const signinForm = panes.signin;
  const signinBody = signinForm.querySelector('.pane__body');
  const signinAlert = $('signinAlert');
  const signinBtn = $('signinBtn');
  const identifier = $('identifier');
  const identifierField = $('identifierField');
  const password = $('password');
  const capsNote = $('capsNote');
  const toggle = signinForm.querySelector('.field__toggle');
  let signingIn = false;

  function markInvalid(fields) {
    for (const input of [identifier, password]) {
      const invalid = fields.includes(input);
      input.closest('.field').classList.toggle('is-invalid', invalid);
      if (invalid) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  for (const input of [identifier, password]) {
    input.addEventListener('input', () => {
      input.closest('.field').classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    });
  }

  // the person icon turns into an envelope once an email address is being typed
  identifier.addEventListener('input', () => {
    identifierField.classList.toggle('is-email', identifier.value.includes('@'));
  });

  // a gentle warning when Caps Lock is on
  function checkCaps(event) {
    if (event.getModifierState) capsNote.hidden = !event.getModifierState('CapsLock');
  }
  password.addEventListener('keydown', checkCaps);
  password.addEventListener('keyup', checkCaps);
  password.addEventListener('blur', () => { capsNote.hidden = true; });

  // show / hide the password, without taking focus away from it
  toggle.addEventListener('mousedown', (event) => event.preventDefault());
  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (signingIn) return;

    const missing = [];
    if (identifier.value.trim() === '') missing.push(identifier);
    if (password.value === '') missing.push(password);
    if (missing.length) {
      const message = missing.length === 2
        ? 'Please enter your email or username and your password.'
        : missing[0] === identifier ? 'Please enter your email or username.' : 'Please enter your password.';
      showAlert(signinAlert, message);
      markInvalid(missing);
      shake(signinBody);
      missing[0].focus();
      return;
    }

    hideAlert(signinAlert);
    markInvalid([]);
    signingIn = true;
    setBusy(signinBtn, true, 'Checking…');

    try {
      await ensureSession();
      const id = identifier.value.trim();
      // a short minimum keeps the spinner from flashing on a fast server
      const [result] = await Promise.all([
        withFreshToken(() => Api.login(id, password.value)),
        wait(reduceMotion ? 0 : 600),
      ]);
      setBusy(signinBtn, false, 'Continue');

      if (result.ok) {
        openOtp(result.data.otp);
        return;
      }
      showAlert(signinAlert, result.data.error || 'Sign-in failed. Please try again.');
      if (result.status === 401) markInvalid([identifier, password]);
      shake(signinBody);
      password.focus();
      password.select();
    } catch (error) {
      setBusy(signinBtn, false, 'Continue');
      showAlert(signinAlert, "Couldn't reach the server. Check your connection and try again.");
    } finally {
      signingIn = false;
    }
  });

  /* ---------- Step 2: the one-time code ---------- */

  const otpForm = panes.otp;
  const otpAlert = $('otpAlert');
  const otpBtn = $('otpBtn');
  const otpWrap = $('otpBoxes');
  const boxes = [...otpWrap.querySelectorAll('.otp__box')];
  const expiry = $('otpExpiry');
  const resendBtn = $('resendBtn');
  const resendLabel = $('resendLabel');
  const resendProgress = otpForm.querySelector('.resend__progress');
  const devNote = $('devNote');
  let verifying = false;
  let timer = 0;
  let resendAt = 0;
  let resendTotal = 45;
  let expiresAt = 0;
  let resendsLeft = 0;

  const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const code = () => boxes.map((box) => box.value).join('');

  function openOtp(status, { resumed = false } = {}) {
    $('otpMobile').textContent = status.mobile;
    password.value = '';
    clearBoxes();
    hideAlert(otpAlert);
    otpWrap.classList.remove('is-invalid', 'is-valid');
    otpBtn.classList.remove('is-success');
    applyStatus(status);
    showPane('otp');
    if (!resumed) setTimeout(() => boxes[0].focus(), reduceMotion ? 0 : 320);
  }

  // timers and the development note follow what the server says about the code
  function applyStatus(status) {
    const now = Date.now();
    resendAt = now + status.resend_in * 1000;
    resendTotal = status.resend_after || 45;
    expiresAt = now + status.expires_in * 1000;
    resendsLeft = status.resends_left;

    if (status.dev_code) {
      $('devCode').textContent = status.dev_code.replace(/^(\d{3})(\d+)$/, '$1 $2');
      devNote.dataset.code = status.dev_code;
      devNote.hidden = false;
    } else {
      devNote.hidden = true;
    }

    clearInterval(timer);
    timer = setInterval(renderTimers, 250);
    renderTimers();
  }

  function renderTimers() {
    const now = Date.now();
    const untilResend = Math.max(0, Math.ceil((resendAt - now) / 1000));
    const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));

    if (resendsLeft <= 0) {
      resendBtn.disabled = true;
      resendLabel.textContent = 'No more codes for this sign-in';
    } else if (untilResend > 0) {
      resendBtn.disabled = true;
      resendLabel.textContent = `Resend in ${clock(untilResend)}`;
      resendProgress.style.strokeDashoffset = String(untilResend / resendTotal);
    } else if (resendBtn.disabled && resendLabel.textContent !== 'Sending…') {
      resendBtn.disabled = false;
      resendLabel.textContent = 'Resend code';
    }

    expiry.textContent = left > 0 ? `Expires in ${clock(left)}` : 'Code expired';
    expiry.classList.toggle('is-expired', left === 0);
  }

  function clearBoxes() {
    for (const box of boxes) {
      box.value = '';
      box.classList.remove('is-filled');
    }
  }

  // puts digits into the boxes from `start`, moves on, and submits once all are filled
  function fillFrom(start, digits) {
    let i = start;
    for (const digit of digits) {
      if (i >= boxes.length) break;
      boxes[i].value = digit;
      boxes[i].classList.add('is-filled');
      i++;
    }
    boxes[Math.min(i, boxes.length - 1)].focus();
    if (code().length === boxes.length) submitOtp();
  }

  boxes.forEach((box, i) => {
    box.addEventListener('focus', () => box.select());

    box.addEventListener('keydown', (event) => {
      if (/^\d$/.test(event.key)) {
        box.value = ''; // typing over a filled box replaces its digit
      } else if (event.key === 'Backspace' && box.value === '' && i > 0) {
        event.preventDefault();
        boxes[i - 1].value = '';
        boxes[i - 1].classList.remove('is-filled');
        boxes[i - 1].focus();
      } else if (event.key === 'ArrowLeft' && i > 0) {
        event.preventDefault();
        boxes[i - 1].focus();
      } else if (event.key === 'ArrowRight' && i < boxes.length - 1) {
        event.preventDefault();
        boxes[i + 1].focus();
      }
    });

    // typing, or the phone's "code from Messages" suggestion (which can bring all six at once)
    box.addEventListener('input', () => {
      const digits = box.value.replace(/\D/g, '');
      box.value = '';
      box.classList.remove('is-filled');
      if (!digits) return;
      otpWrap.classList.remove('is-invalid');
      fillFrom(i, digits);
    });

    // pasting the whole code into any box
    box.addEventListener('paste', (event) => {
      const digits = (event.clipboardData.getData('text') || '').replace(/\D/g, '');
      if (!digits) return;
      event.preventDefault();
      clearBoxes();
      otpWrap.classList.remove('is-invalid');
      fillFrom(0, digits);
    });
  });

  otpForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitOtp();
  });

  async function submitOtp() {
    if (verifying) return;
    const entered = code();
    if (entered.length < boxes.length) {
      showAlert(otpAlert, `Please enter all ${boxes.length} digits of the code.`);
      otpWrap.classList.add('is-invalid');
      shake(otpWrap);
      boxes[entered.length].focus();
      return;
    }

    verifying = true;
    hideAlert(otpAlert);
    otpWrap.classList.remove('is-invalid');
    setBusy(otpBtn, true, 'Verifying…');

    try {
      const [result] = await Promise.all([
        withFreshToken(() => Api.verifyOtp(entered)),
        wait(reduceMotion ? 0 : 500),
      ]);

      if (result.ok) {
        otpWrap.classList.add('is-valid');
        setBusy(otpBtn, false, 'Verified');
        otpBtn.classList.add('is-success');
        await wait(reduceMotion ? 0 : 450);
        finish(result.data.user);
        return;
      }

      setBusy(otpBtn, false, 'Verify & sign in');
      if (result.data.restart) {
        restart(result.data.error);
        return;
      }
      if (result.data.otp) applyStatus(result.data.otp);
      showAlert(otpAlert, result.data.error || "That code didn't work. Please try again.");
      otpWrap.classList.add('is-invalid');
      shake(otpWrap);
      clearBoxes();
      boxes[0].focus();
    } catch (error) {
      setBusy(otpBtn, false, 'Verify & sign in');
      showAlert(otpAlert, "Couldn't reach the server. Check your connection and try again.");
    } finally {
      verifying = false;
    }
  }

  resendBtn.addEventListener('click', async () => {
    if (resendBtn.disabled) return;
    resendBtn.disabled = true;
    resendLabel.textContent = 'Sending…';

    try {
      const result = await withFreshToken(() => Api.resendOtp());
      resendLabel.textContent = '';
      if (result.ok) {
        applyStatus(result.data.otp);
        clearBoxes();
        otpWrap.classList.remove('is-invalid');
        showAlert(otpAlert, `A new code is on its way to ${$('otpMobile').textContent}.`, 'info');
        boxes[0].focus();
      } else if (result.data.restart) {
        restart(result.data.error);
      } else {
        if (result.data.otp) applyStatus(result.data.otp);
        showAlert(otpAlert, result.data.error || "Couldn't send a new code. Please try again.");
      }
    } catch (error) {
      resendLabel.textContent = '';
      showAlert(otpAlert, "Couldn't reach the server. Check your connection and try again.");
    }
    renderTimers();
  });

  // Development only (no SMS gateway yet): types the shown code into the boxes
  $('devFill').addEventListener('click', async () => {
    const devCode = devNote.dataset.code || '';
    clearBoxes();
    otpWrap.classList.remove('is-invalid');
    hideAlert(otpAlert);
    for (let i = 0; i < devCode.length - 1; i++) {
      boxes[i].value = devCode[i];
      boxes[i].classList.add('is-filled');
      boxes[i + 1].focus();
      await wait(reduceMotion ? 0 : 70);
    }
    fillFrom(devCode.length - 1, devCode.slice(-1));
  });

  // back to the password: the pending sign-in is dropped on the server too
  $('otpBack').addEventListener('click', async () => {
    clearInterval(timer);
    showPane('signin', { back: true });
    hideAlert(signinAlert);
    identifier.focus();
    identifier.select();
    try {
      await Api.logout();
    } catch (error) { /* nothing to undo */ }
    session = checkSession(); // a fresh token for the next attempt
  });

  function restart(message) {
    clearInterval(timer);
    showPane('signin', { back: true });
    showAlert(signinAlert, message);
    password.value = '';
    password.focus();
  }

  /* ---------- Signed in ---------- */

  async function finish(user) {
    clearInterval(timer);
    $('doneName').textContent = user && user.name ? user.name : 'back';
    showPane('done');
    await wait(reduceMotion ? 300 : 1550);
    body.classList.add('is-leaving');
    await wait(reduceMotion ? 0 : 450);
    window.location.assign(DASHBOARD_URL);
  }

  /* ---------- After the preloader ---------- */

  function focusFirst() {
    // skip on touch screens so the on-screen keyboard doesn't pop up uninvited
    if (!window.matchMedia('(pointer: fine)').matches || document.activeElement !== body) return;
    if (pane === 'otp') boxes[0].focus();
    else if (pane === 'signin') identifier.focus({ preventScroll: true });
  }

  // assets/js/preloader.js announces when the sign-in has been uncovered
  if ($('preloader')) {
    document.addEventListener('preloader:done', focusFirst, { once: true });
  } else {
    focusFirst();
  }

  // coming back with the browser's Back button: reload so the session check runs again
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
})();
