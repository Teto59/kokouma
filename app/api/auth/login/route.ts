import { assertSameOrigin, ensureDatabase, hashPassword, jsonError, sessionResponse } from "../../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const data = await request.json() as { handle?: string; password?: string };
  const DB = await ensureDatabase();
  const row = await DB.prepare(`SELECT u.id,c.salt,c.password_hash as passwordHash FROM users u JOIN credentials c ON c.user_id=u.id WHERE u.handle=?`)
    .bind(data.handle?.trim().toLowerCase() ?? "").first<{ id: string; salt: string; passwordHash: string }>();
  if (!row || await hashPassword(data.password ?? "", row.salt) !== row.passwordHash) return jsonError("IDまたはパスワードが違います", 401);
  return sessionResponse(row.id, { ok: true });
}
