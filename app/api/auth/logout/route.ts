import { assertSameOrigin, ensureDatabase, hashToken, jsonError } from "../../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const token = (request.headers.get("cookie") ?? "").split(";").map((p) => p.trim()).find((p) => p.startsWith("kokouma_session="))?.split("=")[1];
  if (token) (await ensureDatabase()).prepare(`DELETE FROM sessions WHERE token_hash=?`).bind(await hashToken(token)).run();
  return Response.json({ ok: true }, { headers: { "set-cookie": "kokouma_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" } });
}
