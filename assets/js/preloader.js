/* ---------------------------------------------------------------------------
   preloader.js: when the department ring (assets/css/preloader.css) hands over.

   It lets go once the page and its fonts have loaded and the show has had its
   moment: about three seconds, until every department is connected and the
   logo has pulsed. A click or a key skips the moment; a ceiling means a slow
   connection can never strand the page behind it.

   The meter is fed from here, so the number means something: it climbs while
   the page loads, slowing as it goes so it never arrives on its own, and only
   completes when the preloader is about to hand over. When the sign-in is
   uncovered it announces 'preloader:done' on the document.
--------------------------------------------------------------------------- */

(() => {
  'use strict';

  const el = document.getElementById('preloader');
  if (!el) return;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOMENT = still ? 300 : 3200;     // the show, if it can't be read from the animation
  const CEILING = 8000;                  // never longer than this, whatever is slow
  const fill = document.getElementById('plFill');
  const pct = document.getElementById('plPct');
  const meter = document.getElementById('plMeter');
  const started = performance.now();

  let shown = 0;
  let climbing = 0;
  let waiting = 0;
  let loaded = false;
  let skip = false;
  let gone = false;

  function paint(value) {
    shown = value;
    fill.style.width = `${value.toFixed(1)}%`;
    pct.textContent = `${Math.round(value)}%`;
    meter.setAttribute('aria-valuenow', String(Math.round(value)));
  }

  /* An asymptote, not a countdown: each tick closes part of the gap to a
     ceiling that rises once the page has loaded, so the bar always moves
     and never claims to be done before it is. */
  function climb() {
    const goal = loaded ? 97 : 86;
    paint(shown + (goal - shown) * 0.07);
    climbing = setTimeout(climb, 80);
  }

  /* Time left in the show, read from the logo's final pulse, so it holds
     however late painting began; the clock where that can't be read. */
  function showLeft() {
    try {
      const pulse = el.querySelector('.pl-logo').getAnimations()[0];
      if (pulse && pulse.effect) {
        const end = pulse.effect.getComputedTiming().endTime;
        return Math.max(0, end - (pulse.currentTime || 0)) + 200;   // and a beat to see it land
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
    clearTimeout(climbing);
    clearTimeout(waiting);
    paint(100);

    // a beat at 100%, then the iris opens from the centre of the logo
    setTimeout(() => {
      const logo = el.querySelector('.pl-logo').getBoundingClientRect();
      const cx = logo.left + logo.width / 2;
      const cy = logo.top + logo.height / 2;
      // just wide enough to pass the farthest corner, so the whole opening is seen
      const far = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 60;
      el.style.setProperty('--cx', `${cx}px`);
      el.style.setProperty('--cy', `${cy}px`);
      el.style.setProperty('--iris-to', `${Math.ceil(far)}px`);
      el.classList.add('is-revealing');
      document.body.classList.add('is-ready');

      setTimeout(() => {
        el.remove();
        document.dispatchEvent(new CustomEvent('preloader:done'));
      }, still ? 0 : 1150);
    }, still ? 0 : 160);
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

  paint(3);
  climb();
})();
