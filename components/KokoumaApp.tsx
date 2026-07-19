"use client";

import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Compass, Crosshair, Heart, ImagePlus, List, LoaderCircle, LogIn, Map as MapIcon, MapPin, Plus, QrCode, Search, Share2, Sparkles, Star, Trash2, Trophy, UserRound, Users, X } from "lucide-react";
import { prepareImage, usePasteImage } from "../lib/client-image";

type User = { id: string; handle: string; displayName: string; bio: string; avatarColor: string; isSeed: boolean; isUnofficial: boolean };
type Place = { id: string; name: string; address: string; area: string; category: string; latitude: number; longitude: number; googleMapsUrl: string; imageUrl?: string; imageKey?: string; createdBy: string; averageRating: number; reviewCount: number; isSeed: boolean };
type ReviewVisibility = "public" | "following" | "mutual";
type Review = { id: string; userId: string; placeId: string; rating: number; body: string; imageKey?: string; displayName: string; handle: string; avatarColor: string; visibility: ReviewVisibility; isSeed: boolean; isFictionalDemo: boolean; isUnofficial: boolean };
type TierEntry = { userId: string; placeId: string; tier: "S" | "A" | "B" | "C"; position: number; isSeed: boolean };
type Follow = { followerId: string; followingId: string };
type Brand = { id: string; name: string; slug: string; accentColor: string; mapsQuery: string; isSeed: boolean };
type Product = { id: string; brandId: string; brandName: string; name: string; normalizedName: string; isLimited: boolean; releaseDate?: string; officialUrl?: string; imageUrl?: string; imageKey?: string; createdBy: string; accentColor: string; mapsQuery: string; averageRating: number; reviewCount: number; wantCount: number; isSeed: boolean };
type ProductReview = { id: string; userId: string; productId: string; rating: number; body: string; tier: "S"|"A"|"B"|"C"; visibility: ReviewVisibility; imageUrl?: string; imageKey?: string; storeName?: string; storeMapsUrl?: string; displayName: string; handle: string; avatarColor: string; isSeed: boolean; isUnofficial: boolean };
type ProductWant = { userId: string; productId: string };
type Bootstrap = { currentUser: User | null; users: User[]; places: Place[]; reviews: Review[]; tiers: TierEntry[]; follows: Follow[]; brands: Brand[]; products: Product[]; productReviews: ProductReview[]; productWants: ProductWant[] };
type View = "discover" | "tier" | "people" | "profile";
type Lookups = { usersById: Map<string, User>; placesById: Map<string, Place>; productsById: Map<string, Product>; reviewsByPlace: Map<string, Review[]>; productReviewsByProduct: Map<string, ProductReview[]>; reviewsByUser: Map<string, Review[]>; tiersByUser: Map<string, TierEntry[]>; productReviewsByUser: Map<string, ProductReview[]> };

const ASAKUSA: [number, number] = [139.7947, 35.7122];
const tierColors = { S: "#ff5a36", A: "#ffb238", B: "#b9da45", C: "#9ca59f" } as const;
const visibilityCopy: Record<"following" | "mutual", { label: string; detail: string }> = {
  following: { label: "フォロー中", detail: "あなたがフォローしている人だけに公開" },
  mutual: { label: "相互だけ", detail: "お互いフォローしている人だけに公開" },
};
const genrePresets = ["カフェ", "ラーメン", "定食・食堂", "居酒屋", "寿司", "焼肉", "カレー", "パン", "スイーツ", "バー"];

async function api(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(path, options);
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || (response.status >= 500 ? "サーバーで処理できませんでした。少し待ってもう一度お試しください" : "通信に失敗しました"));
  return body;
}

function Avatar({ user, size = 42 }: { user: Pick<User, "displayName" | "avatarColor" | "isUnofficial">; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, background: user.avatarColor, fontSize: size * .34 }} aria-label={user.displayName}>{user.displayName.slice(0, 1)}{user.isUnofficial && <i>!</i>}</span>;
}

function Stars({ value, interactive, onChange }: { value: number; interactive?: boolean; onChange?: (value: number) => void }) {
  return <span className={`stars ${interactive ? "interactive" : ""}`} aria-label={`星${value}`}>{[1,2,3,4,5].map((star) => <button key={star} type="button" disabled={!interactive} onClick={() => onChange?.(star)} aria-label={`星${star}`}><Star size={interactive ? 28 : 14} fill={star <= value ? "currentColor" : "none"} /></button>)}</span>;
}

function MapPanel({ places, selected, onSelect, onPick, center }: { places: Place[]; selected?: string; onSelect: (id: string) => void; onPick?: (lng: number, lat: number) => void; center?: [number, number] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const maplibre = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!container.current || map.current) return;
    let alive = true;
    import("maplibre-gl").then((module) => {
      if (!alive || !container.current || map.current) return;
      const maplibregl = (module as { default?: typeof import("maplibre-gl") }).default ?? module;
      maplibre.current = maplibregl;
      map.current = new maplibregl.Map({
        container: container.current,
        center: center ?? ASAKUSA,
        zoom: 13.2,
        style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
        attributionControl: { compact: true },
      });
      map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.current.on("click", (event) => onPick?.(event.lngLat.lng, event.lngLat.lat));
      setReady(true);
    });
    return () => { alive = false; map.current?.remove(); map.current = null; };
  }, [onPick]);
  useEffect(() => {
    if (!ready || !maplibre.current || !map.current) return;
    const maplibregl = maplibre.current;
    markers.current.forEach((marker) => marker.remove());
    markers.current = places.map((place) => {
      const el = document.createElement("button");
      el.className = `map-marker ${selected === place.id ? "active" : ""}`;
      el.innerHTML = `<span>${place.averageRating >= 4.8 ? "★" : "●"}</span>`;
      el.setAttribute("aria-label", place.name);
      el.onclick = () => onSelect(place.id);
      return new maplibregl.Marker({ element: el }).setLngLat([place.longitude, place.latitude]).addTo(map.current!);
    });
  }, [places, selected, onSelect, ready]);
  useEffect(() => {
    if (!map.current || !center) return;
    map.current.flyTo({ center, zoom: 14, essential: true });
  }, [center]);
  return <div className="map-wrap"><div ref={container} className="map-canvas" /><div className="map-legend"><span /> FRIEND PICKS</div></div>;
}

