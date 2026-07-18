export const GOOGLE_MAPS_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);

export function parseGoogleMapsUrl(raw: string) {
  const url = new URL(raw);
  if (!GOOGLE_MAPS_HOSTS.has(url.hostname)) throw new Error("Google Mapsの共有リンクを貼ってください");
  const decoded = decodeURIComponent(url.href.replace(/\+/g, " "));
  const at = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const bang = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const queryValue = url.searchParams.get("query") ?? url.searchParams.get("q") ?? "";
  const queryCoords = queryValue.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  const match = at ?? bang ?? queryCoords;
  const placePath = decoded.match(/\/place\/([^/@?]+)/)?.[1]?.replace(/\+/g, " ");
  return { latitude: match ? Number(match[1]) : null, longitude: match ? Number(match[2]) : null, name: placePath || (!queryCoords ? queryValue : "") };
}
