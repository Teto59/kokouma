import { env } from "cloudflare:workers";

export type AppUser = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  isSeed: boolean;
  isUnofficial: boolean;
};

type Bindings = { DB: D1Database; MEDIA: R2Bucket };

export function bindings() {
  return env as unknown as Bindings;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, handle TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', avatar_color TEXT NOT NULL DEFAULT '#ff5a36', is_seed INTEGER NOT NULL DEFAULT 0, is_unofficial INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS credentials (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, salt TEXT NOT NULL, password_hash TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS follows (follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, PRIMARY KEY(follower_id, following_id))`,
  `CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, area TEXT NOT NULL, category TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, google_maps_url TEXT NOT NULL UNIQUE, image_url TEXT, image_key TEXT, created_by TEXT NOT NULL REFERENCES users(id), is_seed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, image_key TEXT, visibility TEXT NOT NULL DEFAULT 'following' CHECK(visibility IN ('public','following','mutual')), is_seed INTEGER NOT NULL DEFAULT 0, is_fictional_demo INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, UNIQUE(user_id, place_id))`,
  `CREATE TABLE IF NOT EXISTS tier_entries (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE, tier TEXT NOT NULL CHECK(tier IN ('S','A','B','C')), position INTEGER NOT NULL DEFAULT 0, is_seed INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY(user_id, place_id))`,
  `CREATE TABLE IF NOT EXISTS geocode_cache (query TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews(place_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_places_area ON places(area)`,
  `CREATE INDEX IF NOT EXISTS idx_tiers_user ON tier_entries(user_id, tier, position)`,
  `CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, accent_color TEXT NOT NULL DEFAULT '#ff5a36', maps_query TEXT NOT NULL, is_seed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE, name TEXT NOT NULL, normalized_name TEXT NOT NULL, is_limited INTEGER NOT NULL DEFAULT 1, release_date TEXT, official_url TEXT, image_url TEXT, image_key TEXT, created_by TEXT NOT NULL REFERENCES users(id), is_seed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, UNIQUE(brand_id, normalized_name))`,
  `CREATE TABLE IF NOT EXISTS product_reviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, tier TEXT NOT NULL CHECK(tier IN ('S','A','B','C')), visibility TEXT NOT NULL DEFAULT 'following' CHECK(visibility IN ('public','following','mutual')), image_url TEXT, image_key TEXT, store_name TEXT, store_maps_url TEXT, is_seed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, UNIQUE(user_id, product_id))`,
  `CREATE TABLE IF NOT EXISTS product_wants (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, PRIMARY KEY(user_id, product_id))`,
  `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at DESC)`,
];

const seedUsers = [
  ["u_demo", "guest_builder", "あなた（デモ）", "会場でKOKOUMAを試すための書き込み可能なデモアカウント。", "#ffcf40", 0],
  ["u_mika", "mika_asakusa", "ミカ", "浅草育ち。路地裏の湯気と固めプリンが好き。", "#ff5a36", 0],
  ["u_ren", "ren_tokyo", "レン", "仕事帰りの一杯と、行列しない名店を記録中。", "#b9da45", 0],
  ["u_yui", "yui_cafe", "ユイ", "カフェの光、器、音までレビューします。", "#f4b8c4", 0],
  ["u_daichi", "daichi_eats", "ダイチ", "ラーメンとカツ丼。うまければ距離は関係ない。", "#5bb7d7", 0],
  ["u_jensen", "jensen_demo", "Jensen Huang", "NVIDIA CEOを題材にした非公式デモアカウントです。本人とは関係ありません。", "#76b900", 1],
  ["u_kioxia_ota", "hiroo_ota_demo", "太田 裕雄", "キオクシア株式会社 代表取締役社長を題材にした非公式デモアカウントです。本人・同社とは関係ありません。", "#38bdf8", 1],
];

