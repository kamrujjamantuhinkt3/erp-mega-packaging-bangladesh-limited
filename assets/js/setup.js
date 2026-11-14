/* Mega Packaging ERP: administrator setup (setup.html)
   1. Checks the database (api/setup.php connects, and makes the tables if they're missing).
   2. Takes the setup key (the database password) and the administrator's details.
   3. Shows who was set up, and the way to sign in.
   Every check happens in the PHP API; this file runs the page around it. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const panes = { check: $('paneCheck'), problem: $('paneProblem'), form: $('paneForm'), done: $('paneDone') };
  const form = panes.form;
  const formAlert = $('formAlert');
  const saveBtn = $('saveBtn');
  const retryBtn = $('retryBtn');
  const inputs = ['key', 'name', 'username', 'email', 'mobile', 'password', 'password2'].reduce((all, id) => {
    all[id] = $(id);
    return all;
  }, {});
  let pane = 'check';

  $('year').textContent = String(new Date().getFullYear());

  /* ---------- Panes, messages, buttons ---------- */

  function showPane(name) {
    if (pane === name) return;
    panes[pane].classList.remove('is-active');
    panes[name].classList.add('is-active');
    pane = name;
  }

  function showAlert(message) {
    formAlert.querySelector('.alert__text').textContent = message;
    formAlert.classList.add('is-visible');
  }

  function hideAlert() {
    formAlert.classList.remove('is-visible');
  }

  function setBusy(button, on) {
    button.classList.toggle('is-loading', on);
    button.disabled = on;
    button.setAttribute('aria-busy', String(on));
  }

  function shake(el) {
    el.classList.remove('is-shaking');
    void el.offsetWidth; // restart the animation
    el.classList.add('is-shaking');
  }

  function markInvalid(name, message) {
    const input = inputs[name];
    if (!input) return;
    input.closest('.field').classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    if (message) showAlert(message);
    shake(input.closest('.field'));
    input.focus();
  }

  function clearInvalid(input) {
    input.closest('.field').classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  }

  /* ---------- 1. Is the database ready? ---------- */

  async function checkDatabase() {
    setBusy(retryBtn, true);
    try {
      const result = await Api.setupStatus();
      if (!result.ok) {
        $('problemText').textContent = result.data.error
          || `The server answered with an error (${result.status}). Please try again.`;
        showPane('problem');
        return;
      }
      openForm(result.data.has_admin === true);
    } catch (error) {
      $('problemText').textContent = "Couldn't reach the ERP's server. Open this page from the ERP's own address "
        + '(for example https://erp.megapackagingbd.com/setup.html), where PHP runs.';
      showPane('problem');
    } finally {
      setBusy(retryBtn, false);
    }
  }

  function openForm(hasAdmin) {
    $('formTitle').textContent = hasAdmin ? 'Reset the administrator' : 'Create the administrator';
    $('formLead').textContent = hasAdmin
      ? 'Enter the administrator\'s details and a new password.'
      : 'This is the first account of the ERP. It signs in with a password, then a code texted to its mobile.';
    $('existsNote').classList.toggle('is-visible', hasAdmin);
    saveBtn.querySelector('.btn__label').textContent = hasAdmin ? 'Save administrator' : 'Create administrator';
    showPane('form');
    inputs.key.focus();
  }

  retryBtn.addEventListener('click', checkDatabase);

  /* ---------- 2. The form ---------- */

  form.querySelectorAll('.field__toggle').forEach((toggle) => {
    const input = $(toggle.getAttribute('aria-controls'));
    toggle.addEventListener('mousedown', (event) => event.preventDefault()); // keep the cursor in the field
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} ${toggle.getAttribute('aria-label').replace(/^(Show|Hide) /, '')}`);
    });
  });

  Object.values(inputs).forEach((input) => {
    input.addEventListener('input', () => {
      clearInvalid(input);
      hideAlert();
    });
  });

  // Password strength: length and variety, shown as four bars (the server only insists on 10+ characters)
  const meter = $('meter');
  const confirmField = inputs.password2.closest('.field');

  function strength(value) {
    if (!value) return 0;
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
    if (value.length < 10) return 1;
    if (value.length >= 14 && kinds >= 3) return 4;
    return kinds >= 3 ? 3 : 2;
  }

  function updatePasswordHints() {
    meter.dataset.score = String(strength(inputs.password.value));
    confirmField.classList.toggle('is-match',
      inputs.password2.value !== '' && inputs.password2.value === inputs.password.value);
  }

  inputs.password.addEventListener('input', updatePasswordHints);
  inputs.password2.addEventListener('input', updatePasswordHints);

  // The same checks the server makes, so most mistakes are pointed out straight away
  function firstProblem(values) {
    if (!values.key) return ['key', 'Enter the setup key: the database password.'];
    if (!values.name.trim()) return ['name', "Enter the administrator's full name."];
    if (!/^[a-z0-9][a-z0-9._-]{2,49}$/i.test(values.username.trim())) {
      return ['username', 'Choose a username of 3 to 50 characters: letters, numbers, dots, dashes or underscores.'];
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return ['email', 'Enter a valid email address.'];
    if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(values.mobile.replace(/[\s\-().]/g, ''))) {
      return ['mobile', 'Enter a Bangladeshi mobile number, for example 01712-345678. The sign-in code is sent there.'];
    }
    if (values.password.length < 10) return ['password', 'Choose a password of at least 10 characters.'];
    if (values.password !== values.password2) return ['password2', "The two passwords don't match."];
    return null;
  }

  // A 403 means the security token went stale (page left open a long time); the reply carries a new one
  async function withFreshToken(call) {
    const result = await call();
    return result.status === 403 ? call() : result;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saveBtn.disabled) return;
    hideAlert();

    const values = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, input.value]));
    const problem = firstProblem(values);
    if (problem) {
      markInvalid(problem[0], problem[1]);
      return;
    }

    setBusy(saveBtn, true);
    try {
      const result = await withFreshToken(() => Api.setup(values));
      if (result.ok) {
        finish(result.data);
        return;
      }
      const message = result.data.error || `Setup failed (${result.status}). Please try again.`;
      if (result.data.field) markInvalid(result.data.field, message);
      else {
        showAlert(message);
        shake(form);
      }
    } catch (error) {
      showAlert("Couldn't reach the server. Check the connection and try again.");
    } finally {
      setBusy(saveBtn, false);
    }
  });

  /* ---------- 3. Done ---------- */

  function finish(data) {
    const admin = data.admin || {};
    $('doneTitle').textContent = data.created ? 'Administrator ready' : 'Administrator updated';
    $('doneName').textContent = admin.name || '';
    $('doneUsername').textContent = admin.username || '';
    $('doneEmail').textContent = admin.email || '';
    $('doneMobile').textContent = admin.mobile || '';
    form.reset(); // the key and passwords leave the page
    updatePasswordHints();
    showPane('done');
  }

  checkDatabase();
})();
