// worker.js
// THE SITE, AND THE ONLY THING ON IT THAT IS NOT A FILE
//
// FLETCHER'S GUIDE:
// Everything on fletcherdewey.com is a static file, which is why it is fast
// and why it costs nothing. Two numbers on the library page cannot be files,
// though: how many people are playing a game RIGHT NOW, and how many have
// ever played it. Those have to be counted somewhere both of us can see, and
// a visitor's own browser is not that place.
//
// So there is exactly one small piece of state in the whole site: a Durable
// Object with a table in it, one row per player per game.
//
//   pid    a random id the browser made up once and kept
//   game   which game it was
//   first  when that browser first played it
//   last   when it last said it was still here
//
// "Played" is how many rows a game has. "Playing now" is how many of those
// rows were touched in the last minute. Nothing in the row says who anybody
// is — the id is a random string, and the name you type into the game never
// leaves your own machine.

const GAMES = ['falo3d-2', 'falo3d', 'falo'];
const LIVE_WINDOW = 60_000;        // still counts as here, in milliseconds
const PID = /^[A-Za-z0-9_-]{6,40}$/;

export class Counts {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS seen (
      pid TEXT NOT NULL,
      game TEXT NOT NULL,
      first INTEGER NOT NULL,
      last INTEGER NOT NULL,
      PRIMARY KEY (pid, game)
    )`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();

    if (url.pathname === '/api/ping' && request.method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch (e) { body = {}; }
      const pid = String(body.pid || '');
      const game = String(body.game || '');
      // Anything that is not one of this site's games, or not a plausible
      // id, is counted as nothing at all rather than written down.
      if (PID.test(pid) && GAMES.includes(game)) {
        this.sql.exec(
          `INSERT INTO seen (pid, game, first, last) VALUES (?, ?, ?, ?)
             ON CONFLICT (pid, game) DO UPDATE SET last = excluded.last`,
          pid, game, now, now);
      }
    }

    const rows = this.sql.exec(
      `SELECT game,
              COUNT(*) AS played,
              SUM(CASE WHEN last > ? THEN 1 ELSE 0 END) AS live
         FROM seen GROUP BY game`, now - LIVE_WINDOW).toArray();

    const games = {};
    for (const g of GAMES) games[g] = { played: 0, live: 0 };
    for (const r of rows) {
      if (games[r.game]) {
        games[r.game] = { played: Number(r.played) || 0, live: Number(r.live) || 0 };
      }
    }
    return new Response(JSON.stringify({ games }), {
      headers: {
        'content-type': 'application/json',
        // Never cached: a count of who is here this minute is the one thing
        // on this site that must not come out of a cache.
        'cache-control': 'no-store',
      },
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ping' || url.pathname === '/api/counts') {
      // The name picks which counter this is. 'v1' holds the rows from
      // testing the thing; the real one starts here, empty.
      const id = env.COUNTS.idFromName('live');
      return env.COUNTS.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
