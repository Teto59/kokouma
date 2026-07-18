import { assertSameOrigin, ensureDatabase, hashPassword, jsonError, newSalt, sessionResponse } from "../../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const data = await request.json() as { handle?: string; displayName?: string; password?: string };
  const handle = data.handle?.trim().toLowerCase() ?? "";
  const displayName = data.displayName?.trim() ?? "";
  const password = data.password ?? "";
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return jsonError("IDは半角英数字と_で3〜20文字にしてください");
  if (displayName.length < 1 || displayName.length > 30) return jsonError("表示名は1〜30文字にしてください");
  if (password.length < 8 || password.length > 100) return jsonError("パスワードは8文字以上にしてください");
  const DB = await ensureDatabase();
  if (await DB.prepare(`SELECT 1 FROM users WHERE handle=?`).bind(handle).first()) return jsonError("そのIDは使われています", 409);
  const id = crypto.randomUUID();
  const salt = newSalt();
  const passwordHash = await hashPassword(password, salt);
  await DB.batch([
    DB.prepare(`INSERT INTO users (id,handle,display_name,bio,avatar_color,is_seed,is_unofficial,created_at) VALUES (?,?,?,?,?,0,0,?)`).bind(id, handle, displayName, "食べた記憶を、友だちと地図に。", "#ff5a36", Date.now()),
    DB.prepare(`INSERT INTO credentials (user_id,salt,password_hash) VALUES (?,?,?)`).bind(id, salt, passwordHash),
  ]);
  return sessionResponse(id, { ok: true });
}
