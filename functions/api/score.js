// POST /api/score  { pid, name, school, mode, ok, ms }
// บันทึกผล 1 ข้อของผู้เล่น (นับข้อที่ทำ, ข้อที่ได้คำตอบดีที่สุด, เวลารวมของข้อที่ทำได้)
import { db, json, fail, clean } from '../_db.js';

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: 'BAD_JSON' }, 400); }
  const pid = clean(b.pid, 64);
  const name = clean(b.name, 30);
  const school = clean(b.school, 40);
  const mode = Number(b.mode);
  const ok = b.ok === true;
  const ms = Math.round(Number(b.ms));
  if (!/^[A-Za-z0-9-]{8,64}$/.test(pid) || !name || ![1, 2, 3].includes(mode)) return json({ ok: false, error: 'BAD_INPUT' }, 400);
  if (!Number.isFinite(ms) || ms < 0 || ms > 3600000) return json({ ok: false, error: 'BAD_TIME' }, 400);
  // ข้อที่ "ทำได้" ต้องใช้เวลาอย่างน้อย 1.5 วินาที (กันการส่งคะแนนปลอมแบบง่าย ๆ)
  const good = ok && ms >= 1500 ? 1 : 0;
  try {
    const D = await db(env);
    const now = Date.now();
    const last = await D.prepare('SELECT MAX(updated) AS u FROM scores WHERE pid = ?').bind(pid).first();
    if (last && last.u && now - last.u < 1500) return json({ ok: false, error: 'TOO_FAST' }, 429);
    await D.prepare(`INSERT INTO scores (pid, mode, name, school, played, good, good_ms, best_ms, updated)
      VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8)
      ON CONFLICT(pid, mode) DO UPDATE SET
        name = excluded.name, school = excluded.school,
        played = played + 1, good = good + excluded.good, good_ms = good_ms + excluded.good_ms,
        best_ms = CASE WHEN excluded.best_ms > 0 AND (best_ms = 0 OR excluded.best_ms < best_ms) THEN excluded.best_ms ELSE best_ms END,
        updated = excluded.updated`)
      .bind(pid, mode, name, school, good, good ? ms : 0, good ? ms : 0, now).run();
    await D.prepare('UPDATE scores SET name = ?2, school = ?3 WHERE pid = ?1').bind(pid, name, school).run();
    return json({ ok: true });
  } catch (e) { return fail(e); }
}
