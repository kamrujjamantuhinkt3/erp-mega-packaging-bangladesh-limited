/* Mega Packaging ERP: dashboard (signed-in users only; its content comes in a later step) */
(() => {
  'use strict';

  // Show the page only once the backend confirms someone is signed in
  async function requireSignIn() {
    try {
      const { data } = await Api.session();
      if (!data.authenticated) {
        window.location.replace('login.html');
        return;
      }
      document.documentElement.classList.remove('is-checking');
    } catch (error) {
      // Server unreachable: the sign-in page explains what went wrong
      window.location.replace('login.html');
    }
  }

  // Check again when the page comes back from the browser's Back/Forward cache
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) requireSignIn();
  });

  requireSignIn();
})();
