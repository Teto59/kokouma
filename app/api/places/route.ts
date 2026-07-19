import { assertSameOrigin, bindings, ensureDatabase, getCurrentUser, jsonError } from "../../../lib/server";
import { isReviewVisibility } from "../../../lib/visibility";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const data = await request.json() as Record<string, unknown>;
  const name = String(data.name ?? "").trim();
  const address = String(data.address ?? "").trim() || "住所未登録";
  const area = String(data.area ?? "").trim();
  const category = String(data.category ?? "").trim();
  const googleMapsUrl = String(data.googleMapsUrl ?? "").trim();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const review = data.review && typeof data.review === "object" ? data.review as Record<string, unknown> : null;
  const reviewBody = String(review?.body ?? "").trim();
  const hasReview = reviewBody.length > 0;
  const reviewRating = Number(review?.rating);
  const reviewTier = String(review?.tier ?? "S");
  const reviewVisibility = String(review?.visibility ?? "following");
  if (!name || !area || !category || !googleMapsUrl || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return jsonError("店舗情報をすべて確認してください");
  if (hasReview && (reviewBody.length < 2 || reviewBody.length > 600 || !Number.isInteger(reviewRating) || reviewRating < 1 || reviewRating > 5)) return jsonError("レビューは星と2〜600文字の感想を入力してください");
  if (hasReview && !["S", "A", "B", "C"].includes(reviewTier)) return jsonError("Tierが正しくありません");
  if (hasReview && !isReviewVisibility(reviewVisibility)) return jsonError("公開範囲が正しくありません");
  const host = new URL(googleMapsUrl).hostname;
  if (!["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"].includes(host)) return jsonError("Google Mapsの共有リンクが必要です");
  const DB = await ensureDatabase();
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    const statements = [
      DB.prepare(`INSERT INTO places (id,name,address,area,category,latitude,longitude,google_maps_url,image_key,created_by,is_seed,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
        .bind(id, name.slice(0, 80), address.slice(0, 160), area.slice(0, 40), category.slice(0, 30), latitude, longitude, googleMapsUrl, data.imageKey || null, user.id, now),
    ];
    if (hasReview) {
      statements.push(
        DB.prepare(`INSERT INTO reviews (id,user_id,place_id,rating,body,visibility,is_seed,is_fictional_demo,created_at) VALUES (?,?,?,?,?,?,0,0,?)`)
          .bind(crypto.randomUUID(), user.id, id, reviewRating, reviewBody, reviewVisibility, now),
        DB.prepare(`INSERT INTO tier_entries (user_id,place_id,tier,position,is_seed,updated_at) VALUES (?,?,?,0,0,?)`)
          .bind(user.id, id, reviewTier, now),
      );
    }
    await DB.batch(statements);
    return Response.json({ id, reviewCreated: hasReview }, { status: 201 });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return jsonError("この店舗はすでに登録されています", 409);
    return jsonError("店舗を保存できませんでした", 500);
  }
}

export async function DELETE(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const { id } = await request.json() as { id?: string };
  if (!id) return jsonError("削除するお店が選択されていません");
  const DB = await ensureDatabase();
  const place = await DB.prepare(`SELECT created_by as createdBy,is_seed as isSeed,image_key as imageKey FROM places WHERE id=?`).bind(id).first<{ createdBy: string; isSeed: number; imageKey: string | null }>();
  if (!place) return jsonError("お店が見つかりません", 404);
  if (place.isSeed) return jsonError("初期データのお店は削除できません", 403);
  if (place.createdBy !== user.id) return jsonError("自分が登録したお店だけ削除できます", 403);
  const reviewImages = await DB.prepare(`SELECT image_key as imageKey FROM reviews WHERE place_id=? AND image_key IS NOT NULL`).bind(id).all<{ imageKey: string }>();
  await DB.batch([
    DB.prepare(`DELETE FROM tier_entries WHERE place_id=?`).bind(id),
    DB.prepare(`DELETE FROM reviews WHERE place_id=?`).bind(id),
    DB.prepare(`DELETE FROM places WHERE id=?`).bind(id),
  ]);
  const imageKeys = [place.imageKey, ...reviewImages.results.map((row) => row.imageKey)].filter((key): key is string => Boolean(key));
  if (imageKeys.length) await bindings().MEDIA.delete(imageKeys).catch(() => undefined);
  return Response.json({ ok: true });
}
