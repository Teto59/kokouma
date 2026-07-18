import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseGoogleMapsUrl } from "../lib/maps.ts";
import { canViewReview, isReviewVisibility } from "../lib/visibility.ts";
import { brandAccent, normalizeBrandName, normalizeProductName, optionalHttpsUrl } from "../lib/products.ts";

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

test("enforces following and mutual review audiences", () => {
  const follows = [
    { followerId: "author", followingId: "friend" },
    { followerId: "friend", followingId: "author" },
    { followerId: "author", followingId: "one-way" },
  ];
  assert.equal(canViewReview("public", "author", null, follows), true);
  assert.equal(canViewReview("following", "author", "one-way", follows), true);
  assert.equal(canViewReview("following", "author", "stranger", follows), false);
  assert.equal(canViewReview("mutual", "author", "friend", follows), true);
  assert.equal(canViewReview("mutual", "author", "one-way", follows), false);
  assert.equal(canViewReview("mutual", "author", "author", follows), true);
});

test("rejects unknown audience values", () => {
  assert.equal(isReviewVisibility("mutual"), true);
  assert.equal(isReviewVisibility("close-friends"), false);
});

test("normalizes community product names for deduplication", () => {
  assert.equal(normalizeProductName(" ハニー　バナナ フラペチーノ® "), "ハニーバナナフラペチーノ");
  assert.equal(normalizeProductName("メロン・ショコリキサー"), "メロンショコリキサー");
});

test("normalizes community brand names and gives them a stable accent", () => {
  assert.equal(normalizeBrandName(" Starbucks® "), normalizeBrandName("ＳＴＡＲＢＵＣＫＳ"));
  assert.equal(normalizeBrandName("ゴディバ・ジャパン"), normalizeBrandName("ゴディバ ジャパン"));
  assert.equal(brandAccent("成城石井"), brandAccent(" 成城石井 "));
});

test("accepts only optional https product sources", () => {
  assert.equal(optionalHttpsUrl(""), null);
  assert.match(optionalHttpsUrl("https://example.com/product"), /^https:/);
  assert.throws(() => optionalHttpsUrl("http://example.com/product"), /https/);
});

test("ships production metadata and protected demo disclosure", async () => {
  const [layout, server, component, placeRoute] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/KokoumaApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/places/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /KOKOUMA/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.match(server, /Jensen Huang/);
  assert.match(server, /架空のデモレビュー/);
  assert.match(server, /太田 裕雄/);
  assert.match(server, /本人の発言・来店事実ではなく/);
  assert.match(component, /OpenStreetMap contributors/);
  assert.match(component, /QRコード/);
  assert.match(component, /相互だけ/);
  assert.match(component, /NEW DROP/);
  assert.match(component, /近くの店舗を探す/);
  assert.match(component, /住所.*optional-mark.*任意/);
  assert.doesNotMatch(component, /disabled=\{!draft\.name\|\|!draft\.address\}/);
  assert.match(placeRoute, /住所未登録/);
  assert.match(server, /PASSWORD_SALT_VERSION = "v2\$"/);
});
