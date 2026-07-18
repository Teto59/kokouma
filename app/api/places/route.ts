import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../lib/server";
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
  const reviewVisibility = String(review?.visibility ?? "public");
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
