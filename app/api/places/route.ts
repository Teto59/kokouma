import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const data = await request.json() as Record<string, unknown>;
  const name = String(data.name ?? "").trim();
  const address = String(data.address ?? "").trim();
  const area = String(data.area ?? "").trim();
  const category = String(data.category ?? "").trim();
  const googleMapsUrl = String(data.googleMapsUrl ?? "").trim();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!name || !address || !area || !category || !googleMapsUrl || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return jsonError("店舗情報をすべて確認してください");
  const host = new URL(googleMapsUrl).hostname;
  if (!["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"].includes(host)) return jsonError("Google Mapsの共有リンクが必要です");
  const DB = await ensureDatabase();
  const id = crypto.randomUUID();
  try {
    await DB.prepare(`INSERT INTO places (id,name,address,area,category,latitude,longitude,google_maps_url,image_key,created_by,is_seed,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
      .bind(id, name.slice(0, 80), address.slice(0, 160), area.slice(0, 40), category.slice(0, 30), latitude, longitude, googleMapsUrl, data.imageKey || null, user.id, Date.now()).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return jsonError("この店舗はすでに登録されています", 409);
    return jsonError("店舗を保存できませんでした", 500);
  }
}
