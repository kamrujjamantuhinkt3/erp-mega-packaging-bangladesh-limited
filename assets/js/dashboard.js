/* Mega Packaging ERP: dashboard (signed-in users only)
   The welcome, written out by hand as in the RTGS Management System, then the six
   departments. Who is signed in comes from the PHP API (api.js). */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  $('year').textContent = String(new Date().getFullYear());

  /* ---------- Who is signed in ---------- */

  // Show the page only once the backend confirms someone is signed in
  async function requireSignIn() {
    try {
      const { data } = await Api.session();
      if (!data.authenticated) {
        window.location.replace('login.html');
        return false;
      }
      showUser(data.user || {});
      root.classList.remove('is-checking');
      root.classList.add('is-ready');
      return true;
    } catch (error) {
      // Server unreachable: the sign-in page explains what went wrong
      window.location.replace('login.html');
      return false;
    }
  }

  function showUser(user) {
    const name = String(user.name || user.username || '').trim();
    $('userName').textContent = name;
    $('userInitials').textContent = initials(name);
    $('userChip').title = user.username ? `Signed in as ${user.username}` : '';
  }

  // "Kamrujjaman Tuhin" → "KT", "admin" → "AD"
  function initials(name) {
    const words = name.split(/\s+/).filter(Boolean).map((word) => Array.from(word));
    if (!words.length) return '';
    const first = words[0][0];
    const second = words.length > 1 ? words[words.length - 1][0] : (words[0][1] || '');
    return (first + second).toUpperCase();
  }

  $('signOut').addEventListener('click', async () => {
    $('signOut').disabled = true;
    try {
      await Api.logout();
    } catch (error) {
      /* the sign-in page checks the session again either way */
    }
    window.location.replace('login.html');
  });

  /* ---------- The welcome, written out by hand ----------
     "Welcome to Mega Packaging Bangladesh Limited", as in the RTGS Management System: each
     line is uncovered left to right behind a pen nib while its outline draws itself and the
     ink fills in. Laid out once the script font has arrived, so the measure is the real one;
     shown at once for anyone who asks for less motion. */

  const ink = $('welcomeInk');
  const NARROW = 560;      // below this width the company's name takes two lines
  let inkRun = 0;
  let inkNarrow = null;
  let lateFont = false;

  // The fonts' stylesheet loads without blocking the page: wait for it, then for the hand itself.
  // Never longer than 2.5 s: offline, the welcome is written in the system's script font instead.
  function handFont() {
    const link = $('fontsCss');
    const sheet = link.media === 'all' ? Promise.resolve() : new Promise((resolve) => {
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', resolve, { once: true });
    });
    const font = sheet
      .then(() => (document.fonts && document.fonts.load ? document.fonts.load('700 66px "Dancing Script"') : null))
      .catch(() => null);
    return Promise.race([font, wait(2500)]);
  }

  // Puts in the words for this width, places the lines and fits the drawing around them
  function layout() {
    const all = Array.from(ink.querySelectorAll('.ink-line'));
    inkNarrow = ink.parentNode.clientWidth < NARROW;
    all[1].textContent = inkNarrow ? 'Mega Packaging' : 'Mega Packaging Bangladesh Limited';
    all[2].textContent = inkNarrow ? 'Bangladesh Limited' : '';
    const lines = all.filter((line) => line.textContent);

    lines.forEach((line, i) => {
      line.setAttribute('x', 0);
      line.setAttribute('y', i ? 4 + i * 80 : 0);
    });
    const boxes = lines.map((line) => line.getBBox());
    const last = boxes[boxes.length - 1];
    const x0 = Math.min(...boxes.map((b) => b.x)) - 14;
    const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + 14;
    const y0 = boxes[0].y - 6;
    const y1 = last.y + last.height + 8;
    ink.setAttribute('viewBox', [x0, y0, x1 - x0, y1 - y0].map((n) => n.toFixed(1)).join(' '));
    ink.style.aspectRatio = `${(x1 - x0).toFixed(1)} / ${(y1 - y0).toFixed(1)}`;

    const rects = Array.from(ink.querySelectorAll('.ink-reveal'));
    rects.forEach((rect, i) => {
      const b = boxes[i];
      if (!b) {
        rect.setAttribute('width', 0);
        return;
      }
      rect.setAttribute('x', b.x - 8);
      rect.setAttribute('y', b.y - 12);
      rect.setAttribute('height', b.height + 24);
    });
    return { lines, boxes, rects };
  }

  function writeWelcome(instant) {
    const run = ++inkRun;
    return handFont().then(() => {
      if (run !== inkRun) return;
      const { lines, boxes, rects } = layout();
      const nib = ink.querySelector('.ink-nib');

      if (instant || reduceMotion) {
        boxes.forEach((b, i) => rects[i].setAttribute('width', b.width + 16));
        nib.style.opacity = 0;
        ink.classList.remove('go');
        ink.classList.add('done');
        return;
      }

      // one line after another, each given time in proportion to its length
      let at = 200;
      const plan = boxes.map((b, i) => {
        const ms = Math.round(Math.max(900, b.width * 3.4));
        const step = { i, at, ms };
        lines[i].style.setProperty('--at', at);
        lines[i].style.setProperty('--ms', ms);
        at += ms + 60;
        return step;
      });
      rects.forEach((rect) => rect.setAttribute('width', 0));
      ink.classList.remove('done');
      ink.classList.add('go');

      const end = plan[plan.length - 1].at + plan[plan.length - 1].ms;
      const start = performance.now();

      (function frame(now) {
        if (run !== inkRun) return;
        const t = now - start;
        let pen = null;
        plan.forEach((p) => {
          const k = Math.max(0, Math.min(1, (t - p.at) / p.ms));
          // a hand doesn't move at one speed: a small, steady waver, never backwards
          const e = Math.max(0, Math.min(1, k + 0.012 * Math.sin(k * 50)));
          const b = boxes[p.i];
          rects[p.i].setAttribute('width', (b.width + 16) * e);
          if (k > 0 && k < 1) pen = [b.x - 8 + (b.width + 16) * e, b.y + b.height * (0.58 + 0.16 * Math.sin(k * 70))];
        });
        if (pen) {
          nib.setAttribute('cx', pen[0].toFixed(1));
          nib.setAttribute('cy', pen[1].toFixed(1));
          nib.style.opacity = 1;
        } else {
          nib.style.opacity = 0;
        }
        if (t < end + 60) {
          requestAnimationFrame(frame);
          return;
        }
        ink.classList.add('done');
        // the hand arrived while the welcome was being written: measure it again, already written
        if (lateFont) {
          lateFont = false;
          writeWelcome(true);
        }
      })(start);
    });
  }

  // Crossing the narrow width lays the welcome out again, already written
  window.addEventListener('resize', () => {
    if (inkNarrow !== null && (ink.parentNode.clientWidth < NARROW) !== inkNarrow) writeWelcome(true);
  });

  // The hand arriving late (a slow connection) changes the measure
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', (event) => {
      if (!event.fontfaces.some((face) => /dancing script/i.test(face.family))) return;
      if (ink.classList.contains('done')) writeWelcome(true);
      else lateFont = true;
    });
  }

  /* ---------- Go ---------- */

  requireSignIn().then((signedIn) => {
    if (signedIn) writeWelcome(false);
  });

  // Check again when the page comes back from the browser's Back/Forward cache
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) requireSignIn();
  });
})();
