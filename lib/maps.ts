export const GOOGLE_MAPS_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);

export type NominatimReverseResult = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

function cleanAreaLabel(value?: string) {
  const label = value?.trim();
  if (!label) return "";
  const withoutChome = label.replace(/[0-9０-９一二三四五六七八九十]+丁目$/, "").trim();
  return withoutChome || label;
}

export function parseNominatimReverse(result: NominatimReverseResult) {
  const address = result.address ?? {};
  const areaKeys = ["neighbourhood", "quarter", "suburb", "city_district", "borough", "municipality", "town", "village", "city", "county", "state"];
  const suggestions = [...new Set(areaKeys.map((key) => cleanAreaLabel(address[key])).filter(Boolean))].slice(0, 4);

  const addressParts = [
    address.state,
    address.city ?? address.municipality,
    address.city_district ?? address.borough,
    address.suburb,
    address.quarter,
    address.neighbourhood,
    address.road,
    address.house_number,
  ].filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  const compactAddressParts = addressParts.filter((part, index, all) => !all.slice(index + 1).some((next) => next.startsWith(part)));

  return {
    area: suggestions[0] ?? "",
    suggestions,
    address: compactAddressParts.join("") || result.display_name?.replace(/,?\s*\d{3}-?\d{4},?\s*/g, "").replace(/,?\s*\u65E5\u672C\s*$/, "").trim() || "",
  };
}

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