function Modal({ children, title, onClose, wide }: { children: React.ReactNode; title: string; onClose: () => void; wide?: boolean }) {
  useEffect(() => { const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", fn); return () => removeEventListener("keydown", fn); }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.currentTarget === e.target && onClose()}><section className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header><div><small>KOKOUMA ACTION</small><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="閉じる"><X /></button></header>{children}</section></div>;
}

export function KokoumaApp() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [view, setView] = useState<View>("discover");
  const [query, setQuery] = useState("");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [mobileMap, setMobileMap] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [selectedProductId, setSelectedProductId] = useState<string>();
  const [profileId, setProfileId] = useState<string>();
  const [profileFocus, setProfileFocus] = useState(false);
  const [modal, setModal] = useState<"auth" | "add" | "review" | "delete-place" | "product-review" | "qr" | "scan" | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>(ASAKUSA);
  const openProfile = useCallback((id:string) => { setProfileId(id); setProfileFocus(true); setView("people"); requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 })); }, []);
  const refresh = useCallback(async (background = false) => { if (!background) setLoading(true); try { setData(await api("/api/bootstrap")); } catch (e) { setToast(e instanceof Error ? e.message : "読み込めませんでした"); } finally { if (!background) setLoading(false); } }, []);
  useEffect(() => { refresh(); const handle = new URLSearchParams(location.search).get("profile"); if (handle) setTimeout(() => openProfile(handle), 0); }, [refresh,openProfile]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 3200); return () => clearTimeout(timer); }, [toast]);

  const current = data?.currentUser ?? null;
  const loggedOut = Boolean(data && !current);
  const followed = useMemo(() => new Set((data?.follows ?? []).filter((f) => f.followerId === current?.id).map((f) => f.followingId)), [data, current]);
  const areas = useMemo(() => [...new Set((data?.places ?? []).map((place) => place.area).filter(Boolean))], [data]);
  const lookups = useMemo<Lookups>(() => {
    const usersById = new Map((data?.users ?? []).map((u) => [u.id, u] as const));
    const placesById = new Map((data?.places ?? []).map((p) => [p.id, p] as const));
    const productsById = new Map((data?.products ?? []).map((p) => [p.id, p] as const));
    const reviewsByPlace = new Map<string, Review[]>();
    (data?.reviews ?? []).forEach((r) => { const list = reviewsByPlace.get(r.placeId); if (list) list.push(r); else reviewsByPlace.set(r.placeId, [r]); });
    const productReviewsByProduct = new Map<string, ProductReview[]>();
    (data?.productReviews ?? []).forEach((r) => { const list = productReviewsByProduct.get(r.productId); if (list) list.push(r); else productReviewsByProduct.set(r.productId, [r]); });
    const reviewsByUser = new Map<string, Review[]>();
    (data?.reviews ?? []).forEach((r) => { const list = reviewsByUser.get(r.userId); if (list) list.push(r); else reviewsByUser.set(r.userId, [r]); });
    const tiersByUser = new Map<string, TierEntry[]>();
    (data?.tiers ?? []).forEach((t) => { const list = tiersByUser.get(t.userId); if (list) list.push(t); else tiersByUser.set(t.userId, [t]); });
    const productReviewsByUser = new Map<string, ProductReview[]>();
    (data?.productReviews ?? []).forEach((r) => { const list = productReviewsByUser.get(r.userId); if (list) list.push(r); else productReviewsByUser.set(r.userId, [r]); });
    return { usersById, placesById, productsById, reviewsByPlace, productReviewsByProduct, reviewsByUser, tiersByUser, productReviewsByUser };
  }, [data]);
  const filteredPlaces = useMemo(() => (data?.places ?? []).filter((place) => {
    const text = `${place.name}${place.area}${place.category}${place.address}`.toLowerCase();
    const authors = (lookups.reviewsByPlace.get(place.id) ?? []).map((r) => r.userId);
    return (!query || text.includes(query.toLowerCase())) && (!followingOnly || authors.some((id) => followed.has(id)));
  }), [data, query, followingOnly, followed, lookups]);
  const selectedPlace = selectedPlaceId ? lookups.placesById.get(selectedPlaceId) : undefined;
  const selectedProduct = selectedProductId ? lookups.productsById.get(selectedProductId) : undefined;
  const selectedProfile = data?.users.find((u) => u.id === profileId || u.handle === profileId) ?? (view === "profile" ? current ?? undefined : undefined);
  const existingProductReview = current && selectedProduct ? (lookups.productReviewsByProduct.get(selectedProduct.id) ?? []).find((review) => review.userId === current.id) : undefined;

  const requireAuth = (next: typeof modal) => { if (!current) setModal("auth"); else setModal(next); };
  const showToast = (message: string) => setToast(message);
  const locate = () => navigator.geolocation?.getCurrentPosition((pos) => { setMapCenter([pos.coords.longitude, pos.coords.latitude]); showToast("現在地へ移動しました"); }, () => { setMapCenter(ASAKUSA); showToast("位置情報を使えないため浅草を表示します"); }, { timeout: 7000 });

  const toggleFollow = useCallback(async (id: string) => {
    if (!current) { setModal("auth"); return; }
    const wasFollowing = Boolean(data?.follows.some((f) => f.followerId === current.id && f.followingId === id));
    const target = data?.users.find((u) => u.id === id);
    setData((d) => d ? { ...d, follows: wasFollowing ? d.follows.filter((f) => !(f.followerId === current.id && f.followingId === id)) : [...d.follows, { followerId: current.id, followingId: id }] } : d);
    try {
      await api("/api/follows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: id }) });
      await refresh(true);
      showToast(wasFollowing ? "フォローを解除しました" : `${target?.displayName ?? ""}をフォローしました`);
    } catch (e) {
      showToast((e as Error).message);
      await refresh(true);
    }
  }, [current, data, refresh]);

  const toggleWant = useCallback(async (productId: string) => {
    if (!current) { setModal("auth"); return; }
    const wasWanted = Boolean(data?.productWants.some((w) => w.userId === current.id && w.productId === productId));
    setData((d) => d ? { ...d, productWants: wasWanted ? d.productWants.filter((w) => !(w.userId === current.id && w.productId === productId)) : [...d.productWants, { userId: current.id, productId }], products: d.products.map((p) => p.id === productId && p.wantCount != null ? { ...p, wantCount: p.wantCount + (wasWanted ? -1 : 1) } : p) } : d);
    try {
      await api("/api/products/want", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) });
      await refresh(true);
      showToast(wasWanted ? "食べたいを解除しました" : "食べたいに追加しました");
    } catch (e) {
      showToast((e as Error).message);
      await refresh(true);
    }
  }, [current, data, refresh]);

  const moveTier = useCallback(async (placeId: string, tier: TierEntry["tier"]) => {
    if (!current) { setModal("auth"); return; }
    setData((d) => d ? { ...d, tiers: d.tiers.map((entry) => entry.userId === current.id && entry.placeId === placeId ? { ...entry, tier } : entry) } : d);
    try {
      await api("/api/tiers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId, tier }) });
      await refresh(true);
      showToast(`${tier} Tierへ移動しました`);
    } catch (e) {
      showToast((e as Error).message);
      await refresh(true);
    }
  }, [current, refresh]);

  if (!data && loading) return <main className="loading-screen"><div className="brand-mark"><span>K</span></div><p>友だちの「うまい」を集めています</p><LoaderCircle className="spin" /></main>;

  return <div className="app-shell">
    <header className="topbar">
      <button className="logo" onClick={() => { setView("discover"); setSelectedPlaceId(undefined); }}><span>K</span><b>KOKOUMA</b><small>FRIENDS’ FOOD MAP</small></button>
      {current && <nav className="desktop-nav" aria-label="メインナビ">
        <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><Compass />見つける</button>
        <button className={view === "tier" ? "active" : ""} onClick={() => setView("tier")}><Trophy />Tier表</button>
        <button className={view === "people" ? "active" : ""} onClick={() => { setView("people"); setProfileFocus(false); }}><Users />友だち</button>
      </nav>}
      <div className="top-actions">{current && <button className="add-button" onClick={() => requireAuth("add")}><Plus />お店を登録</button>}{current ? <button className="user-chip" aria-label={`${current.displayName}のプロフィール`} onClick={() => { setView("profile"); setProfileId(current.id); }}><Avatar user={current} size={34} /><span>{current.displayName}</span></button> : <button className="login-button" onClick={() => setModal("auth")}><LogIn />ログイン</button>}</div>
    </header>

    {loggedOut ? <WelcomeScreen data={data!} profileId={profileId} onAuth={() => setModal("auth")} /> : <>
    {view === "discover" && <main className="discover-layout">
      <section className={`feed-panel ${mobileMap ? "mobile-hidden" : ""}`}>
        <div className="intro-block reveal-1"><div><span className="eyebrow"><Sparkles size={14} /> NEAR YOU, FROM YOUR PEOPLE</span><h1>星より、<br/><em>あの人</em>のひとこと。</h1></div><p>広告ではなく、知っている人の「また行きたい」だけを地図にしました。</p></div>
        <div className="search-zone reveal-2"><label className="search-box"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="店名・料理・エリア・住所で探す" /></label><button className="locate-button" onClick={locate}><Crosshair />現在地</button></div>
        <div className="filters reveal-2"><button className={followingOnly ? "active friend-filter" : "friend-filter"} aria-pressed={followingOnly} onClick={() => current ? setFollowingOnly(!followingOnly) : setModal("auth")}><Heart size={14} fill={followingOnly ? "currentColor" : "none"} />フォロー中</button></div>
        <NewDropRail data={data!} followed={followed} lookups={lookups} onSelect={setSelectedProductId} onReview={() => requireAuth("product-review")} />
        <div className="result-heading"><p><b>{filteredPlaces.length}</b> SPOTS FOUND</p><span>友だちセレクト</span></div>
        <div className="place-grid">{filteredPlaces.map((place, index) => {
          const placeReviews = lookups.reviewsByPlace.get(place.id) ?? [];
          const friendReview = placeReviews.find((r) => followed.has(r.userId)) ?? placeReviews[0];
          const reviewer = friendReview ? lookups.usersById.get(friendReview.userId) : undefined;
          const tier = friendReview ? lookups.tiersByUser.get(friendReview.userId)?.find((t) => t.placeId === place.id) : undefined;
          return <article key={place.id} className="place-card" style={{ animationDelay: `${Math.min(index * 55, 440)}ms` }} onClick={() => setSelectedPlaceId(place.id)}>
            <div className="place-photo">{place.imageUrl || place.imageKey ? <img src={place.imageKey ? `/api/media/${place.imageKey}` : place.imageUrl} alt="" loading="lazy" decoding="async" /> : <div className="photo-fallback">KOKO<br/>UMA</div>}<span className="area-stamp">{place.area}</span>{tier && <span className={`tier-badge tier-${tier.tier}`}>{tier.tier}<small>TIER</small></span>}<span className="rating-pill"><Star size={13} fill="currentColor" />{Number(place.averageRating).toFixed(1)}</span></div>
            <div className="place-copy"><div className="category-line"><span>{place.category}</span><i />{place.reviewCount} REVIEWS</div><h2>{place.name}</h2>{friendReview && reviewer && <div className="friend-quote"><Avatar user={reviewer} size={34} /><p><b>{reviewer.displayName}</b>「{friendReview.body.length > 58 ? `${friendReview.body.slice(0,58)}…` : friendReview.body}」</p></div>}<div className="card-foot"><span><MapPin size={14}/>{place.address.replace(/^東京都[^区]+区/, "")}</span><button aria-label={`${place.name}を見る`}><ChevronRight /></button></div></div>
          </article>;
        })}{!filteredPlaces.length && <div className="empty-state"><Search /><h3>その条件では、まだ一軒もありません。</h3><p>最初の「ここ、うまい」を登録して地図を育てましょう。</p><button onClick={() => requireAuth("add")}><Plus />お店を登録</button></div>}</div>
      </section>
      <aside className={`map-panel ${!mobileMap ? "mobile-hidden-map" : ""}`}><MapPanel places={filteredPlaces} selected={selectedPlaceId} onSelect={setSelectedPlaceId} center={mapCenter} /><div className="map-head"><div><small>LIVE FRIEND MAP</small><b>TOKYO</b></div><button onClick={locate}><Crosshair /> MY LOCATION</button></div>{selectedPlace && <button className="map-preview" onClick={() => setSelectedPlaceId(selectedPlace.id)}><span style={{ backgroundImage: `url(${selectedPlace.imageUrl})` }} /><div><small>{selectedPlace.area} · {selectedPlace.category}</small><b>{selectedPlace.name}</b><em>★ {Number(selectedPlace.averageRating).toFixed(1)}</em></div><ChevronRight /></button>}</aside>
      <div className="mobile-view-switch"><button className={!mobileMap ? "active" : ""} onClick={() => setMobileMap(false)}><List />リスト</button><button className={mobileMap ? "active" : ""} onClick={() => setMobileMap(true)}><MapIcon />地図</button></div>
    </main>}

    {view === "tier" && <TierView data={data!} current={current} lookups={lookups} onAuth={() => setModal("auth")} onMove={moveTier} onSelectPlace={setSelectedPlaceId} onSelectProduct={setSelectedProductId} />}
    {view === "people" && <PeopleView data={data!} current={current} followed={followed} lookups={lookups} selected={selectedProfile} focused={profileFocus&&Boolean(selectedProfile)} onSelect={openProfile} onExitFocus={() => { setProfileFocus(false); setProfileId(undefined); const url=new URL(location.href); url.searchParams.delete("profile"); history.replaceState(null,"",url); window.scrollTo({top:0}); }} onFollow={toggleFollow} onQr={() => requireAuth("qr")} onScan={() => setModal("scan")} onSelectPlace={setSelectedPlaceId} />}
    {view === "profile" && current && <ProfileView user={current} data={data!} lookups={lookups} onQr={() => setModal("qr")} onLogout={async () => { await api("/api/auth/logout", { method:"POST" }); await refresh(); setView("discover"); }} onSelectPlace={setSelectedPlaceId} />}
    {view === "profile" && !current && <section className="auth-required"><UserRound /><h1>あなたの食の地図を作ろう。</h1><p>レビュー、Tier表、友だちのフォローはログインすると使えます。</p><button onClick={() => setModal("auth")}>ログイン / 新規登録</button></section>}
    </>}

    {current && <nav className="mobile-nav"><button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><Compass /><span>見つける</span></button><button className={view === "tier" ? "active" : ""} onClick={() => setView("tier")}><Trophy /><span>Tier</span></button><button className="nav-add" onClick={() => requireAuth("add")}><Plus /></button><button className={view === "people" ? "active" : ""} onClick={() => { setView("people"); setProfileFocus(false); window.scrollTo({top:0}); }}><Users /><span>友だち</span></button><button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}><UserRound /><span>自分</span></button></nav>}

    {selectedPlace && <PlaceDrawer place={selectedPlace} data={data!} lookups={lookups} current={current} onClose={() => setSelectedPlaceId(undefined)} onReview={() => requireAuth("review")} onDelete={() => setModal("delete-place")} onProfile={(id) => { openProfile(id); setSelectedPlaceId(undefined); }} />}
    {selectedProduct && <ProductDrawer product={selectedProduct} data={data!} lookups={lookups} current={current} onClose={() => setSelectedProductId(undefined)} onReview={() => requireAuth("product-review")} onToggleWant={toggleWant} onChanged={() => refresh(true)} toast={showToast} />}
    {modal === "auth" && <AuthModal onClose={() => setModal(null)} onDone={async () => { setModal(null); await refresh(); showToast("KOKOUMAへようこそ！"); if (profileId) openProfile(profileId); }} />}
    {modal === "add" && current && <AddPlaceModal existingAreas={areas} onClose={() => setModal(null)} onDone={async (id) => { setModal(null); await refresh(true); setSelectedPlaceId(id); showToast("地図に新しい一軒を追加しました"); }} />}
    {modal === "review" && selectedPlace && current && <ReviewModal place={selectedPlace} existing={data!.reviews.find((review) => review.placeId === selectedPlace.id && review.userId === current.id)} existingTier={data!.tiers.find((entry) => entry.placeId === selectedPlace.id && entry.userId === current.id)?.tier} onClose={() => setModal(null)} onDone={async () => { setModal(null); await refresh(true); showToast("レビューを記録しました"); }} onDeleted={async () => { setModal(null); await refresh(true); showToast("レビューを削除しました"); }} />}
    {modal === "delete-place" && selectedPlace && <DeletePlaceModal place={selectedPlace} onClose={() => setModal(null)} onDone={async () => { setModal(null); setSelectedPlaceId(undefined); await refresh(true); showToast("登録したお店を削除しました"); }} />}
    {modal === "product-review" && current && <ProductReviewModal data={data!} product={selectedProduct} existing={existingProductReview} onClose={() => setModal(null)} onDone={async (id) => { setModal(null); await refresh(true); setSelectedProductId(id); showToast("新作レビューを公開しました"); }} />}
    {modal === "qr" && current && <QrModal user={current} onClose={() => setModal(null)} />}
    {modal === "scan" && <ScanModal onClose={() => setModal(null)} onScanned={(handle) => { setModal(null); openProfile(handle); }} />}
    {toast && <div className="toast"><Sparkles />{toast}</div>}
  </div>;
}

