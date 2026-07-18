import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const { placeId, tier, position = 0 } = await request.json() as { placeId?: string; tier?: string; position?: number };
  if (!placeId || !tier || !["S","A","B","C"].includes(tier)) return jsonError("Tierを確認してください");
  const DB = await ensureDatabase();
  const existing = await DB.prepare(`SELECT is_seed as isSeed FROM tier_entries WHERE user_id=? AND place_id=?`).bind(user.id, placeId).first<{ isSeed: number }>();
  if (existing?.isSeed) return jsonError("初期Tierは保護されています", 403);
  await DB.prepare(`INSERT INTO tier_entries (user_id,place_id,tier,position,is_seed,updated_at) VALUES (?,?,?,?,0,?) ON CONFLICT(user_id,place_id) DO UPDATE SET tier=excluded.tier,position=excluded.position,updated_at=excluded.updated_at WHERE is_seed=0`).bind(user.id, placeId, tier, Math.max(0, Number(position) || 0), Date.now()).run();
  return Response.json({ ok: true });
}
