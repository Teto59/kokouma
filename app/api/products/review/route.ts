import { GOOGLE_MAPS_HOSTS } from "../../../../lib/maps";
import { normalizeProductName, optionalHttpsUrl } from "../../../../lib/products";
import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../../lib/server";
import { isReviewVisibility } from "../../../../lib/visibility";

type Payload = {
  brandId?: string;
  productId?: string;
  productName?: string;
  rating?: number;
  body?: string;
  tier?: string;
  visibility?: string;
  imageKey?: string;
  officialUrl?: string;
  storeName?: string;
  storeMapsUrl?: string;
  isLimited?: boolean;
};

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const data = await request.json() as Payload;
  const name = data.productName?.trim() ?? "";
  const body = data.body?.trim() ?? "";
  const rating = Number(data.rating);
  const tier = data.tier ?? "A";
  const visibility = data.visibility ?? "public";
  if (!data.brandId || name.length < 2 || name.length > 100) return jsonError("ブランドと商品名を入力してください");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < 2 || body.length > 600) return jsonError("星と2〜600文字のレビューを入力してください");
  if (!["S", "A", "B", "C"].includes(tier)) return jsonError("Tierが正しくありません");
  if (!isReviewVisibility(visibility)) return jsonError("公開範囲が正しくありません");
  let officialUrl: string | null;
  try { officialUrl = optionalHttpsUrl(data.officialUrl); } catch (error) { return jsonError((error as Error).message); }
  let storeMapsUrl: string | null = null;
  if (data.storeMapsUrl?.trim()) {
    try {
      const url = new URL(data.storeMapsUrl.trim());
      if (!GOOGLE_MAPS_HOSTS.has(url.hostname)) return jsonError("店舗リンクはGoogle Mapsの共有リンクを入力してください");
      storeMapsUrl = url.href;
    } catch { return jsonError("店舗リンクが正しくありません"); }
  }
  const DB = await ensureDatabase();
  const brand = await DB.prepare(`SELECT id FROM brands WHERE id=?`).bind(data.brandId).first();
  if (!brand) return jsonError("ブランドが見つかりません", 404);
  const normalizedName = normalizeProductName(name);
  let product = data.productId
    ? await DB.prepare(`SELECT id,is_seed as isSeed,image_key as imageKey FROM products WHERE id=? AND brand_id=?`).bind(data.productId, data.brandId).first<{ id: string; isSeed: number; imageKey: string | null }>()
    : null;
  if (!product) product = await DB.prepare(`SELECT id,is_seed as isSeed,image_key as imageKey FROM products WHERE brand_id=? AND normalized_name=?`).bind(data.brandId, normalizedName).first<{ id: string; isSeed: number; imageKey: string | null }>();
  let productId = product?.id;
  if (!productId) {
    productId = crypto.randomUUID();
    await DB.prepare(`INSERT INTO products (id,brand_id,name,normalized_name,is_limited,official_url,image_key,created_by,is_seed,created_at) VALUES (?,?,?,?,?,?,?,?,0,?)`)
      .bind(productId, data.brandId, name, normalizedName, data.isLimited === false ? 0 : 1, officialUrl, data.imageKey || null, user.id, Date.now()).run();
  } else if (data.imageKey && !product?.imageKey) {
    await DB.prepare(`UPDATE products SET image_key=? WHERE id=?`).bind(data.imageKey, productId).run();
  }
  const existing = await DB.prepare(`SELECT is_seed as isSeed FROM product_reviews WHERE user_id=? AND product_id=?`).bind(user.id, productId).first<{ isSeed: number }>();
  if (existing?.isSeed) return jsonError("初期レビューは保護されています", 403);
  if (existing) {
    await DB.prepare(`UPDATE product_reviews SET rating=?,body=?,tier=?,visibility=?,image_key=?,store_name=?,store_maps_url=? WHERE user_id=? AND product_id=?`)
      .bind(rating, body, tier, visibility, data.imageKey || null, data.storeName?.trim() || null, storeMapsUrl, user.id, productId).run();
  } else {
    await DB.prepare(`INSERT INTO product_reviews (id,user_id,product_id,rating,body,tier,visibility,image_key,store_name,store_maps_url,is_seed,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
      .bind(crypto.randomUUID(), user.id, productId, rating, body, tier, visibility, data.imageKey || null, data.storeName?.trim() || null, storeMapsUrl, Date.now()).run();
  }
  return Response.json({ ok: true, productId });
}
