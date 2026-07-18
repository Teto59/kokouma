import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../../lib/server";
import { parseNominatimReverse, type NominatimReverseResult } from "../../../../lib/maps";

const CACHE_VERSION = "reverse:v1";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);

  const data = await request.json() as { latitude?: unknown; longitude?: unknown };
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return jsonError("地図のピンを確認してください");
  }

  const DB = await ensureDatabase();
  const cacheKey = `${CACHE_VERSION}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = await DB.prepare(`SELECT payload FROM geocode_cache WHERE query=?`).bind(cacheKey).first<{ payload: string }>();
  if (cached?.payload) return Response.json({ ...JSON.parse(cached.payload), cached: true });

  try {
    const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("lat", String(latitude));
    endpoint.searchParams.set("lon", String(longitude));
    endpoint.searchParams.set("addressdetails", "1");
    endpoint.searchParams.set("accept-language", "ja");
    endpoint.searchParams.set("zoom", "18");
    const response = await fetch(endpoint, {
      headers: {
        "accept": "application/json",
        "user-agent": "KOKOUMA/1.0 (+https://kokouma.teto66.chatgpt.site)",
        "referer": new URL(request.url).origin,
      },
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const parsed = parseNominatimReverse(await response.json() as NominatimReverseResult);
    if (!parsed.area) return jsonError("この場所のエリア名を自動取得できませんでした", 422);
    await DB.prepare(`INSERT INTO geocode_cache (query,payload,created_at) VALUES (?,?,?) ON CONFLICT(query) DO UPDATE SET payload=excluded.payload,created_at=excluded.created_at`)
      .bind(cacheKey, JSON.stringify(parsed), Date.now()).run();
    return Response.json({ ...parsed, cached: false });
  } catch {
    return jsonError("エリアを自動取得できませんでした。手入力で続けられます", 502);
  }
}
