import { assertSameOrigin, jsonError } from "../../../../lib/server";
import { GOOGLE_MAPS_HOSTS, parseGoogleMapsUrl } from "../../../../lib/maps";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const { url: raw } = await request.json() as { url?: string };
  if (!raw) return jsonError("共有リンクを貼ってください");
  try {
    let finalUrl = raw;
    const initial = new URL(raw);
    if (!GOOGLE_MAPS_HOSTS.has(initial.hostname)) return jsonError("Google Mapsの共有リンクだけ登録できます");
    if (initial.hostname === "maps.app.goo.gl" || initial.hostname === "goo.gl") {
      const response = await fetch(initial, { redirect: "follow", headers: { "user-agent": "KOKOUMA/1.0" } });
      finalUrl = response.url;
    }
    const parsed = parseGoogleMapsUrl(finalUrl);
    return Response.json({ ...parsed, googleMapsUrl: raw, resolvedUrl: finalUrl });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "リンクを解析できませんでした");
  }
}
