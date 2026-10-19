// src/shared/presence.js
// SAYING YOU ARE HERE
//
// FLETCHER'S GUIDE:
// The library page shows how many people are playing right now and how many
// have ever played. Both of those come from this: while a game page is open
// it tells the site "still here" every twenty-five seconds, and the site
// counts how many browsers said that in the last minute.
//
// What gets sent is a random id this browser made up once, and which game.
// Not your name — that never leaves your own machine — and nothing else.
//
// If the site cannot be reached, nothing happens and nothing breaks. On a
// local copy there is no server to answer, and the game does not care.

const PID_KEY = 'falo.pid';
const EVERY = 25_000;

function playerId() {
  try {
    let v = localStorage.getItem(PID_KEY);
    if (!v || !/^[A-Za-z0-9_-]{6,40}$/.test(v)) {
      v = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
        .replace(/[^A-Za-z0-9_-]/g, '');
      localStorage.setItem(PID_KEY, v);
    }
    return v;
  } catch (e) {
    // A private window cannot keep an id, so it gets one for this visit
    // only: it counts as somebody playing now, never as the same somebody
    // coming back.
    return 'anon' + Math.random().toString(36).slice(2, 12);
  }
}

export function startPresence(game) {
  const pid = playerId();
  const ping = () => {
    fetch('/api/ping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pid, game }),
      keepalive: true,
    }).catch(() => { /* offline, or a local copy with no server */ });
  };
  ping();
  setInterval(() => { if (!document.hidden) ping(); }, EVERY);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
}
