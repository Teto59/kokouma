import { assertSameOrigin, bindings, ensureDatabase, getCurrentUser, jsonError } from "../../../lib/server";
import { isReviewVisibility } from "../../../lib/visibility";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const data = await request.json() as { placeId?: string; rating?: number; body?: string; imageKey?: string; tier?: string; visibility?: string };
  const rating = Number(data.rating);
  const body = data.body?.trim() ?? "";
  const visibility = data.visibility ?? "public";
  if (!data.placeId || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < 2 || body.length > 600) return jsonError("星と2〜600文字のレビューを入力してください");
  if (!isReviewVisibility(visibility)) return jsonError("公開範囲が正しくありません");
  const imageKey = data.imageKey?.trim() || null;
  if (imageKey && !imageKey.startsWith(`${user.id}/`)) return jsonError("この画像は使用できません", 403);
  const DB = await ensureDatabase();
  const existing = await DB.prepare(`SELECT is_seed as isSeed,image_key as imageKey FROM reviews WHERE user_id=? AND place_id=?`).bind(user.id, data.placeId).first<{ isSeed: number; imageKey: string | null }>();
  if (existing?.isSeed) return jsonError("初期レビューは保護されています", 403);
  if (existing) {
    await DB.prepare(`UPDATE reviews SET rating=?,body=?,image_key=?,visibility=? WHERE user_id=? AND place_id=?`).bind(rating, body, imageKey, visibility, user.id, data.placeId).run();
  } else {
    await DB.prepare(`INSERT INTO reviews (id,user_id,place_id,rating,body,image_key,visibility,is_seed,is_fictional_demo,created_at) VALUES (?,?,?,?,?,?,?,0,0,?)`).bind(crypto.randomUUID(), user.id, data.placeId, rating, body, imageKey, visibility, Date.now()).run();
  }
  if (data.tier && ["S","A","B","C"].includes(data.tier)) {
    await DB.prepare(`INSERT INTO tier_entries (user_id,place_id,tier,position,is_seed,updated_at) VALUES (?,?,?,0,0,?) ON CONFLICT(user_id,place_id) DO UPDATE SET tier=excluded.tier,updated_at=excluded.updated_at WHERE is_seed=0`).bind(user.id, data.placeId, data.tier, Date.now()).run();
  }
  if (existing?.imageKey && existing.imageKey !== imageKey) await bindings().MEDIA.delete(existing.imageKey).catch(() => undefined);
  return Response.json({ ok: true });
}
