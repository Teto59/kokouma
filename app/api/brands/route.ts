import { brandAccent, normalizeBrandName } from "../../../lib/products";
import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../lib/server";

type Payload = { name?: string };

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);

  const data = await request.json() as Payload;
  const name = data.name?.normalize("NFKC").replace(/\s+/g, " ").trim() ?? "";
  const normalized = normalizeBrandName(name);
  if (name.length < 2 || name.length > 60 || normalized.length < 2) {
    return jsonError("ブランド名は2〜60文字で入力してください");
  }
  if (/https?:\/\//i.test(name) || /[\u0000-\u001f\u007f]/.test(name)) {
    return jsonError("ブランド名を正しく入力してください");
  }

  const DB = await ensureDatabase();
  const rows = await DB.prepare("SELECT id,name,slug,accent_color as accentColor,maps_query as mapsQuery,is_seed as isSeed FROM brands").all<Record<string, unknown>>();
  const existing = rows.results.find((row) => normalizeBrandName(String(row.name)) === normalized);
  if (existing) {
    return Response.json({ brand: { ...existing, isSeed: Boolean(existing.isSeed) }, existing: true });
  }

  const id = crypto.randomUUID();
  const slug = "community-" + id.slice(0, 12);
  const accentColor = brandAccent(name);
  try {
    await DB.prepare("INSERT INTO brands (id,name,slug,accent_color,maps_query,is_seed,created_at) VALUES (?,?,?,?,?,0,?)")
      .bind(id, name, slug, accentColor, name, Date.now()).run();
  } catch {
    return jsonError("同じ名前のブランドが登録されています", 409);
  }

  return Response.json({ brand: { id, name, slug, accentColor, mapsQuery: name, isSeed: false }, existing: false }, { status: 201 });
}
