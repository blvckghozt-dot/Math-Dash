// ใช้ร่วมกันระหว่าง API: สร้างตารางอัตโนมัติ (ครั้งแรก) และตัวช่วยตอบกลับ
let ready = false;
export async function db(env) {
  if (!env.DB) throw new Error('NO_DB');
  if (!ready) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS scores (
      pid TEXT NOT NULL,
      mode INTEGER NOT NULL,
      name TEXT NOT NULL,
      school TEXT NOT NULL DEFAULT '',
      played INTEGER NOT NULL DEFAULT 0,
      good INTEGER NOT NULL DEFAULT 0,
      good_ms INTEGER NOT NULL DEFAULT 0,
      best_ms INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (pid, mode)
    )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_scores_mode_good ON scores (mode, good DESC)').run();
    // verified = scores of a player signed in with the Math a Day account (pid "g-<account id>")
    try { await env.DB.prepare('ALTER TABLE scores ADD COLUMN verified INTEGER NOT NULL DEFAULT 0').run(); } catch { /* already there */ }
    ready = true;
  }
  return env.DB;
}
// a player signed in for the first time on this device: move this device's scores onto the account
export async function mergeInto(D, from, to) {
  await D.batch([
    D.prepare(`INSERT INTO scores (pid, mode, name, school, played, good, good_ms, best_ms, updated, verified)
      SELECT ?2, mode, name, school, played, good, good_ms, best_ms, updated, 1 FROM scores WHERE pid = ?1
      ON CONFLICT(pid, mode) DO UPDATE SET
        played = played + excluded.played, good = good + excluded.good, good_ms = good_ms + excluded.good_ms,
        best_ms = CASE WHEN excluded.best_ms > 0 AND (best_ms = 0 OR excluded.best_ms < best_ms) THEN excluded.best_ms ELSE best_ms END,
        updated = MAX(updated, excluded.updated)`).bind(from, to),
    D.prepare('DELETE FROM scores WHERE pid = ?1').bind(from)
  ]);
}
export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
export const fail = (e) => json({ ok: false, error: e && e.message === 'NO_DB' ? 'NO_DB' : 'SERVER' }, e && e.message === 'NO_DB' ? 503 : 500);
export const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
