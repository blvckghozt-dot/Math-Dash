// GET /api/leaderboard?mode=1&sort=good|speed|played&pid=...
// sort=good   : ทำได้มากที่สุด
// sort=speed  : เฉลี่ยเร็วที่สุด (ต้องทำได้อย่างน้อย 10 ข้อ)
// sort=played : เล่นมากที่สุด
import { db, json, fail, clean } from '../_db.js';
import { account } from '../_account.js';

const MIN_SPEED = 10;
const ORDER = {
  good: 'good DESC, (good_ms * 1.0 / MAX(good, 1)) ASC',
  played: 'played DESC, good DESC',
  speed: '(good_ms * 1.0 / good) ASC, good DESC'
};

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const mode = Number(u.searchParams.get('mode') || 1);
  const sort = ORDER[u.searchParams.get('sort')] ? u.searchParams.get('sort') : 'good';
  let pid = clean(u.searchParams.get('pid'), 64);
  if (![1, 2, 3].includes(mode)) return json({ ok: false, error: 'BAD_INPUT' }, 400);
  const where = sort === 'speed' ? `mode = ?1 AND good >= ${MIN_SPEED}` : 'mode = ?1 AND played > 0';
  try {
    const D = await db(env);
    const acc = await account(request, env);
    if (acc) pid = 'g-' + acc.id;
    const { results } = await D.prepare(`SELECT pid, name, school, played, good, good_ms, best_ms, verified FROM scores WHERE ${where} ORDER BY ${ORDER[sort]} LIMIT 100`).bind(mode).all();
    const rows = results.map((r, i) => ({
      rank: i + 1, me: !!pid && r.pid === pid, v: !!r.verified, name: r.name, school: r.school,
      played: r.played, good: r.good,
      avg: r.good ? Math.round(r.good_ms / r.good / 100) / 10 : null,
      best: r.best_ms ? Math.round(r.best_ms / 100) / 10 : null
    }));
    let me = null;
    if (pid) {
      const r = await D.prepare('SELECT played, good, good_ms, best_ms FROM scores WHERE pid = ?1 AND mode = ?2').bind(pid, mode).first();
      if (r) {
        me = { played: r.played, good: r.good, avg: r.good ? Math.round(r.good_ms / r.good / 100) / 10 : null, best: r.best_ms ? Math.round(r.best_ms / 100) / 10 : null, rank: null };
        const inList = rows.find(x => x.me);
        if (inList) me.rank = inList.rank;
        else if (sort !== 'speed' || r.good >= MIN_SPEED) {
          const q = sort === 'speed'
            ? `SELECT COUNT(*) AS c FROM scores WHERE mode = ?1 AND good >= ${MIN_SPEED} AND (good_ms * 1.0 / good) < ?2`
            : sort === 'played' ? 'SELECT COUNT(*) AS c FROM scores WHERE mode = ?1 AND played > ?2' : 'SELECT COUNT(*) AS c FROM scores WHERE mode = ?1 AND good > ?2';
          const v = sort === 'speed' ? r.good_ms / r.good : sort === 'played' ? r.played : r.good;
          const c = await D.prepare(q).bind(mode, v).first();
          me.rank = (c ? c.c : 0) + 1;
        }
      }
    }
    const tot = await D.prepare('SELECT COUNT(*) AS players, COALESCE(SUM(played), 0) AS played FROM scores WHERE mode = ?1').bind(mode).first();
    return json({ ok: true, mode, sort, minSpeed: MIN_SPEED, rows, me, total: tot });
  } catch (e) { return fail(e); }
}
