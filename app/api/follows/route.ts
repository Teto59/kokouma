import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const { userId } = await request.json() as { userId?: string };
  if (!userId || userId === user.id) return jsonError("フォロー対象を確認してください");
  const DB = await ensureDatabase();
  const existing = await DB.prepare(`SELECT 1 FROM follows WHERE follower_id=? AND following_id=?`).bind(user.id, userId).first();
  if (existing) await DB.prepare(`DELETE FROM follows WHERE follower_id=? AND following_id=?`).bind(user.id, userId).run();
  else await DB.prepare(`INSERT INTO follows (follower_id,following_id,created_at) VALUES (?,?,?)`).bind(user.id, userId, Date.now()).run();
  return Response.json({ following: !existing });
}
