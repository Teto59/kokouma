import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const data = await request.json() as { placeId?: string; rating?: number; body?: string; imageKey?: string; tier?: string };
  const rating = Number(data.rating);
  const body = data.body?.trim() ?? "";
  if (!data.placeId || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < 2 || body.length > 600) return jsonError("星と2〜600文字のレビューを入力してください");
  const DB = await ensureDatabase();
  const existing = await DB.prepare(`SELECT is_seed as isSeed FROM reviews WHERE user_id=? AND place_id=?`).bind(user.id, data.placeId).first<{ isSeed: number }>();
  if (existing?.isSeed) return jsonError("初期レビューは保護されています", 403);
  if (existing) {
    await DB.prepare(`UPDATE reviews SET rating=?,body=?,image_key=? WHERE user_id=? AND place_id=?`).bind(rating, body, data.imageKey || null, user.id, data.placeId).run();
  } else {
    await DB.prepare(`INSERT INTO reviews (id,user_id,place_id,rating,body,image_key,is_seed,is_fictional_demo,created_at) VALUES (?,?,?,?,?,?,0,0,?)`).bind(crypto.randomUUID(), user.id, data.placeId, rating, body, data.imageKey || null, Date.now()).run();
  }
  if (data.tier && ["S","A","B","C"].includes(data.tier)) {
    await DB.prepare(`INSERT INTO tier_entries (user_id,place_id,tier,position,is_seed,updated_at) VALUES (?,?,?,0,0,?) ON CONFLICT(user_id,place_id) DO UPDATE SET tier=excluded.tier,updated_at=excluded.updated_at WHERE is_seed=0`).bind(user.id, data.placeId, data.tier, Date.now()).run();
  }
  return Response.json({ ok: true });
}
