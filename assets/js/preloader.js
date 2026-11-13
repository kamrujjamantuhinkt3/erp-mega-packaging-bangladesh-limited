/* ---------------------------------------------------------------------------
   preloader.js: when the department film (assets/css/preloader.css) hands over.

   It lets go once the page and its fonts have loaded and the film has run to
   the end: every department shown, the Mega logo's ring complete and its tick
   in place (about eight seconds). A click or a key skips straight to the
   sign-in; a ceiling means a slow connection can never strand the page.

   The steps under the film are animated in CSS; this file keeps their
   progress readable for screen readers, and announces 'preloader:done' on the
   document once the sign-in is uncovered.
--------------------------------------------------------------------------- */

(() => {
  'use strict';

  const el = document.getElementById('preloader');
  if (!el) return;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOMENT = still ? 300 : 8100;     // the film, if it can't be read from the animation
  const CEILING = 14000;                 // never longer than this, whatever is slow
  const steps = document.getElementById('plSteps');
  const started = performance.now();

  let loaded = false;
  let skip = false;
  let gone = false;
  let waiting = 0;

  const progress = setInterval(() => {
    const done = Math.min(99, Math.round(((performance.now() - started) / MOMENT) * 100));
    steps.setAttribute('aria-valuenow', String(done));
  }, 250);

  /* Time left in the film, read from the finale's tick, so it holds however
     late painting began; the clock where that can't be read. */
  function showLeft() {
    try {
      const tick = el.querySelector('.fin-check').getAnimations()[0];
      if (tick && tick.effect) {
        const end = tick.effect.getComputedTiming().endTime;
        return Math.max(0, end - (tick.currentTime || 0)) + 250;   // and a beat to see it land
      }
    } catch (error) { /* fall back to the clock */ }
    return Math.max(0, MOMENT - (performance.now() - started));
  }

  function maybeLeave() {
    if (gone || (!loaded && !skip)) return;
    clearTimeout(waiting);
    waiting = setTimeout(leave, skip ? 0 : showLeft());
  }

  function leave() {
    if (gone) return;
    gone = true;
    clearTimeout(waiting);
    clearInterval(progress);
    steps.setAttribute('aria-valuenow', '100');

    // the film fades away and the sign-in rises in its place
    el.classList.add('is-revealing');
    document.body.classList.add('is-ready');

    setTimeout(() => {
      el.remove();
      document.dispatchEvent(new CustomEvent('preloader:done'));
    }, still ? 0 : 650);
  }

  function pageLoaded() {
    // the brand fonts too, so the sign-in never appears mid font-swap
    document.fonts.ready.then(() => {
      loaded = true;
      maybeLeave();
    });
  }

  if (document.readyState === 'complete') pageLoaded();
  else window.addEventListener('load', pageLoaded, { once: true });

  setTimeout(() => {
    skip = true;
    maybeLeave();
  }, CEILING);

  el.addEventListener('click', () => {
    skip = true;
    maybeLeave();
  });

  document.addEventListener('keydown', (event) => {
    if (!gone && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) {
      skip = true;
      maybeLeave();
    }
  });
})();
