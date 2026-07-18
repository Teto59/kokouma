import { assertSameOrigin, jsonError, sessionResponse } from "../../../../lib/server";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("不正なリクエストです", 403);
  return sessionResponse("u_demo", { ok: true });
}