function WelcomeScreen({ data, profileId, onAuth }: { data: Bootstrap; profileId?: string; onAuth: () => void }) {
  const pendingProfile = profileId ? data.users.find((u) => u.id === profileId || u.handle === profileId) : undefined;
  return <main className="welcome-screen">
    <section className="welcome-hero">
      <span className="eyebrow"><Sparkles size={14} /> FRIENDS-ONLY FOOD MAP</span>
      <h1>友だちだけの、<em>うまい</em>地図。</h1>
      <p>レビューは友だちの間だけで共有。全体公開はありません。信頼できる人のおすすめだけが集まる、あなたのための食の地図です。</p>
      {profileId && <div className="welcome-profile-strip"><UserRound />ログインすると {pendingProfile?.displayName || profileId} さんのプロフィールが見られます</div>}
      <div className="welcome-actions"><button className="primary-submit" onClick={onAuth}><Sparkles />はじめる</button><button className="ghost-button" onClick={onAuth}><LogIn />ログイン</button></div>
    </section>
    <section className="welcome-features">
      <article><Compass /><b>地図で見つける</b><p>友だちが登録したお店をマップと検索で</p></article>
      <article><Trophy /><b>Tierで並べる</b><p>自分だけのS/A/B/Cランキング</p></article>
      <article><QrCode /><b>QRで友だち追加</b><p>QRをかざすだけでつながる</p></article>
    </section>
  </main>;
}

function productImage(product: Product, reviews: ProductReview[]) {
  if (product.imageKey) return `/api/media/${product.imageKey}`;
  if (product.imageUrl) return product.imageUrl;
  const review = reviews.find((item) => item.productId === product.id && (item.imageKey || item.imageUrl));
  return review?.imageKey ? `/api/media/${review.imageKey}` : review?.imageUrl;
}

function openNearbyBrand(product: Product) {
  const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(product.mapsQuery)}`;
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  if (!navigator.geolocation) return open(fallback);
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => open(`https://www.google.com/maps/search/${encodeURIComponent(product.mapsQuery)}/@${coords.latitude},${coords.longitude},14z`),
    () => open(fallback),
    { timeout: 5000 },
  );
}

function NewDropRail({ data, followed, lookups, onSelect, onReview }: { data: Bootstrap; followed: Set<string>; lookups: Lookups; onSelect: (id: string) => void; onReview: () => void }) {
  return <section className="new-drop"><header><div><span><Sparkles /> NEW DROP</span><h2>友だちが食べた、チェーンの新作。</h2></div><button onClick={onReview}><Plus />新作をレビュー</button></header><div className="drop-rail">{data.products.length ? data.products.map((product) => {
    const reviews = lookups.productReviewsByProduct.get(product.id) ?? [];
    const review = reviews.find((item) => followed.has(item.userId)) ?? reviews[0];
    const user = review ? lookups.usersById.get(review.userId) : undefined;
    const image = productImage(product, reviews);
    return <button className="drop-card" key={product.id} onClick={() => onSelect(product.id)} style={{ "--brand": product.accentColor } as React.CSSProperties}><span className="drop-photo" style={{ backgroundImage: image ? `url(${image})` : undefined }}><i>{product.isLimited ? "LIMITED" : "NEW"}</i><b>{review?.tier ?? "NEW"}<small>{review ? "TIER" : "DROP"}</small></b></span><span className="drop-copy"><small>{product.brandName} · {product.releaseDate?.replaceAll("-", ".") ?? "COMMUNITY DROP"}</small><strong>{product.name}</strong><em><Star fill="currentColor" />{Number(product.averageRating).toFixed(1)} <span>{product.reviewCount}人がレビュー</span></em>{review && user && <q><Avatar user={user} size={25}/>{review.body.length > 35 ? `${review.body.slice(0,35)}…` : review.body}</q>}</span></button>;
  }) : <div className="drop-empty"><p>まだ新作がありません。最初の新作をレビューしよう</p><button type="button" onClick={onReview}><Plus />新作をレビュー</button></div>}</div></section>;
}

