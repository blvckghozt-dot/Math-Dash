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
    ready = true;
  }
  return env.DB;
}
export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
export const fail = (e) => json({ ok: false, error: e && e.message === 'NO_DB' ? 'NO_DB' : 'SERVER' }, e && e.message === 'NO_DB' ? 503 : 500);
export const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
