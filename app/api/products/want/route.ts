import { assertSameOrigin, ensureDatabase, getCurrentUser, jsonError } from "../../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const { productId } = await request.json() as { productId?: string };
  if (!productId) return jsonError("商品を選択してください");
  const DB = await ensureDatabase();
  const exists = await DB.prepare(`SELECT 1 FROM products WHERE id=?`).bind(productId).first();
  if (!exists) return jsonError("商品が見つかりません", 404);
  const wanted = await DB.prepare(`SELECT 1 FROM product_wants WHERE user_id=? AND product_id=?`).bind(user.id, productId).first();
  if (wanted) await DB.prepare(`DELETE FROM product_wants WHERE user_id=? AND product_id=?`).bind(user.id, productId).run();
  else await DB.prepare(`INSERT INTO product_wants (user_id,product_id,created_at) VALUES (?,?,?)`).bind(user.id, productId, Date.now()).run();
  return Response.json({ ok: true, wanted: !wanted });
}
