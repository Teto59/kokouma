export function normalizeProductName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[®™©・･\s　'’"“”「」『』（）()\-_]/g, "").trim();
}

export function normalizeBrandName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[®™©・･\s　'’"“”「」『』（）()\-_.]/g, "").trim();
}

const brandAccents = ["#e94f37", "#0f8b6d", "#f2b134", "#2878b5", "#a8c838", "#dc6b9a"];

export function brandAccent(value: string) {
  const normalized = normalizeBrandName(value);
  let hash = 0;
  for (const character of normalized) hash = ((hash << 5) - hash + character.codePointAt(0)!) | 0;
  return brandAccents[Math.abs(hash) % brandAccents.length];
}

export function optionalHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error("URLはhttps://から入力してください");
  return url.href;
}