function ProductDrawer({ product, data, current, lookups, onClose, onReview, onToggleWant, onChanged, toast }: { product: Product; data: Bootstrap; current: User | null; lookups: Lookups; onClose: () => void; onReview: () => void; onToggleWant: (productId: string) => void; onChanged: () => void; toast: (message: string) => void }) {
  const reviews = lookups.productReviewsByProduct.get(product.id) ?? [];
  const ownReview = current ? reviews.find((review) => review.userId === current.id) : undefined;
  const orderedReviews = ownReview ? [ownReview, ...reviews.filter((review) => review.id !== ownReview.id)] : reviews;
  const image = productImage(product, data.productReviews);
  const wanted = Boolean(current && data.productWants.some((want) => want.userId === current.id && want.productId === product.id));
  const wanters = data.productWants.filter((want) => want.productId === product.id);
  const [armedDelete, setArmedDelete] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);
  const disarmDelete = () => { setArmedDelete(false); if (armTimer.current) { clearTimeout(armTimer.current); armTimer.current = undefined; } };
  const deleteOwnReview = async () => {
    if (!armedDelete) { setArmedDelete(true); armTimer.current = setTimeout(disarmDelete, 4000); return; }
    disarmDelete();
    try { await api("/api/products/review", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: product.id }) }); onChanged(); toast("レビューを削除しました"); } catch (e) { toast((e as Error).message); }
  };
  return <div className="drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><aside className="place-drawer product-drawer" onClickCapture={(event) => { if (armedDelete && !(event.target as HTMLElement).closest(".danger-inline")) disarmDelete(); }}><button className="drawer-close" onClick={onClose} aria-label="閉じる"><X /></button><div className="drawer-hero">{image ? <img src={image} alt={product.name} loading="lazy" decoding="async"/> : <div className="photo-fallback">NEW<br/>DROP</div>}<div className="drawer-gradient"/><span>{product.brandName} · {product.isLimited ? "期間限定" : "新商品"}</span></div><div className="drawer-content"><div className="place-title"><div><small>COMMUNITY PRODUCT</small><h2>{product.name}</h2><p><Sparkles />{product.releaseDate ? `${product.releaseDate.replaceAll("-",".")} RELEASE` : "友だちが見つけた新作"}</p></div><div className="big-score"><b>{Number(product.averageRating).toFixed(1)}</b><Stars value={Math.round(product.averageRating)}/><small>{product.reviewCount} reviews</small></div></div><div className="product-actions"><button onClick={() => openNearbyBrand(product)}><MapPin />近くの店舗を探す</button><button className={wanted ? "wanted" : ""} onClick={() => onToggleWant(product.id)} aria-pressed={wanted}><Heart fill={wanted ? "currentColor" : "none"}/>{wanted ? "食べたい済み" : "食べたい"}</button><button onClick={onReview}><Star />{ownReview ? "レビューを編集" : "レビューする"}</button></div>{wanters.length > 0 && <div className="want-row"><span>{wanters.length}人が食べたい</span>{wanters.slice(0, 5).map((want) => { const wanter = lookups.usersById.get(want.userId); return wanter ? <Avatar key={want.userId} user={wanter} size={22}/> : null; })}</div>}{product.officialUrl && <a className="official-link" href={product.officialUrl} target="_blank" rel="noreferrer"><Share2 />公式の商品情報（任意登録）</a>}<section className="review-section"><div className="section-label"><span>FRIENDS’ TASTES</span><b>{reviews.length}</b></div>{orderedReviews.length ? orderedReviews.map((review) => { const user = lookups.usersById.get(review.userId)!; const reviewImage = review.imageKey ? `/api/media/${review.imageKey}` : review.imageUrl; const isOwn = Boolean(current && review.userId === current.id && !review.isSeed); return <article className="product-review-card" key={review.id}>{reviewImage && <img src={reviewImage} alt="" loading="lazy" decoding="async"/>}<div><button className="reviewer"><Avatar user={user} size={38}/><span><b>{user.displayName}</b><small>@{user.handle}</small></span><em className={`mini-tier tier-${review.tier}`}>{review.tier}</em></button><Stars value={review.rating}/><p>{review.body}</p>{review.storeName && <small><MapPin />{review.storeName}</small>}{review.visibility !== "public" && <span className={`audience-badge audience-${review.visibility}`}>{visibilityCopy[review.visibility].label}</span>}{isOwn && <div className="own-review-actions"><button type="button" className="edit-inline" onClick={onReview}>編集</button><button type="button" className={`danger-inline ${armedDelete ? "armed" : ""}`} onClick={deleteOwnReview} aria-pressed={armedDelete}>{armedDelete ? "本当に削除?" : "削除"}</button></div>}</div></article>; }) : <div className="drop-empty"><p>まだレビューがありません。最初のレビューを書こう</p></div>}</section></div></aside></div>;
}

