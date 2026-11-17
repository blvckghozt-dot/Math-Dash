// GET /api/health  ใช้เช็กว่าเชื่อมฐานข้อมูลแล้วหรือยัง
import { db, json, fail } from '../_db.js';
export async function onRequestGet({ env }) {
  try { await db(env); return json({ ok: true }); } catch (e) { return fail(e); }
}
