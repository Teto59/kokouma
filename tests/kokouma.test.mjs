import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseGoogleMapsUrl } from "../lib/maps.ts";

test("parses coordinates from a normal Google Maps URL", () => {
  const result = parseGoogleMapsUrl("https://www.google.com/maps/place/FEBRUARY+CAFE/@35.70862,139.79582,17z");
  assert.equal(result.name, "FEBRUARY CAFE");
  assert.equal(result.latitude, 35.70862);
  assert.equal(result.longitude, 139.79582);
});

test("parses query-based Google Maps links", () => {
  const result = parseGoogleMapsUrl("https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E3%83%A1%E3%83%B3%E3%83%81");
  assert.equal(result.name, "浅草メンチ");
  assert.equal(result.latitude, null);
});

test("rejects non-Google hosts", () => {
  assert.throws(() => parseGoogleMapsUrl("https://example.com/maps/place/foo"), /Google Maps/);
});

test("ships production metadata and protected demo disclosure", async () => {
  const [layout, server, component] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/KokoumaApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /KOKOUMA/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.match(server, /Jensen Huang/);
  assert.match(server, /架空のデモレビュー/);
  assert.match(component, /OpenStreetMap contributors/);
  assert.match(component, /QRコード/);
});