const seedPlaces = [
  ["p_asakusa_menchi", "浅草メンチ", "東京都台東区浅草2-3-3", "浅草", "食べ歩き", 35.71210, 139.79491, "https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E3%83%A1%E3%83%B3%E3%83%81", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=1200&q=85", "u_mika"],
  ["p_asakusa_feb", "FEBRUARY CAFE", "東京都台東区駒形1-9-8", "浅草", "カフェ", 35.70862, 139.79582, "https://www.google.com/maps/search/?api=1&query=FEBRUARY+CAFE+%E6%B5%85%E8%8D%89", "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85", "u_yui"],
  ["p_asakusa_tengoku", "珈琲 天国", "東京都台東区浅草1-41-9", "浅草", "喫茶店", 35.71361, 139.79327, "https://www.google.com/maps/search/?api=1&query=%E7%8F%88%E7%90%B2%E5%A4%A9%E5%9B%BD+%E6%B5%85%E8%8D%89", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=85", "u_mika"],
  ["p_asakusa_sometaro", "染太郎", "東京都台東区西浅草2-2-2", "浅草", "お好み焼き", 35.71267, 139.78932, "https://www.google.com/maps/search/?api=1&query=%E6%9F%93%E5%A4%AA%E9%83%8E+%E8%A5%BF%E6%B5%85%E8%8D%89", "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=1200&q=85", "u_ren"],
  ["p_shibuya_uobei", "魚べい 渋谷道玄坂店", "東京都渋谷区道玄坂2-29-11", "渋谷", "寿司", 35.66014, 139.69766, "https://www.google.com/maps/search/?api=1&query=%E9%AD%9A%E3%81%B9%E3%81%84+%E6%B8%8B%E8%B0%B7%E9%81%93%E7%8E%84%E5%9D%82", "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=85", "u_daichi"],
  ["p_shibuya_aboutlife", "ABOUT LIFE COFFEE BREWERS", "東京都渋谷区道玄坂1-19-8", "渋谷", "コーヒー", 35.65680, 139.69632, "https://www.google.com/maps/search/?api=1&query=ABOUT+LIFE+COFFEE+BREWERS", "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85", "u_yui"],
  ["p_shibuya_zuicho", "瑞兆", "東京都渋谷区宇田川町41-26", "渋谷", "カツ丼", 35.66318, 139.69578, "https://www.google.com/maps/search/?api=1&query=%E7%91%9E%E5%85%86+%E6%B8%8B%E8%B0%B7", "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=1200&q=85", "u_daichi"],
  ["p_shinjuku_fuunji", "風雲児", "東京都渋谷区代々木2-14-3", "新宿", "つけ麺", 35.68669, 139.69543, "https://www.google.com/maps/search/?api=1&query=%E9%A2%A8%E9%9B%B2%E5%85%90+%E6%96%B0%E5%AE%BF", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=85", "u_daichi"],
  ["p_shinjuku_allseasons", "4/4 SEASONS COFFEE", "東京都新宿区新宿2-7-7", "新宿", "カフェ", 35.69062, 139.70804, "https://www.google.com/maps/search/?api=1&query=4%2F4+SEASONS+COFFEE", "https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1200&q=85", "u_yui"],
  ["p_shinjuku_torobako", "トロ函 新宿思い出横丁店", "東京都新宿区西新宿1-2-5", "新宿", "居酒屋", 35.69277, 139.69944, "https://www.google.com/maps/search/?api=1&query=%E3%83%88%E3%83%AD%E5%87%BD+%E6%96%B0%E5%AE%BF%E6%80%9D%E3%81%84%E5%87%BA%E6%A8%AA%E4%B8%81", "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85", "u_ren"],
  ["p_futako_lisette", "カフェ リゼッタ 二子玉川店", "東京都世田谷区玉川3-9-7", "二子玉川", "カフェ", 35.61336, 139.62598, "https://www.google.com/maps/search/?api=1&query=%E3%82%AB%E3%83%95%E3%82%A7%E3%83%AA%E3%82%BC%E3%83%83%E3%82%BF+%E4%BA%8C%E5%AD%90%E7%8E%89%E5%B7%9D", "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85", "u_yui"],
  ["p_futako_100spoons", "100本のスプーン FUTAKOTAMAGAWA", "東京都世田谷区玉川1-14-1", "二子玉川", "洋食", 35.61140, 139.63000, "https://www.google.com/maps/search/?api=1&query=100%E6%9C%AC%E3%81%AE%E3%82%B9%E3%83%97%E3%83%BC%E3%83%B3+FUTAKOTAMAGAWA", "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85", "u_mika"],
  ["p_futako_oso", "OXYMORON 二子玉川", "東京都世田谷区玉川3-17-1", "二子玉川", "カレー", 35.61472, 139.62407, "https://www.google.com/maps/search/?api=1&query=OXYMORON+%E4%BA%8C%E5%AD%90%E7%8E%89%E5%B7%9D", "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=1200&q=85", "u_ren"],
  ["p_kanda_sankichi", "やきとん三吉 神田北口店", "東京都千代田区内神田3-22-9 新八光ビル1F", "神田", "やきとん", 35.69295, 139.77032, "https://www.google.com/maps/search/?api=1&query=%E3%82%84%E3%81%8D%E3%81%A8%E3%82%93%E4%B8%89%E5%90%89+%E7%A5%9E%E7%94%B0%E5%8C%97%E5%8F%A3%E5%BA%97", "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=1200&q=85", "u_jensen"],
];

const seedReviews = [
  ["r1", "u_mika", "p_asakusa_menchi", 5, "衣のザクッ、そのあと肉汁。浅草に友達が来たら最初に連れていく一軒。", 0],
  ["r2", "u_yui", "p_asakusa_feb", 5, "朝の光がきれい。ラテと焦がしキャラメルのプリンで、浅草散歩の速度がちょうどよくなる。", 0],
  ["r3", "u_mika", "p_asakusa_tengoku", 4, "ホットケーキの焼き印まで含めて浅草。小さな店なので二人で行くのが好き。", 0],
  ["r4", "u_ren", "p_asakusa_sometaro", 5, "自分で焼く時間までごちそう。古い木造の空気とソースの匂いが忘れられない。", 0],
  ["r5", "u_daichi", "p_shibuya_uobei", 4, "速い、楽しい、ちゃんとうまい。渋谷で時間がない日の最適解。", 0],
  ["r6", "u_yui", "p_shibuya_aboutlife", 5, "立ち飲みの一杯が街とつながっている感じ。浅煎り派なら寄ってほしい。", 0],
  ["r7", "u_daichi", "p_shibuya_zuicho", 5, "卵でとじない潔さ。甘辛いタレとサクサクのカツ、メニュー一択の強さ。", 0],
  ["r8", "u_daichi", "p_shinjuku_fuunji", 5, "濃厚なのに最後まで重くない。並んでも食べたいつけ麺の基準点。", 0],
  ["r9", "u_yui", "p_shinjuku_allseasons", 4, "プリンの輪郭がきれい。新宿の喧騒から数分で静かな午後に切り替わる。", 0],
  ["r10", "u_ren", "p_shinjuku_torobako", 4, "仕事終わりの温度にぴったり。焼き魚と大きな声まで含めて東京の夜。", 0],
  ["r11", "u_yui", "p_futako_lisette", 5, "季節のプリンアラモードは、食べる前に少し眺めたくなる。器と庭の緑も好き。", 0],
  ["r12", "u_mika", "p_futako_100spoons", 4, "大人も子どもも同じテーブルでわくわくできる。リトルビッグプレートが楽しい。", 0],
  ["r13", "u_ren", "p_futako_oso", 5, "香りの層がきれいなカレー。買い物のついでではなく、ここを目的に来たい。", 0],
  ["r14", "u_jensen", "p_kanda_sankichi", 5, "炭火の前では、ロボティクスの話も串のようにテンポよく進む。価格性能まで圧倒的。※本人の発言ではなく、来店報道を題材にした架空のデモレビューです。", 1],
  ["r15", "u_mika", "p_asakusa_feb", 4, "朝いちばんの浅草で飲むカフェラテ。観光地の外側にある日常が好き。", 0],
  ["r16", "u_ren", "p_kanda_sankichi", 4, "串を何本頼んでも気取らない。神田で仲間と話す夜にちょうどいい。", 0],
  ["r17", "u_kioxia_ota", "p_kanda_sankichi", 5, "煙の香りとタレの余韻は、不揮発性メモリのように長く残る。神田の夜を『記憶』に保存したくなる一軒。※本人の発言・来店事実ではなく、デモ用に作成した架空のレビューです。", 1],
];

const seedTiers = [
  ["u_mika", "p_asakusa_menchi", "S", 0], ["u_mika", "p_asakusa_feb", "A", 0], ["u_mika", "p_asakusa_tengoku", "A", 1], ["u_mika", "p_futako_100spoons", "B", 0],
  ["u_yui", "p_futako_lisette", "S", 0], ["u_yui", "p_shibuya_aboutlife", "S", 1], ["u_yui", "p_shinjuku_allseasons", "A", 0], ["u_yui", "p_asakusa_feb", "A", 1],
  ["u_daichi", "p_shibuya_zuicho", "S", 0], ["u_daichi", "p_shinjuku_fuunji", "S", 1], ["u_daichi", "p_shibuya_uobei", "B", 0],
  ["u_ren", "p_asakusa_sometaro", "S", 0], ["u_ren", "p_futako_oso", "A", 0], ["u_ren", "p_kanda_sankichi", "A", 1],
  ["u_jensen", "p_kanda_sankichi", "S", 0],
  ["u_kioxia_ota", "p_kanda_sankichi", "S", 0],
];

const seedBrands = [
  ["b_starbucks", "スターバックス", "starbucks", "#00754a", "スターバックス"],
  ["b_kfc", "ケンタッキーフライドチキン", "kfc", "#e4002b", "ケンタッキーフライドチキン"],
  ["b_godiva", "GODIVA", "godiva", "#b89b5e", "GODIVA"],
];

const seedProducts = [
  ["prod_starbucks_honey_banana", "b_starbucks", "ハニー バナナ フラペチーノ®", "ハニーバナナフラペチーノ", 1, "2026-06-05", "https://stories.starbucks.co.jp/press/2026/pr2026-06-01/", "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=1200&q=85", "u_yui"],
  ["prod_kfc_summer_wafu", "b_kfc", "夏の和風バーガーズ", "夏の和風バーガーズ", 1, "2026-07-08", "https://japan.kfc.co.jp/news_release/8158", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85", "u_daichi"],
  ["prod_godiva_melon", "b_godiva", "メロン ショコリキサー", "メロンショコリキサー", 1, "2026-07-17", "https://www.godiva.co.jp/news/news20260702_1.html", "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=85", "u_mika"],
];

const seedProductReviews = [
  ["pr1", "u_yui", "prod_starbucks_honey_banana", 5, "はちみつの丸い甘さとバナナの濃さが、疲れた午後にちょうどいい。今季のご褒美枠。", "S", "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=1200&q=85"],
  ["pr2", "u_daichi", "prod_kfc_summer_wafu", 4, "だしの旨みにレモンが効いて、揚げ物なのに最後まで軽い。夏の昼にもう一度食べたい。", "A", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85"],
  ["pr3", "u_mika", "prod_godiva_melon", 5, "メロンの青い香りのあとにチョコレートの余韻。ひんやり濃厚で、これは友達にもすすめたい。", "S", "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=85"],
];

export async function ensureDatabase() {
  const { DB } = bindings();
  if (!DB) throw new Error("D1 binding DB is unavailable");
  const reviewColumns = await DB.prepare(`PRAGMA table_info(reviews)`).all<{ name: string }>().catch(() => ({ results: [] }));
  if (reviewColumns.results.length && !reviewColumns.results.some((column) => column.name === "visibility")) {
    await DB.prepare(`ALTER TABLE reviews ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','following','mutual'))`).run();
  }
  if (reviewColumns.results.length) {
    const visibilityMigrated = await DB.prepare(`SELECT value FROM app_meta WHERE key='visibility_v2'`).first().catch(() => null);
    if (!visibilityMigrated) {
      await DB.batch([
        DB.prepare(`UPDATE reviews SET visibility='following' WHERE visibility='public' AND is_seed=0`),
        DB.prepare(`UPDATE product_reviews SET visibility='following' WHERE visibility='public' AND is_seed=0`),
        DB.prepare(`INSERT INTO app_meta (key,value) VALUES ('visibility_v2','1') ON CONFLICT(key) DO UPDATE SET value=excluded.value`),
      ]).catch(() => undefined);
    }
  }
  const ready = await DB.prepare(`SELECT value FROM app_meta WHERE key = 'seed_version'`).first().catch(() => null);
  if (ready?.value === "4") return DB;
  await DB.batch(schemaStatements.map((sql) => DB.prepare(sql)));
  const now = Date.now();
  for (const [id, handle, displayName, bio, avatarColor, unofficial] of seedUsers) {
    await DB.prepare(`INSERT OR IGNORE INTO users (id,handle,display_name,bio,avatar_color,is_seed,is_unofficial,created_at) VALUES (?,?,?,?,?,1,?,?)`)
      .bind(id, handle, displayName, bio, avatarColor, unofficial, now).run();
  }
  for (const p of seedPlaces) {
    await DB.prepare(`INSERT OR IGNORE INTO places (id,name,address,area,category,latitude,longitude,google_maps_url,image_url,created_by,is_seed,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`)
      .bind(...p, now).run();
  }
  for (const r of seedReviews) {
    await DB.prepare(`INSERT OR IGNORE INTO reviews (id,user_id,place_id,rating,body,is_seed,is_fictional_demo,visibility,created_at) VALUES (?,?,?,?,?,1,?,'public',?)`)
      .bind(...r, now).run();
  }
  for (const t of seedTiers) {
    await DB.prepare(`INSERT OR IGNORE INTO tier_entries (user_id,place_id,tier,position,is_seed,updated_at) VALUES (?,?,?,?,1,?)`)
      .bind(...t, now).run();
  }
  for (const brand of seedBrands) {
    await DB.prepare(`INSERT OR IGNORE INTO brands (id,name,slug,accent_color,maps_query,is_seed,created_at) VALUES (?,?,?,?,?,1,?)`).bind(...brand, now).run();
  }
  for (const product of seedProducts) {
    await DB.prepare(`INSERT OR IGNORE INTO products (id,brand_id,name,normalized_name,is_limited,release_date,official_url,image_url,created_by,is_seed,created_at) VALUES (?,?,?,?,?,?,?,?,?,1,?)`).bind(...product, now).run();
  }
  for (const review of seedProductReviews) {
    await DB.prepare(`INSERT OR IGNORE INTO product_reviews (id,user_id,product_id,rating,body,tier,visibility,image_url,is_seed,created_at) VALUES (?,?,?,?,?,?,'public',?,1,?)`).bind(...review, now).run();
  }
  await DB.batch([
    DB.prepare(`INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES ('u_mika','u_yui',?)`).bind(now),
    DB.prepare(`INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES ('u_mika','u_ren',?)`).bind(now),
    DB.prepare(`INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES ('u_mika','u_daichi',?)`).bind(now),
    DB.prepare(`INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES ('u_demo','u_yui',?)`).bind(now),
    DB.prepare(`INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES ('u_demo','u_ren',?)`).bind(now),
    DB.prepare(`INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES ('u_yui','u_demo',?)`).bind(now),
    DB.prepare(`INSERT INTO app_meta (key,value) VALUES ('seed_version','4') ON CONFLICT(key) DO UPDATE SET value=excluded.value`),
  ]);
  return DB;
}

function toHex(bytes: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashToken(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

const PASSWORD_ITERATIONS_LEGACY = 120_000;
const PASSWORD_ITERATIONS_EDGE = 20_000;
const PASSWORD_SALT_VERSION = "v2$";

export async function hashPassword(password: string, storedSalt: string) {
  const isEdgeVersion = storedSalt.startsWith(PASSWORD_SALT_VERSION);
  const saltHex = isEdgeVersion ? storedSalt.slice(PASSWORD_SALT_VERSION.length) : storedSalt;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: isEdgeVersion ? PASSWORD_ITERATIONS_EDGE : PASSWORD_ITERATIONS_LEGACY }, key, 256);
  return toHex(bits);
}

export function newSalt() { return PASSWORD_SALT_VERSION + randomHex(16); }

export async function getCurrentUser(request: Request): Promise<AppUser | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("kokouma_session="))?.split("=")[1];
  if (!token) return null;
  const DB = await ensureDatabase();
  const row = await DB.prepare(`SELECT u.id,u.handle,u.display_name as displayName,u.bio,u.avatar_color as avatarColor,u.is_seed as isSeed,u.is_unofficial as isUnofficial FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`)
    .bind(await hashToken(token), Date.now()).first<AppUser>();
  return row ?? null;
}

export async function sessionResponse(userId: string, payload: object) {
  const DB = await ensureDatabase();
  const token = randomHex(32);
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  await DB.prepare(`INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)`)
    .bind(await hashToken(token), userId, expiresAt, Date.now()).run();
  return Response.json(payload, {
    headers: { "set-cookie": `kokouma_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` },
  });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function publicUser(row: Record<string, unknown>) {
  return { ...row, isSeed: Boolean(row.isSeed), isUnofficial: Boolean(row.isUnofficial) };
}
