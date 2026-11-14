/* Mega Packaging ERP: dashboard (signed-in users only)
   Who is here and the time, the welcome written out by hand (as in the RTGS Management
   System), then the six departments, each shown at work. Who is signed in comes from the
   PHP API (api.js). */
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
    const letters = initials(name);
    $('helloName').textContent = name;
    $('helloInitials').textContent = letters;
    $('userInitials').textContent = letters;
    $('userInitials').title = user.username ? `${name} (${user.username})` : name;
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

  /* ---------- The time: a dial that ticks, the clock, the date, the greeting ---------- */

  const dial = $('dial');
  const hands = {
    h: dial.querySelector('.dial__hand--h'),
    m: dial.querySelector('.dial__hand--m'),
    s: dial.querySelector('.dial__hand--s'),
  };
  const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let lastSeconds = -1;

  function greeting(hour) {
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Welcome back';
  }

  function tick() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    $('clockHM').textContent = `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
    $('clockS').textContent = `:${String(s).padStart(2, '0')}`;
    $('clockAP').textContent = h < 12 ? 'AM' : 'PM';
    $('clockDate').textContent = dateFormat.format(now);
    $('clock').setAttribute('datetime', now.toISOString());
    $('helloGreet').textContent = greeting(h);

    // the hands count from midnight, so they always turn forwards; at midnight they're
    // set back without a sweep
    const seconds = h * 3600 + m * 60 + s;
    if (seconds < lastSeconds) dial.classList.remove('is-set');
    hands.s.style.transform = `rotate(${seconds * 6}deg)`;
    hands.m.style.transform = `rotate(${seconds / 10}deg)`;
    hands.h.style.transform = `rotate(${seconds / 120}deg)`;
    if (!dial.classList.contains('is-set') && !reduceMotion) {
      requestAnimationFrame(() => requestAnimationFrame(() => dial.classList.add('is-set')));
    }
    lastSeconds = seconds;

    // next tick on the turn of the second
    setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  }

  tick();

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
  let welcomeWritten;
  const welcomeDone = new Promise((resolve) => { welcomeWritten = resolve; });

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
        welcomeWritten();
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
        welcomeWritten();
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

  /* ---------- The departments at work ----------
     Each card's scene (scenes.css) rests on its finished picture and plays while the card
     has .is-playing. Once the welcome is written the departments wake up one after another;
     then they take turns. The one under the pointer plays straight away (again and again
     while the pointer stays) and leans a little toward it. A tap plays it on touch screens. */

  const cards = Array.from(document.querySelectorAll('.dept'));
  const PLAY_MS = 2800;        // one play of a scene (--play in scenes.css)
  const TURN_MS = 3900;        // a turn: the play, then a breath
  const WAKE_STEP_MS = 230;    // between the departments waking up
  let turnIndex = -1;
  let turnTimer = 0;
  let hovered = null;
  let hoverTimer = 0;

  function play(card) {
    if (reduceMotion || card.classList.contains('is-playing')) return;
    card.classList.add('is-playing');
    setTimeout(() => card.classList.remove('is-playing'), PLAY_MS + 60);
  }

  function setLive(card) {
    cards.forEach((c) => c.classList.toggle('is-live', c === card));
  }

  // Only the departments that can be seen take turns (on a phone, most are scrolled away)
  const inView = new Set(cards);
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);
      });
    }, { threshold: 0.55 });
    cards.forEach((card) => watcher.observe(card));
  }

  function schedule(ms) {
    clearTimeout(turnTimer);
    turnTimer = setTimeout(nextTurn, ms);
  }

  function nextTurn() {
    schedule(TURN_MS);
    if (hovered || document.hidden) return;
    for (let step = 1; step <= cards.length; step += 1) {
      const i = (turnIndex + step) % cards.length;
      if (inView.has(cards[i])) {
        turnIndex = i;
        setLive(cards[i]);
        play(cards[i]);
        return;
      }
    }
    setLive(null);
  }

  // After the welcome: every department wakes up in turn, then the turns begin
  function wakeUp() {
    if (reduceMotion) return;
    cards.forEach((card, i) => setTimeout(() => play(card), i * WAKE_STEP_MS));
    turnIndex = -1;
    schedule(cards.length * WAKE_STEP_MS + PLAY_MS + 500);
  }

  // The card leans toward the pointer and its scene shifts a touch the other way, for depth
  function lean(card, event) {
    const box = card._box;
    if (!box) return;
    const x = Math.max(-0.5, Math.min(0.5, (event.clientX - box.left) / box.width - 0.5));
    const y = Math.max(-0.5, Math.min(0.5, (event.clientY - box.top) / box.height - 0.5));
    card.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
    card.style.setProperty('--px', `${(-x * 8).toFixed(1)}px`);
    card.style.setProperty('--py', `${(-y * 5).toFixed(1)}px`);
  }

  function straighten(card) {
    ['--rx', '--ry', '--px', '--py'].forEach((name) => card.style.removeProperty(name));
  }

  cards.forEach((card, index) => {
    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch' || reduceMotion) return;
      card._box = card.getBoundingClientRect();
      hovered = card;
      setLive(card);
      play(card);
      clearInterval(hoverTimer);
      hoverTimer = setInterval(() => play(card), PLAY_MS + 700);
    });

    card.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || reduceMotion) return;
      lean(card, event);
    });

    card.addEventListener('pointerleave', () => {
      straighten(card);
      if (hovered !== card) return;
      hovered = null;
      clearInterval(hoverTimer);
      card.classList.remove('is-live');
      // the turns carry on from this department
      turnIndex = index;
      schedule(1600);
    });

    // touch screens: a tap shows the department at work
    card.addEventListener('click', () => {
      if (hovered === card) return;
      setLive(card);
      play(card);
      turnIndex = index;
      schedule(TURN_MS);
    });
  });

  // Back to the page after a while away: no backlog, just carry on
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && turnIndex >= 0) schedule(1200);
  });

  /* ---------- Go ---------- */

  requireSignIn().then((signedIn) => {
    if (!signedIn) return;
    writeWelcome(false);
    welcomeDone.then(() => setTimeout(wakeUp, 300));
  });

  // Check again when the page comes back from the browser's Back/Forward cache
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) requireSignIn();
  });
})();
