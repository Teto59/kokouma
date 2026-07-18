import { assertSameOrigin, bindings, getCurrentUser, jsonError } from "../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  const user = await getCurrentUser(request);
  if (!user) return jsonError("ログインしてください", 401);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("画像を選択してください");
  if (file.size > 5 * 1024 * 1024) return jsonError("画像は5MB以下にしてください");
  if (!new Set(["image/jpeg","image/png","image/webp"]).has(file.type)) return jsonError("JPEG、PNG、WebPだけアップロードできます");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `${user.id}/${crypto.randomUUID()}.${ext}`;
  await bindings().MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
  return Response.json({ key, url: `/api/media/${encodeURIComponent(key)}` });
}