function ProductReviewModal({ data, product, existing, onClose, onDone }: { data: Bootstrap; product?: Product; existing?: ProductReview; onClose: () => void; onDone: (id: string) => void }) {
  const [availableBrands,setAvailableBrands]=useState(data.brands);
  const [brandId,setBrandId]=useState(product?.brandId ?? data.brands[0]?.id ?? "");
  const [name,setName]=useState(product?.name ?? "");
  const [photo,setPhoto]=useState<File>();
  usePasteImage(setPhoto);
  const [rating,setRating]=useState(existing?.rating??5); const [body,setBody]=useState(existing?.body??""); const [tier,setTier]=useState<"S"|"A"|"B"|"C">(existing?.tier??"S"); const [visibility,setVisibility]=useState<ReviewVisibility>(existing?.visibility==="public"?"following":existing?.visibility??"following");
  const [isLimited,setIsLimited]=useState(existing?product?.isLimited??true:true); const [officialUrl,setOfficialUrl]=useState(existing?product?.officialUrl??"":""); const [storeName,setStoreName]=useState(existing?.storeName??""); const [storeMapsUrl,setStoreMapsUrl]=useState(existing?.storeMapsUrl??""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const [addingBrand,setAddingBrand]=useState(false); const [brandName,setBrandName]=useState(""); const [brandBusy,setBrandBusy]=useState(false); const [brandNotice,setBrandNotice]=useState("");
  const candidates=data.products.filter((item)=>item.brandId===brandId);
  const exact=candidates.find((item)=>item.name.normalize("NFKC").replace(/\s/g,"").toLowerCase()===name.normalize("NFKC").replace(/\s/g,"").toLowerCase());
  const createBrand=async()=>{setBrandBusy(true);setError("");setBrandNotice("");try{const result=await api("/api/brands",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:brandName})});const brand=result.brand as Brand;setAvailableBrands((items)=>[...items.filter((item)=>item.id!==brand.id),brand].sort((a,b)=>a.name.localeCompare(b.name,"ja")));setBrandId(brand.id);setName("");setBrandName("");setAddingBrand(false);setBrandNotice(result.existing?"登録済みのブランドを選択しました":"ブランドを登録して選択しました");}catch(error){setError((error as Error).message);}finally{setBrandBusy(false)}};
  const submit=async()=>{setBusy(true);setError("");try{let imageKey="";if(photo){const form=new FormData();form.append("file",photo);const uploaded=await api("/api/upload",{method:"POST",body:form});imageKey=uploaded.key;}const result=await api("/api/products/review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({brandId,productId:product?.id??exact?.id,productName:name,rating,body,tier,visibility,imageKey,officialUrl,storeName,storeMapsUrl,isLimited})});onDone(result.productId);}catch(error){setError((error as Error).message);}finally{setBusy(false)}};
  return <Modal title={existing&&product ? `${product.name}の記録を編集` : product ? `${product.name}をレビュー` : "チェーンの新作をレビュー"} onClose={onClose}><div className="product-review-form"><div className="form-row"><label>ブランド<div className="brand-select-row"><select value={brandId} onChange={(event)=>{setBrandId(event.target.value);setName("");setBrandNotice("")}} disabled={Boolean(product)}>{availableBrands.map((brand)=><option value={brand.id} key={brand.id}>{brand.name}</option>)}</select>{!product&&<button type="button" className="add-brand-trigger" onClick={()=>{setAddingBrand((value)=>!value);setBrandNotice("")}}><Plus />ブランド追加</button>}</div></label><label>商品名<input value={name} onChange={(event)=>setName(event.target.value)} list="product-candidates" maxLength={100} placeholder="商品名を入力" disabled={Boolean(product)}/><datalist id="product-candidates">{candidates.map((item)=><option key={item.id} value={item.name}/>)}</datalist></label></div>{addingBrand&&<div className="brand-creator"><div><span>NEW BRAND</span><b>一覧にないブランドを追加</b><small>名前だけでOK。近隣店舗検索にもそのまま使われます。</small></div><div><input autoFocus value={brandName} onChange={(event)=>setBrandName(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&brandName.trim().length>=2)createBrand()}} maxLength={60} placeholder="例：成城石井"/><button type="button" onClick={createBrand} disabled={brandBusy||brandName.trim().length<2}>{brandBusy?<LoaderCircle className="spin"/>:"登録して選択"}</button></div></div>}{brandNotice&&<p className="brand-notice"><Sparkles />{brandNotice}</p>}<label className="product-photo-drop" onDragOver={(event)=>event.preventDefault()} onDrop={async(event)=>{event.preventDefault();const file=event.dataTransfer.files?.[0];if(file)setPhoto(await prepareImage(file))}}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={async(event)=>{const file=event.target.files?.[0];if(file)setPhoto(await prepareImage(file))}}/>{photo?<img src={URL.createObjectURL(photo)} alt="投稿写真のプレビュー" loading="lazy" decoding="async"/>:<><Camera/><span><b>食べた商品の写真</b><small>タップして追加 · 任意</small></span><span className="paste-hint">⌘V / Ctrl+V で貼り付けOK</span></>}</label><div className="rating-tier-row"><div><p>おすすめ度</p><Stars value={rating} interactive onChange={setRating}/></div><div><p>新作Tier</p><div className="compact-tier">{(["S","A","B","C"] as const).map((value)=><button key={value} className={tier===value?"active":""} style={{"--tier":tierColors[value]} as React.CSSProperties} onClick={()=>setTier(value)}>{value}</button>)}</div></div></div><label>ひとこと<textarea value={body} onChange={(event)=>setBody(event.target.value)} maxLength={600} placeholder="実際に食べて、友達にすすめたいと思った理由は？"/><small>{body.length}/600</small></label><fieldset className="audience-picker"><legend>公開範囲</legend>{(Object.keys(visibilityCopy) as (keyof typeof visibilityCopy)[]).map((value)=><button type="button" key={value} className={visibility===value?"active":""} onClick={()=>setVisibility(value)} aria-pressed={visibility===value}><span><b>{visibilityCopy[value].label}</b><small>{visibilityCopy[value].detail}</small></span></button>)}</fieldset><details className="optional-details"><summary><Plus />詳しい情報を追加（任意）</summary><div className="form-stack"><label className="check-line"><input type="checkbox" checked={isLimited} onChange={(event)=>setIsLimited(event.target.checked)}/>期間限定・数量限定の商品</label><label>食べた店舗<input value={storeName} onChange={(event)=>setStoreName(event.target.value)} placeholder="例：渋谷マークシティ店"/></label><label>店舗のGoogle Maps共有リンク<input value={storeMapsUrl} onChange={(event)=>setStoreMapsUrl(event.target.value)} placeholder="https://maps.app.goo.gl/…"/></label><label>公式商品ページ<input value={officialUrl} onChange={(event)=>setOfficialUrl(event.target.value)} placeholder="https://…"/></label></div></details>{error&&<p className="form-error">{error}</p>}<button className="primary-submit" onClick={submit} disabled={busy||!brandId||name.trim().length<2||body.trim().length<2}>{busy?<LoaderCircle className="spin"/>:existing?"変更を保存":"この新作をレビュー"}</button></div></Modal>;
}

function PlaceDrawer({ place, data, lookups, current, onClose, onReview, onDelete, onProfile }: { place: Place; data: Bootstrap; lookups: Lookups; current: User | null; onClose: () => void; onReview: () => void; onDelete: () => void; onProfile: (id: string) => void }) {
  const reviews = lookups.reviewsByPlace.get(place.id) ?? [];
  const ownReview = reviews.find((review) => review.userId === current?.id);
  const canDelete = Boolean(current && current.id === place.createdBy && !place.isSeed);
  return <div className="drawer-backdrop" onMouseDown={(e) => e.currentTarget === e.target && onClose()}><aside className="place-drawer"><button className="drawer-close" onClick={onClose} aria-label="閉じる"><X /></button><div className="drawer-hero">{place.imageUrl || place.imageKey ? <img src={place.imageKey ? `/api/media/${place.imageKey}` : place.imageUrl} alt={place.name} loading="lazy" decoding="async" /> : <div className="photo-fallback">KOKOUMA</div>}<div className="drawer-gradient"/><span>{place.area} · {place.category}</span></div><div className="drawer-content"><div className="place-title"><div><small>FRIENDS RECOMMEND</small><h2>{place.name}</h2><p><MapPin />{place.address}</p></div><div className="big-score"><b>{Number(place.averageRating).toFixed(1)}</b><Stars value={Math.round(place.averageRating)} /><small>{place.reviewCount} reviews</small></div></div><div className={`drawer-actions ${canDelete ? "has-delete" : ""}`}><a href={place.googleMapsUrl} target="_blank" rel="noreferrer"><MapIcon />Google Mapsで開く</a><button onClick={onReview}><Star />{ownReview ? "レビューを編集" : "レビューを書く"}</button>{canDelete&&<button className="delete-place-button" onClick={onDelete}><Trash2 />お店を削除</button>}</div><section className="review-section"><div className="section-label"><span>FRIENDS’ NOTES</span><b>{reviews.length}</b></div>{reviews.map((review) => { const user = lookups.usersById.get(review.userId)!; const tier = lookups.tiersByUser.get(review.userId)?.find((t) => t.placeId === place.id); return <article className="review-card" key={review.id}>{review.imageKey&&<img className="review-photo" src={`/api/media/${review.imageKey}`} alt={`${user.displayName}のレビュー写真`} loading="lazy" decoding="async"/>}<button className="reviewer" onClick={() => onProfile(user.id)}><Avatar user={user} /><span><b>{user.displayName}</b><small>@{user.handle}</small></span>{tier && <em className={`mini-tier tier-${tier.tier}`}>{tier.tier}</em>}</button><Stars value={review.rating}/><p>{review.body}</p><div className="review-labels">{review.visibility !== "public" && <span className={`audience-badge audience-${review.visibility}`}>{review.visibility === "mutual" ? <Users /> : <Heart />}{visibilityCopy[review.visibility].label}</span>}{review.isFictionalDemo && <mark>非公式・架空のデモレビュー</mark>}</div></article>; })}</section>{!current && <div className="drawer-nudge">ログインすると、あなたの「ここ、うまい」も残せます。</div>}</div></aside></div>;
}

function AuthModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"login"|"signup">("login"); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { await api(`/api/auth/${mode}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(Object.fromEntries(form)) }); onDone(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  const demo = async () => { setBusy(true); try { await api("/api/auth/demo", { method:"POST" }); onDone(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <Modal title={mode === "login" ? "おかえりなさい。" : "食の地図をはじめる。"} onClose={onClose}><div className="auth-tabs"><button className={mode==="login"?"active":""} onClick={()=>setMode("login")}>ログイン</button><button className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>新規登録</button></div><form className="form-stack" onSubmit={submit}>{mode === "signup" && <label>表示名<input name="displayName" required maxLength={30} placeholder="例：タロウ" /></label>}<label>ユーザーID<input name="handle" required pattern="[a-z0-9_]{3,20}" placeholder="kokouma_user" /></label><label>パスワード<input type="password" name="password" required minLength={8} placeholder="8文字以上" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-submit" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : mode === "login" ? "ログイン" : "アカウントを作る"}</button></form><div className="or"><span>OR</span></div><button className="demo-login" onClick={demo} disabled={busy}><Sparkles />ワンタップでデモを試す<small>投稿・Tier・フォローが実際に保存されます</small></button></Modal>;
}

function AddPlaceModal({ existingAreas, onClose, onDone }: { existingAreas: string[]; onClose: () => void; onDone: (id: string) => void }) {
  const [step,setStep]=useState(1); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [link,setLink]=useState(""); const [photo,setPhoto]=useState<File>(); const [draft,setDraft]=useState({ name:"",address:"",area:"",category:"",latitude:35.7122,longitude:139.7947,googleMapsUrl:"",imageKey:"" });
  const [areaSuggestions,setAreaSuggestions]=useState<string[]>([]); const [areaStatus,setAreaStatus]=useState<"idle"|"loading"|"auto"|"manual"|"stale"|"error">("idle");
  const [reviewBody,setReviewBody]=useState(""); const [reviewRating,setReviewRating]=useState(5); const [reviewTier,setReviewTier]=useState<"S"|"A"|"B"|"C">("S"); const [reviewVisibility,setReviewVisibility]=useState<ReviewVisibility>("following");
  usePasteImage((file)=>setPhoto(file), step===3);
  const inferArea = async (latitude:number,longitude:number) => { setAreaStatus("loading"); try { const result=await api("/api/places/geocode",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({latitude,longitude})}); setAreaSuggestions(result.suggestions??[]); setDraft((d)=>({...d,area:result.area||d.area,address:d.address||result.address||""})); setAreaStatus("auto"); } catch { setAreaStatus("error"); } };
  const resolve = async (explicitLink?:string) => { const target=explicitLink??link; setBusy(true); setError(""); try { const result=await api("/api/places/resolve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:target})}); const latitude=result.latitude??35.7122; const longitude=result.longitude??139.7947; setDraft((d)=>({...d,name:result.name||d.name,latitude,longitude,googleMapsUrl:target})); setStep(2); if(result.latitude!=null&&result.longitude!=null) await inferArea(latitude,longitude); } catch(e){setError((e as Error).message);} finally{setBusy(false);} };
  const pasteFromClipboard = async () => { try { const text=(await navigator.clipboard.readText())?.trim(); if(!text){setError("クリップボードが空でした");return;} setLink(text); if(text.startsWith("http") && /maps\.app\.goo\.gl|goo\.gl|google\.com/.test(text)) await resolve(text); } catch { setError("貼り付けできませんでした。入力欄に長押しまたは⌘Vで貼り付けてください"); } };
  const save = async () => { setBusy(true); setError(""); try { let imageKey=""; if(photo){ const form=new FormData(); form.append("file",photo); const uploaded=await api("/api/upload",{method:"POST",body:form}); imageKey=uploaded.key; } const review=reviewBody.trim()?{body:reviewBody,rating:reviewRating,tier:reviewTier,visibility:reviewVisibility}:undefined; const result=await api("/api/places",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...draft,imageKey,review})}); onDone(result.id); }catch(e){setError((e as Error).message);}finally{setBusy(false);} };
  const pick=useCallback((lng:number,lat:number)=>{setDraft((d)=>({...d,longitude:lng,latitude:lat}));setAreaStatus("stale")},[]);
  const allAreaSuggestions=[...new Set([...areaSuggestions,...existingAreas])];
  return <Modal title="新しい一軒を地図へ。" onClose={onClose} wide><div className="steps"><span className={step>=1?"active":""}>1 <b>LINK</b></span><i/><span className={step>=2?"active":""}>2 <b>CHECK</b></span><i/><span className={step>=3?"active":""}>3 <b>PHOTO + NOTE</b></span></div>{step===1&&<div className="link-step"><a className="maps-launch" href="https://www.google.com/maps" target="_blank" rel="noreferrer"><MapPin/><span><b>Google Mapsを開く</b><small>お店を探して「共有」からリンクをコピー</small></span></a><div className="link-guide"><span>① Google Mapsでお店を探す</span><span>② 共有リンクをコピー</span><span>③ ここに戻って貼り付け</span></div><div className="link-input-row"><label className="big-input"><input autoFocus value={link} onChange={(e)=>setLink(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&link&&!busy)resolve()}} placeholder="https://maps.app.goo.gl/…"/><button onClick={()=>resolve()} disabled={busy||!link}>{busy?<LoaderCircle className="spin"/>:<ChevronRight/>}</button></label><button type="button" className="clipboard-paste" onClick={pasteFromClipboard} disabled={busy}><Share2/>クリップボードから貼り付け</button></div>{error&&<p className="form-error">{error}</p>}<small>リンクから位置を取得できない場合も、次の画面でピンを補正できます。</small></div>}{step===2&&<div className="check-grid"><div className="mini-map"><MapPanel places={[{...draft,id:"draft",createdBy:"",averageRating:0,reviewCount:0,isSeed:false}]} selected="draft" onSelect={()=>{}} onPick={pick} center={[draft.longitude,draft.latitude]}/><p><MapPin/>ピンを動かしたら右側で確定</p></div><div className="form-stack"><label>店名<input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="お店の名前"/></label><label>住所 <small className="optional-mark">任意</small><input value={draft.address} onChange={(e)=>setDraft({...draft,address:e.target.value})} placeholder="地図から自動入力・空欄でもOK"/></label><div className="area-field"><label><span className="area-label-row">エリア {areaStatus==="auto"&&<small>地図から自動</small>}</span><div className="area-input-row"><input value={draft.area} list="kokouma-area-suggestions" onChange={(e)=>{setDraft({...draft,area:e.target.value});setAreaStatus("manual")}} maxLength={40} placeholder="例：浅草"/><button type="button" onClick={()=>inferArea(draft.latitude,draft.longitude)} disabled={areaStatus==="loading"}>{areaStatus==="loading"?<LoaderCircle className="spin"/>:<Crosshair/>}{areaStatus==="stale"?"このピンで決定":"ピンから取得"}</button></div><datalist id="kokouma-area-suggestions">{allAreaSuggestions.map((value)=><option key={value} value={value}/>)}</datalist><span className={`area-help status-${areaStatus}`}>{areaStatus==="auto"?"地図のピンから推定しました。違う場合は修正できます。":areaStatus==="stale"?"ピンの位置が変わりました。エリアを取得し直してください。":areaStatus==="error"?"自動取得できませんでした。エリア名を直接入力してください。":"入力すると、登録済みのエリアも候補に出ます。"}</span></label></div><div className="genre-field"><span className="area-label-row">ジャンル</span><div className="genre-chips">{genrePresets.map((g)=><button type="button" key={g} aria-pressed={draft.category===g} className={draft.category===g?"active":""} onClick={()=>setDraft({...draft,category:draft.category===g?"":g})}>{g}</button>)}</div><input value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})} maxLength={30} placeholder="その他のジャンルを入力"/></div><button className="primary-submit" onClick={()=>setStep(3)} disabled={!draft.name||!draft.area.trim()||!draft.category.trim()}>写真へ進む<ChevronRight/></button></div></div>}{step===3&&<div className="photo-step"><div className="photo-review-grid"><label className="photo-drop" onDragOver={(e)=>e.preventDefault()} onDrop={async(e)=>{e.preventDefault();const file=e.dataTransfer.files?.[0];if(file)setPhoto(await prepareImage(file))}}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={async(e)=>{const file=e.target.files?.[0];if(file)setPhoto(await prepareImage(file))}}/>{photo?<><img src={URL.createObjectURL(photo)} alt="プレビュー" loading="lazy" decoding="async"/><span>写真を変更</span></>:<><Camera/><b>お店の空気が伝わる一枚</b><small>JPEG / PNG / WebP · 最大5MB · 任意</small><span className="paste-hint">⌘V / Ctrl+V で貼り付けOK</span></>}</label><section className="quick-review"><header><span>ONE-TAP MEMORY</span><h3>ついでにレビュー <small>任意</small></h3><p>ここで書けば、登録後にもう一度開く必要はありません。</p></header><div className="quick-review-score"><div><p>おすすめ度</p><Stars value={reviewRating} interactive onChange={setReviewRating}/></div><div><p>あなた的Tier</p><div className="compact-tier">{(["S","A","B","C"] as const).map((value)=><button type="button" key={value} className={reviewTier===value?"active":""} style={{"--tier":tierColors[value]} as React.CSSProperties} onClick={()=>setReviewTier(value)}>{value}</button>)}</div></div></div><label>ひとこと<textarea value={reviewBody} onChange={(event)=>setReviewBody(event.target.value)} maxLength={600} placeholder="また行きたい理由をひとこと。空欄なら店舗だけ登録します。"/><small>{reviewBody.length}/600</small></label><fieldset className="quick-audience"><legend>公開範囲</legend>{(Object.keys(visibilityCopy) as (keyof typeof visibilityCopy)[]).map((value)=><button type="button" key={value} className={reviewVisibility===value?"active":""} onClick={()=>setReviewVisibility(value)} aria-pressed={reviewVisibility===value}>{visibilityCopy[value].label}</button>)}</fieldset></section></div>{error&&<p className="form-error">{error}</p>}<div className="modal-footer"><button className="ghost-button" onClick={()=>setStep(2)}><ChevronLeft/>戻る</button><button className="primary-submit" onClick={save} disabled={busy||reviewBody.trim().length===1}>{busy?<LoaderCircle className="spin"/>:reviewBody.trim()?"お店とレビューを登録":"このお店だけ登録"}</button></div></div>}</Modal>;
}

function ReviewModal({ place,existing,existingTier,onClose,onDone,onDeleted }: { place:Place;existing?:Review;existingTier?:TierEntry["tier"];onClose:()=>void;onDone:()=>void;onDeleted:()=>void }) {
  const [rating,setRating]=useState(existing?.rating??5); const [body,setBody]=useState(existing?.body??""); const [tier,setTier]=useState<TierEntry["tier"]>(existingTier??"S"); const [visibility,setVisibility]=useState<ReviewVisibility>(existing?.visibility==="public"?"following":existing?.visibility??"following"); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [photo,setPhoto]=useState<File>(); const [removePhoto,setRemovePhoto]=useState(false); const photoInput=useRef<HTMLInputElement>(null);
  const [armDelete,setArmDelete]=useState(false); const armTimer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  usePasteImage((file)=>{setPhoto(file);setRemovePhoto(false)});
  const localPhotoUrl=useMemo(()=>photo?URL.createObjectURL(photo):"",[photo]); useEffect(()=>()=>{if(localPhotoUrl)URL.revokeObjectURL(localPhotoUrl)},[localPhotoUrl]); const photoUrl=localPhotoUrl||(existing?.imageKey&&!removePhoto?`/api/media/${existing.imageKey}`:"");
  useEffect(()=>()=>{if(armTimer.current)clearTimeout(armTimer.current)},[]);
  const disarmDelete=()=>{setArmDelete(false);if(armTimer.current){clearTimeout(armTimer.current);armTimer.current=undefined}};
  const submit=async()=>{setBusy(true);setError("");try{let imageKey=removePhoto?"":existing?.imageKey??"";if(photo){const form=new FormData();form.append("file",photo);const uploaded=await api("/api/upload",{method:"POST",body:form});imageKey=uploaded.key;}await api("/api/reviews",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({placeId:place.id,rating,body,tier,visibility,imageKey})});onDone();}catch(e){setError((e as Error).message);}finally{setBusy(false)}};
  const remove=async()=>{if(!armDelete){setArmDelete(true);armTimer.current=setTimeout(disarmDelete,4000);return}disarmDelete();setBusy(true);setError("");try{await api("/api/reviews",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({placeId:place.id})});onDeleted();}catch(e){setError((e as Error).message);}finally{setBusy(false)}};
  return <Modal title={existing?`${place.name}の記録を編集`:`${place.name}の記録`} onClose={onClose}><div className="review-form" onClickCapture={(event)=>{if(armDelete&&!(event.target as HTMLElement).closest(".danger-inline"))disarmDelete()}}><p>あなたの星</p><Stars value={rating} interactive onChange={setRating}/><div className="review-photo-editor"><label onDragOver={(event)=>event.preventDefault()} onDrop={async(event)=>{event.preventDefault();const file=event.dataTransfer.files?.[0];if(file){setPhoto(await prepareImage(file));setRemovePhoto(false)}}}><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={async(event)=>{const file=event.target.files?.[0];if(file){setPhoto(await prepareImage(file));setRemovePhoto(false)}}}/>{photoUrl?<img src={photoUrl} alt="レビュー写真のプレビュー" loading="lazy" decoding="async"/>:<><ImagePlus/><span><b>食べたもの・お店の写真</b><small>タップして追加 · 任意</small></span><span className="paste-hint">⌘V / Ctrl+V で貼り付けOK</span></>}</label>{photoUrl&&<div><button type="button" onClick={()=>photoInput.current?.click()}><Camera/>写真を変更</button><button type="button" className="remove-review-photo" onClick={()=>{setPhoto(undefined);setRemovePhoto(true)}}><Trash2/>写真を削除</button></div>}</div><label>ひとこと<textarea value={body} onChange={(e)=>setBody(e.target.value)} maxLength={600} placeholder="誰と、どんな日に行きたい？ 味だけでなく、あなたの記憶を。"/><small>{body.length}/600</small></label><div><p>あなた的Tier</p><div className="tier-picker">{(["S","A","B","C"] as const).map((t)=><button key={t} className={tier===t?"active":""} style={{"--tier":tierColors[t]} as React.CSSProperties} onClick={()=>setTier(t)}>{t}<small>TIER</small></button>)}</div></div><fieldset className="audience-picker"><legend>この記録を見せる人</legend>{(Object.keys(visibilityCopy) as (keyof typeof visibilityCopy)[]).map((value)=><button type="button" key={value} className={visibility===value?"active":""} onClick={()=>setVisibility(value)} aria-pressed={visibility===value}>{value === "following" ? <Heart /> : <Users />}<span><b>{visibilityCopy[value].label}</b><small>{visibilityCopy[value].detail}</small></span></button>)}<p><Users />対象外の人には、レビュー本文・星・件数を表示しません。</p></fieldset>{error&&<p className="form-error">{error}</p>}<button className="primary-submit" disabled={busy||body.trim().length<2} onClick={submit}>{busy?<LoaderCircle className="spin"/>:existing?"変更を保存":"レビューを残す"}</button>{existing&&!existing.isSeed&&<button type="button" className={`danger-inline ${armDelete?"armed":""}`} onClick={remove} aria-pressed={armDelete} disabled={busy}><Trash2/>{armDelete?"本当に削除?(Tierからも外れます)":"レビューを削除"}</button>}</div></Modal>;
}

function DeletePlaceModal({place,onClose,onDone}:{place:Place;onClose:()=>void;onDone:()=>void}){
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const remove=async()=>{setBusy(true);setError("");try{await api("/api/places",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:place.id})});onDone();}catch(e){setError((e as Error).message);setBusy(false)}};
  return <Modal title="このお店を削除しますか？" onClose={onClose}><div className="delete-place-confirm"><div><Trash2/><span><small>DELETE YOUR SPOT</small><b>{place.name}</b><p>お店と、このお店にひもづくレビュー・Tier・投稿写真が削除されます。この操作は取り消せません。</p></span></div>{error&&<p className="form-error">{error}</p>}<footer><button className="ghost-button" onClick={onClose} disabled={busy}>キャンセル</button><button className="danger-submit" onClick={remove} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Trash2/>}削除する</button></footer></div></Modal>
}

function TierView({data,current,lookups,onAuth,onMove,onSelectPlace,onSelectProduct}:{data:Bootstrap;current:User|null;lookups:Lookups;onAuth:()=>void;onMove:(placeId:string,tier:TierEntry["tier"])=>void;onSelectPlace:(id:string)=>void;onSelectProduct:(id:string)=>void}){
  const [drag,setDrag]=useState<string>();
  const user=current??data.users.find((u)=>u.handle==="yui_cafe")!;
  const entries=lookups.tiersByUser.get(user.id)??[];
  const productEntries=lookups.productReviewsByUser.get(user.id)??[];
  const tierNames: TierEntry["tier"][]=["S","A","B","C"];
  const descriptions=["絶対行く","かなり好き","また行く","気分次第"];
  const move=(placeId:string,tier:TierEntry["tier"])=>{
    if(!current){onAuth();return;}
    onMove(placeId,tier);
  };
  return <main className="tier-page">
    <header className="page-hero"><span className="eyebrow"><Trophy/> PERSONAL RANKING</span><h1>{current?"わたし":"ユイ"}の、また行きたい順。</h1><p>{current?"ドラッグ、または矢印で移動できます。":"ログイン前は友だちのTier表をプレビューしています。"}</p></header>
    <div className="tier-board">{tierNames.map((tier,tierIndex)=>{
      const rowEntries=entries.filter((entry)=>entry.tier===tier).sort((a,b)=>a.position-b.position);
      return <section key={tier} className={`tier-row tier-row-${tier}`} onDragOver={(event)=>event.preventDefault()} onDrop={()=>{if(drag)move(drag,tier)}}>
        <div className="tier-letter"><b>{tier}</b><small>{descriptions[tierIndex]}</small></div>
        <div className="tier-items">{rowEntries.map((entry)=>{
          const place=lookups.placesById.get(entry.placeId)!;
          const image=place.imageKey?`/api/media/${place.imageKey}`:place.imageUrl;
          return <article key={place.id} draggable={Boolean(current)&&!entry.isSeed} onDragStart={()=>setDrag(place.id)}>
            <button className="tier-place" onClick={()=>onSelectPlace(place.id)}><span style={{backgroundImage:`url(${image})`}}/><b>{place.name}</b><small>{place.area}</small></button>
            {current&&!entry.isSeed&&<div className="tier-move"><button disabled={tierIndex===0} onClick={()=>move(place.id,tierNames[tierIndex-1])}><ChevronLeft/></button><button disabled={tierIndex===3} onClick={()=>move(place.id,tierNames[tierIndex+1])}><ChevronRight/></button></div>}
          </article>})}
          {!rowEntries.length&&<div className="tier-empty">ここへお店をドロップ</div>}
        </div>
      </section>})}</div>
    <section className="product-tier-zone"><header><span className="eyebrow"><Sparkles/> LIMITED PRODUCT RANKING</span><h2>新作・期間限定 Tier</h2><p>チェーンの商品は、お店とは別のTierで記録します。</p></header><div className="product-tier-board">{tierNames.map((tier,tierIndex)=><div className={`product-tier-row product-tier-${tier}`} key={tier}><b>{tier}<small>{descriptions[tierIndex]}</small></b><div>{productEntries.filter((entry)=>entry.tier===tier).map((entry)=>{const product=lookups.productsById.get(entry.productId)!;const image=productImage(product,data.productReviews);return <button key={product.id} onClick={()=>onSelectProduct(product.id)}><span style={{backgroundImage:image?`url(${image})`:undefined}}/><em>{product.brandName}</em><strong>{product.name}</strong></button>})}{!productEntries.some((entry)=>entry.tier===tier)&&<small>まだ新作がありません</small>}</div></div>)}</div></section>
    {!current&&<button className="floating-cta" onClick={onAuth}><Sparkles/>自分のTier表を作る</button>}
  </main>;
}

function PeopleView({data,current,followed,lookups,selected,focused,onSelect,onExitFocus,onFollow,onQr,onScan,onSelectPlace}:{data:Bootstrap;current:User|null;followed:Set<string>;lookups:Lookups;selected?:User;focused:boolean;onSelect:(id:string)=>void;onExitFocus:()=>void;onFollow:(id:string)=>void;onQr:()=>void;onScan:()=>void;onSelectPlace:(id:string)=>void}){
  const [search,setSearch]=useState("");
  const followerIds=useMemo(()=>new Set(data.follows.filter((f)=>f.followingId===current?.id).map((f)=>f.followerId)),[data,current]);
  const people=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return data.users.filter((u)=>u.id!==current?.id).filter((u)=>!term||`${u.displayName}${u.handle}${u.bio}`.toLowerCase().includes(term)).map((u)=>({user:u,mutual:followed.has(u.id)&&followerIds.has(u.id),following:followed.has(u.id),reviewCount:lookups.reviewsByUser.get(u.id)?.length??0})).sort((a,b)=>(a.mutual===b.mutual?0:a.mutual?-1:1)||(a.following===b.following?0:a.following?-1:1)||b.reviewCount-a.reviewCount);
  },[data,current,search,followed,followerIds,lookups]);
  return <main className={`people-page ${focused?"profile-focus":""}`}><aside className="people-list"><header><div><span className="eyebrow"><Users/> YOUR PEOPLE</span><h1>誰の「うまい」を<br/>信じますか？</h1></div><div className="qr-actions"><button onClick={onScan}><QrCode/>QRを読む</button>{current&&<button onClick={onQr}><Share2/>自分のQR</button>}</div></header><label className="people-search"><Search/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="名前・IDで探す"/></label>{people.map(({user,mutual,following,reviewCount})=><button className={`person-row ${selected?.id===user.id?"active":""}`} key={user.id} onClick={()=>onSelect(user.id)}><Avatar user={user} size={52}/><span><b>{user.displayName}{user.isUnofficial&&<mark>非公式デモ</mark>}{mutual?<span className="person-badge person-badge-mutual">相互</span>:following?<span className="person-badge person-badge-following">フォロー中</span>:null}</b><small>@{user.handle} · {reviewCount}件</small><p>{user.bio}</p></span><ChevronRight/></button>)}{!people.length&&<p className="people-search-empty">見つかりませんでした</p>}</aside><section className="profile-preview">{focused&&selected&&<div className="friend-pass-intro"><span><QrCode/><small>QR FRIEND PASS</small><b>{selected.displayName}さんのプロフィール</b></span><button onClick={onExitFocus}><ChevronLeft/>友だち一覧</button></div>}{selected?<ProfileCard user={selected} data={data} lookups={lookups} followed={followed.has(selected.id)} mutual={followed.has(selected.id)&&followerIds.has(selected.id)} self={selected.id===current?.id} onFollow={()=>onFollow(selected.id)} onSelectPlace={onSelectPlace}/>:<div className="people-empty"><Users/><h2>友だちを選んでください</h2><p>その人のレビューとTier表が見られます。</p></div>}</section></main>;
}

function ProfileCard({user,data,lookups,followed,mutual,self,onFollow,onSelectPlace}:{user:User;data:Bootstrap;lookups:Lookups;followed:boolean;mutual?:boolean;self:boolean;onFollow:()=>void;onSelectPlace:(id:string)=>void}){const reviews=lookups.reviewsByUser.get(user.id)??[];const tiers=lookups.tiersByUser.get(user.id)??[];const followingCount=data.follows.filter((f)=>f.followerId===user.id).length;const followerCount=data.follows.filter((f)=>f.followingId===user.id).length;return <div className="profile-card"><div className="profile-cover" style={{"--avatar":user.avatarColor} as React.CSSProperties}><span>KOKO / {user.handle.toUpperCase()}</span></div><div className="profile-main"><Avatar user={user} size={88}/><div className="profile-name"><h2>{user.displayName}</h2><p>@{user.handle}</p>{user.isUnofficial&&<mark>非公式・本人とは関係のないデモアカウント</mark>}</div>{!self&&<button className={followed?"following":""} onClick={onFollow}>{followed?"フォロー中":"フォローする"}</button>}{!self&&mutual&&<span className="mutual-chip">相互フォロー</span>}<p className="profile-bio">{user.bio}</p><div className="profile-stats"><span><b>{reviews.length}</b>レビュー</span><span><b>{tiers.length}</b>Tier入り</span><span><b>{followingCount}</b>フォロー</span><span><b>{followerCount}</b>フォロワー</span></div><div className="mini-tier-board">{(["S","A","B","C"] as const).map((tier)=><div key={tier}><b style={{background:tierColors[tier]}}>{tier}</b><span>{tiers.filter((t)=>t.tier===tier).map((entry)=>{const place=lookups.placesById.get(entry.placeId)!;const image=place.imageKey?`/api/media/${place.imageKey}`:place.imageUrl;return <button type="button" key={place.id} aria-label={place.name} onClick={()=>onSelectPlace(place.id)} style={{backgroundImage:`url(${image})`}}/>})}</span></div>)}</div><section className="profile-reviews"><h3>{user.displayName}の記録 · {reviews.length}件</h3>{reviews.map((review)=>{const place=lookups.placesById.get(review.placeId)!;const image=place.imageKey?`/api/media/${place.imageKey}`:place.imageUrl;return <button type="button" key={review.id} onClick={()=>onSelectPlace(place.id)}><span style={{backgroundImage:`url(${image})`}}/><div><small>{place.area} · ★ {review.rating}</small><b>{place.name}</b><p>{review.body}</p></div></button>})}</section></div></div>;}

function ProfileView({user,data,lookups,onQr,onLogout,onSelectPlace}:{user:User;data:Bootstrap;lookups:Lookups;onQr:()=>void;onLogout:()=>void;onSelectPlace:(id:string)=>void}){
  const myReviews=lookups.reviewsByUser.get(user.id)??[];
  return <main className="own-profile"><div className="own-head"><ProfileCard user={user} data={data} lookups={lookups} followed={false} self onFollow={()=>{}} onSelectPlace={onSelectPlace}/><div className="own-tools"><button onClick={onQr}><QrCode/>友達追加QRを表示</button><button onClick={onLogout}>ログアウト</button></div></div><div className="my-picks"><span className="eyebrow">MY FOOD MEMORY</span><h2>わたしの記録</h2>{myReviews.length?<div className="my-pick-grid">{myReviews.map((review)=>{const place=lookups.placesById.get(review.placeId)!;const image=place.imageKey?`/api/media/${place.imageKey}`:place.imageUrl;return <button key={review.id} onClick={()=>onSelectPlace(place.id)}><span style={{backgroundImage:`url(${image})`}}/><b>{place.name}</b><small>★ {review.rating}</small></button>})}</div>:<div className="empty-state"><Star/><h3>最初のレビューを残しましょう。</h3><p>見つける画面からお店を選んでください。</p></div>}</div></main>;
}

function QrModal({user,onClose}:{user:User;onClose:()=>void}){const [url,setUrl]=useState("");useEffect(()=>setUrl(`${location.origin}/?profile=${user.handle}`),[user]);const share=async()=>{if(navigator.share)await navigator.share({title:`${user.displayName}のKOKOUMA`,text:"食の地図でつながろう",url});else{await navigator.clipboard.writeText(url)}};return <Modal title="QRで、食の地図を交換。" onClose={onClose}><div className="qr-card"><div className="qr-brand">KOKOUMA <span>FRIEND PASS</span></div><div className="qr-code">{url&&<QRCodeSVG value={url} size={220} level="H" bgColor="#f7f0e3" fgColor="#17130f"/>}</div><Avatar user={user} size={54}/><h3>{user.displayName}</h3><p>@{user.handle}</p><small>カメラで読み取るとプロフィールが開きます</small></div><button className="primary-submit" onClick={share}><Share2/>QRを共有</button></Modal>}

function ScanModal({onClose,onScanned}:{onClose:()=>void;onScanned:(handle:string)=>void}){const [status,setStatus]=useState("カメラを準備しています…");useEffect(()=>{let scanner:{stop:()=>Promise<void>;clear:()=>void}|undefined;let live=true;import("html5-qrcode").then(async({Html5Qrcode})=>{if(!live)return;const instance=new Html5Qrcode("qr-reader");scanner=instance;try{await instance.start({facingMode:"environment"},{fps:10,qrbox:{width:230,height:230}},(text)=>{try{const url=new URL(text);const handle=url.searchParams.get("profile");if(handle){instance.stop();onScanned(handle)}}catch{setStatus("KOKOUMAのQRではありません")}},()=>{});setStatus("QRコードを枠の中に入れてください")}catch{setStatus("カメラを使えません。スマホ標準カメラでも読み取れます。")}});return()=>{live=false;scanner?.stop().catch(()=>{}).finally(()=>scanner?.clear())}},[onScanned]);return <Modal title="友達のQRを読む" onClose={onClose}><div className="scanner-shell"><div id="qr-reader"/><div className="scan-corners"/><p>{status}</p></div></Modal>}
