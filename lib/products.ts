export function normalizeProductName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[®™©・･\s　'’"“”「」『』（）()\-_]/g, "").trim();
}

export function optionalHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error("URLはhttps://から入力してください");
  return url.href;
}
