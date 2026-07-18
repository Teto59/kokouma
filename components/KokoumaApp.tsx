"use client";

import maplibregl, { Map as MapLibreMap, Marker } from "maplibre-gl";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Compass, Crosshair, Heart, List, LoaderCircle, LogIn, Map as MapIcon, MapPin, Plus, QrCode, Search, Share2, Sparkles, Star, Trophy, UserRound, Users, X } from "lucide-react";

type User = { id: string; handle: string; displayName: string; bio: string; avatarColor: string; isSeed: boolean; isUnofficial: boolean };
type Place = { id: string; name: string; address: string; area: string; category: string; latitude: number; longitude: number; googleMapsUrl: string; imageUrl?: string; imageKey?: string; createdBy: string; averageRating: number; reviewCount: number; isSeed: boolean };
type ReviewVisibility = "public" | "following" | "mutual";
type Review = { id: string; userId: string; placeId: string; rating: number; body: string; imageKey?: string; displayName: string; handle: string; avatarColor: string; visibility: ReviewVisibility; isSeed: boolean; isFictionalDemo: boolean; isUnofficial: boolean };
type TierEntry = { userId: string; placeId: string; tier: "S" | "A" | "B" | "C"; position: number; isSeed: boolean };
type Follow = { followerId: string; followingId: string };
type Bootstrap = { currentUser: User | null; users: User[]; places: Place[]; reviews: Review[]; tiers: TierEntry[]; follows: Follow[] };
type View = "discover" | "tier" | "people" | "profile";

const ASAKUSA: [number, number] = [139.7947, 35.7122];
const tierColors = { S: "#ff5a36", A: "#ffb238", B: "#b9da45", C: "#9ca59f" } as const;
const visibilityCopy: Record<ReviewVisibility, { label: string; detail: string }> = {
  public: { label: "みんな", detail: "ログインしていない人にも公開" },
  following: { label: "フォロー中", detail: "あなたがフォローしている人だけ" },
  mutual: { label: "相互だけ", detail: "お互いにフォローしている人だけ" },
};

async function api(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(path, options);
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "通信に失敗しました");
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
  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = new maplibregl.Map({
      container: container.current,
      center: center ?? ASAKUSA,
      zoom: 13.2,
      style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
      attributionControl: { compact: true },
    });
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current.on("click", (event) => onPick?.(event.lngLat.lng, event.lngLat.lat));
    return () => { map.current?.remove(); map.current = null; };
  }, [onPick]);
  useEffect(() => {
    markers.current.forEach((marker) => marker.remove());
    markers.current = places.map((place) => {
      const el = document.createElement("button");
      el.className = `map-marker ${selected === place.id ? "active" : ""}`;
      el.innerHTML = `<span>${place.averageRating >= 4.8 ? "★" : "●"}</span>`;
      el.setAttribute("aria-label", place.name);
      el.onclick = () => onSelect(place.id);
      return new maplibregl.Marker({ element: el }).setLngLat([place.longitude, place.latitude]).addTo(map.current!);
    });
  }, [places, selected, onSelect]);
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
  const [area, setArea] = useState("すべて");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [mobileMap, setMobileMap] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [profileId, setProfileId] = useState<string>();
  const [modal, setModal] = useState<"auth" | "add" | "review" | "qr" | "scan" | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>(ASAKUSA);
  const refresh = useCallback(async () => { setLoading(true); try { setData(await api("/api/bootstrap")); } catch (e) { setToast(e instanceof Error ? e.message : "読み込めませんでした"); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); const handle = new URLSearchParams(location.search).get("profile"); if (handle) { setTimeout(() => setProfileId(handle), 0); setView("people"); } }, [refresh]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 3200); return () => clearTimeout(timer); }, [toast]);

  const current = data?.currentUser ?? null;
  const followed = useMemo(() => new Set((data?.follows ?? []).filter((f) => f.followerId === current?.id).map((f) => f.followingId)), [data, current]);
  const areas = ["すべて", "浅草", "渋谷", "新宿", "二子玉川", "神田"];
  const filteredPlaces = useMemo(() => (data?.places ?? []).filter((place) => {
    const text = `${place.name}${place.area}${place.category}${place.address}`.toLowerCase();
    const authors = (data?.reviews ?? []).filter((r) => r.placeId === place.id).map((r) => r.userId);
    return (!query || text.includes(query.toLowerCase())) && (area === "すべて" || place.area === area) && (!followingOnly || authors.some((id) => followed.has(id)));
  }), [data, query, area, followingOnly, followed]);
  const selectedPlace = data?.places.find((p) => p.id === selectedPlaceId);
  const selectedProfile = data?.users.find((u) => u.id === profileId || u.handle === profileId) ?? (view === "profile" ? current ?? undefined : undefined);

  const requireAuth = (next: typeof modal) => { if (!current) setModal("auth"); else setModal(next); };
  const showToast = (message: string) => setToast(message);
  const locate = () => navigator.geolocation?.getCurrentPosition((pos) => { setMapCenter([pos.coords.longitude, pos.coords.latitude]); showToast("現在地へ移動しました"); }, () => { setMapCenter(ASAKUSA); showToast("位置情報を使えないため浅草を表示します"); }, { timeout: 7000 });

  if (!data && loading) return <main className="loading-screen"><div className="brand-mark"><span>K</span></div><p>友だちの「うまい」を集めています</p><LoaderCircle className="spin" /></main>;

  return <div className="app-shell">
    <header className="topbar">
      <button className="logo" onClick={() => { setView("discover"); setSelectedPlaceId(undefined); }}><span>K</span><b>KOKOUMA</b><small>FRIENDS’ FOOD MAP</small></button>
      <nav className="desktop-nav" aria-label="メインナビ">
        <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><Compass />見つける</button>
        <button className={view === "tier" ? "active" : ""} onClick={() => setView("tier")}><Trophy />Tier表</button>
        <button className={view === "people" ? "active" : ""} onClick={() => setView("people")}><Users />友だち</button>
      </nav>
      <div className="top-actions"><button className="add-button" onClick={() => requireAuth("add")}><Plus />お店を登録</button>{current ? <button className="user-chip" aria-label={`${current.displayName}のプロフィール`} onClick={() => { setView("profile"); setProfileId(current.id); }}><Avatar user={current} size={34} /><span>{current.displayName}</span></button> : <button className="login-button" onClick={() => setModal("auth")}><LogIn />ログイン</button>}</div>
    </header>

    {view === "discover" && <main className="discover-layout">
      <section className={`feed-panel ${mobileMap ? "mobile-hidden" : ""}`}>
        <div className="intro-block reveal-1"><div><span className="eyebrow"><Sparkles size={14} /> NEAR YOU, FROM YOUR PEOPLE</span><h1>星より、<br/><em>あの人</em>のひとこと。</h1></div><p>広告ではなく、知っている人の「また行きたい」だけを地図にしました。</p></div>
        <div className="search-zone reveal-2"><label className="search-box"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="店名・料理・街で探す" /></label><button className="locate-button" onClick={locate}><Crosshair />現在地</button></div>
        <div className="filters reveal-2">{areas.map((name) => <button key={name} className={area === name ? "active" : ""} onClick={() => { setArea(name); const place = data?.places.find((p) => p.area === name); if (place) setMapCenter([place.longitude, place.latitude]); }}>{name}</button>)}<button className={followingOnly ? "active friend-filter" : "friend-filter"} onClick={() => current ? setFollowingOnly(!followingOnly) : setModal("auth")}><Heart size={14} fill={followingOnly ? "currentColor" : "none"} />フォロー中</button></div>
        <div className="result-heading"><p><b>{filteredPlaces.length}</b> SPOTS FOUND</p><span>{area === "すべて" ? "東京の友だちセレクト" : `${area}のおすすめ`}</span></div>
        <div className="place-grid">{filteredPlaces.map((place, index) => {
          const placeReviews = (data?.reviews ?? []).filter((r) => r.placeId === place.id);
          const friendReview = placeReviews.find((r) => followed.has(r.userId)) ?? placeReviews[0];
          const reviewer = data?.users.find((u) => u.id === friendReview?.userId);
          const tier = data?.tiers.find((t) => t.placeId === place.id && t.userId === friendReview?.userId);
          return <article key={place.id} className="place-card" style={{ animationDelay: `${Math.min(index * 55, 440)}ms` }} onClick={() => setSelectedPlaceId(place.id)}>
            <div className="place-photo">{place.imageUrl || place.imageKey ? <img src={place.imageKey ? `/api/media/${place.imageKey}` : place.imageUrl} alt="" /> : <div className="photo-fallback">KOKO<br/>UMA</div>}<span className="area-stamp">{place.area}</span>{tier && <span className={`tier-badge tier-${tier.tier}`}>{tier.tier}<small>TIER</small></span>}<span className="rating-pill"><Star size={13} fill="currentColor" />{Number(place.averageRating).toFixed(1)}</span></div>
            <div className="place-copy"><div className="category-line"><span>{place.category}</span><i />{place.reviewCount} REVIEWS</div><h2>{place.name}</h2>{friendReview && reviewer && <div className="friend-quote"><Avatar user={reviewer} size={34} /><p><b>{reviewer.displayName}</b>「{friendReview.body.length > 58 ? `${friendReview.body.slice(0,58)}…` : friendReview.body}」</p></div>}<div className="card-foot"><span><MapPin size={14}/>{place.address.replace(/^東京都[^区]+区/, "")}</span><button aria-label={`${place.name}を見る`}><ChevronRight /></button></div></div>
          </article>;
        })}{!filteredPlaces.length && <div className="empty-state"><Search /><h3>その条件では、まだ一軒もありません。</h3><p>最初の「ここ、うまい」を登録して地図を育てましょう。</p><button onClick={() => requireAuth("add")}><Plus />お店を登録</button></div>}</div>
      </section>
      <aside className={`map-panel ${!mobileMap ? "mobile-hidden-map" : ""}`}><MapPanel places={filteredPlaces} selected={selectedPlaceId} onSelect={setSelectedPlaceId} center={mapCenter} /><div className="map-head"><div><small>LIVE FRIEND MAP</small><b>{area === "すべて" ? "TOKYO" : area.toUpperCase()}</b></div><button onClick={locate}><Crosshair /> MY LOCATION</button></div>{selectedPlace && <button className="map-preview" onClick={() => setSelectedPlaceId(selectedPlace.id)}><span style={{ backgroundImage: `url(${selectedPlace.imageUrl})` }} /><div><small>{selectedPlace.area} · {selectedPlace.category}</small><b>{selectedPlace.name}</b><em>★ {Number(selectedPlace.averageRating).toFixed(1)}</em></div><ChevronRight /></button>}</aside>
      <div className="mobile-view-switch"><button className={!mobileMap ? "active" : ""} onClick={() => setMobileMap(false)}><List />リスト</button><button className={mobileMap ? "active" : ""} onClick={() => setMobileMap(true)}><MapIcon />地図</button></div>
    </main>}

    {view === "tier" && <TierView data={data!} current={current} onAuth={() => setModal("auth")} onChanged={refresh} onSelectPlace={setSelectedPlaceId} toast={showToast} />}
    {view === "people" && <PeopleView data={data!} current={current} followed={followed} selected={selectedProfile} onSelect={setProfileId} onFollow={async (id) => { if (!current) return setModal("auth"); try { await api("/api/follows", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({userId:id}) }); await refresh(); } catch(e) { showToast((e as Error).message); } }} onQr={() => requireAuth("qr")} onScan={() => setModal("scan")} />}
    {view === "profile" && current && <ProfileView user={current} data={data!} onQr={() => setModal("qr")} onLogout={async () => { await api("/api/auth/logout", { method:"POST" }); await refresh(); setView("discover"); }} onSelectPlace={setSelectedPlaceId} />}
    {view === "profile" && !current && <section className="auth-required"><UserRound /><h1>あなたの食の地図を作ろう。</h1><p>レビュー、Tier表、友だちのフォローはログインすると使えます。</p><button onClick={() => setModal("auth")}>ログイン / 新規登録</button></section>}

    <nav className="mobile-nav"><button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><Compass /><span>見つける</span></button><button className={view === "tier" ? "active" : ""} onClick={() => setView("tier")}><Trophy /><span>Tier</span></button><button className="nav-add" onClick={() => requireAuth("add")}><Plus /></button><button className={view === "people" ? "active" : ""} onClick={() => setView("people")}><Users /><span>友だち</span></button><button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}><UserRound /><span>自分</span></button></nav>

    {selectedPlace && <PlaceDrawer place={selectedPlace} data={data!} current={current} onClose={() => setSelectedPlaceId(undefined)} onReview={() => requireAuth("review")} onProfile={(id) => { setProfileId(id); setView("people"); setSelectedPlaceId(undefined); }} />}
    {modal === "auth" && <AuthModal onClose={() => setModal(null)} onDone={async () => { setModal(null); await refresh(); showToast("KOKOUMAへようこそ！"); }} />}
    {modal === "add" && current && <AddPlaceModal onClose={() => setModal(null)} onDone={async (id) => { setModal(null); await refresh(); setSelectedPlaceId(id); showToast("地図に新しい一軒を追加しました"); }} />}
    {modal === "review" && selectedPlace && current && <ReviewModal place={selectedPlace} onClose={() => setModal(null)} onDone={async () => { setModal(null); await refresh(); showToast("レビューを記録しました"); }} />}
    {modal === "qr" && current && <QrModal user={current} onClose={() => setModal(null)} />}
    {modal === "scan" && <ScanModal onClose={() => setModal(null)} onScanned={(handle) => { setModal(null); setProfileId(handle); setView("people"); }} />}
    {toast && <div className="toast"><Sparkles />{toast}</div>}
  </div>;
}

function PlaceDrawer({ place, data, current, onClose, onReview, onProfile }: { place: Place; data: Bootstrap; current: User | null; onClose: () => void; onReview: () => void; onProfile: (id: string) => void }) {
  const reviews = data.reviews.filter((r) => r.placeId === place.id);
  return <div className="drawer-backdrop" onMouseDown={(e) => e.currentTarget === e.target && onClose()}><aside className="place-drawer"><button className="drawer-close" onClick={onClose} aria-label="閉じる"><X /></button><div className="drawer-hero">{place.imageUrl || place.imageKey ? <img src={place.imageKey ? `/api/media/${place.imageKey}` : place.imageUrl} alt={place.name} /> : <div className="photo-fallback">KOKOUMA</div>}<div className="drawer-gradient"/><span>{place.area} · {place.category}</span></div><div className="drawer-content"><div className="place-title"><div><small>FRIENDS RECOMMEND</small><h2>{place.name}</h2><p><MapPin />{place.address}</p></div><div className="big-score"><b>{Number(place.averageRating).toFixed(1)}</b><Stars value={Math.round(place.averageRating)} /><small>{place.reviewCount} reviews</small></div></div><div className="drawer-actions"><a href={place.googleMapsUrl} target="_blank" rel="noreferrer"><MapIcon />Google Mapsで開く</a><button onClick={onReview}><Star />レビューを書く</button></div><section className="review-section"><div className="section-label"><span>FRIENDS’ NOTES</span><b>{reviews.length}</b></div>{reviews.map((review) => { const user = data.users.find((u) => u.id === review.userId)!; const tier = data.tiers.find((t) => t.userId === review.userId && t.placeId === place.id); return <article className="review-card" key={review.id}><button className="reviewer" onClick={() => onProfile(user.id)}><Avatar user={user} /><span><b>{user.displayName}</b><small>@{user.handle}</small></span>{tier && <em className={`mini-tier tier-${tier.tier}`}>{tier.tier}</em>}</button><Stars value={review.rating}/><p>{review.body}</p><div className="review-labels">{review.visibility !== "public" && <span className={`audience-badge audience-${review.visibility}`}>{review.visibility === "mutual" ? <Users /> : <Heart />}{visibilityCopy[review.visibility].label}</span>}{review.isFictionalDemo && <mark>非公式・架空のデモレビュー</mark>}</div></article>; })}</section>{!current && <div className="drawer-nudge">ログインすると、あなたの「ここ、うまい」も残せます。</div>}</div></aside></div>;
}

function AuthModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"login"|"signup">("login"); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { await api(`/api/auth/${mode}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(Object.fromEntries(form)) }); onDone(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  const demo = async () => { setBusy(true); try { await api("/api/auth/demo", { method:"POST" }); onDone(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <Modal title={mode === "login" ? "おかえりなさい。" : "食の地図をはじめる。"} onClose={onClose}><div className="auth-tabs"><button className={mode==="login"?"active":""} onClick={()=>setMode("login")}>ログイン</button><button className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>新規登録</button></div><form className="form-stack" onSubmit={submit}>{mode === "signup" && <label>表示名<input name="displayName" required maxLength={30} placeholder="例：タロウ" /></label>}<label>ユーザーID<input name="handle" required pattern="[a-z0-9_]{3,20}" placeholder="kokouma_user" /></label><label>パスワード<input type="password" name="password" required minLength={8} placeholder="8文字以上" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-submit" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : mode === "login" ? "ログイン" : "アカウントを作る"}</button></form><div className="or"><span>OR</span></div><button className="demo-login" onClick={demo} disabled={busy}><Sparkles />ワンタップでデモを試す<small>投稿・Tier・フォローが実際に保存されます</small></button></Modal>;
}

function AddPlaceModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [step,setStep]=useState(1); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [link,setLink]=useState(""); const [photo,setPhoto]=useState<File>(); const [draft,setDraft]=useState({ name:"",address:"",area:"浅草",category:"カフェ",latitude:35.7122,longitude:139.7947,googleMapsUrl:"",imageKey:"" });
  const resolve = async () => { setBusy(true); setError(""); try { const result=await api("/api/places/resolve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:link})}); setDraft((d)=>({...d,name:result.name||d.name,latitude:result.latitude??d.latitude,longitude:result.longitude??d.longitude,googleMapsUrl:link})); setStep(2); } catch(e){setError((e as Error).message);} finally{setBusy(false);} };
  const save = async () => { setBusy(true); setError(""); try { let imageKey=""; if(photo){ const form=new FormData(); form.append("file",photo); const uploaded=await api("/api/upload",{method:"POST",body:form}); imageKey=uploaded.key; } const result=await api("/api/places",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...draft,imageKey})}); onDone(result.id); }catch(e){setError((e as Error).message);}finally{setBusy(false);} };
  const pick=useCallback((lng:number,lat:number)=>setDraft((d)=>({...d,longitude:lng,latitude:lat})),[]);
  return <Modal title="新しい一軒を地図へ。" onClose={onClose} wide><div className="steps"><span className={step>=1?"active":""}>1 <b>LINK</b></span><i/><span className={step>=2?"active":""}>2 <b>CHECK</b></span><i/><span className={step>=3?"active":""}>3 <b>PHOTO</b></span></div>{step===1&&<div className="link-step"><div className="maps-link-visual"><MapPin/><span>Google Maps</span><i>SHARE LINK</i></div><p>Google Mapsでお店を開き、「共有」からコピーしたリンクを貼ってください。</p><label className="big-input"><input value={link} onChange={(e)=>setLink(e.target.value)} placeholder="https://maps.app.goo.gl/…"/><button onClick={resolve} disabled={busy||!link}>{busy?<LoaderCircle className="spin"/>:<ChevronRight/>}</button></label>{error&&<p className="form-error">{error}</p>}<small>リンクから位置を取得できない場合も、次の画面でピンを補正できます。</small></div>}{step===2&&<div className="check-grid"><div className="mini-map"><MapPanel places={[{...draft,id:"draft",createdBy:"",averageRating:0,reviewCount:0,isSeed:false}]} selected="draft" onSelect={()=>{}} onPick={pick} center={[draft.longitude,draft.latitude]}/><p><MapPin/>地図をクリックしてピンを補正</p></div><div className="form-stack"><label>店名<input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="お店の名前"/></label><label>住所<input value={draft.address} onChange={(e)=>setDraft({...draft,address:e.target.value})} placeholder="東京都台東区…"/></label><div className="form-row"><label>エリア<select value={draft.area} onChange={(e)=>setDraft({...draft,area:e.target.value})}>{["浅草","渋谷","新宿","二子玉川","神田","その他"].map(x=><option key={x}>{x}</option>)}</select></label><label>ジャンル<input value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})}/></label></div><button className="primary-submit" onClick={()=>setStep(3)} disabled={!draft.name||!draft.address}>写真へ進む<ChevronRight/></button></div></div>}{step===3&&<div className="photo-step"><label className="photo-drop"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>setPhoto(e.target.files?.[0])}/>{photo?<><img src={URL.createObjectURL(photo)} alt="プレビュー"/><span>写真を変更</span></>:<><Camera/><b>お店の空気が伝わる一枚</b><small>JPEG / PNG / WebP · 最大5MB</small></>}</label>{error&&<p className="form-error">{error}</p>}<div className="modal-footer"><button className="ghost-button" onClick={()=>setStep(2)}><ChevronLeft/>戻る</button><button className="primary-submit" onClick={save} disabled={busy}>{busy?<LoaderCircle className="spin"/>:"このお店を登録"}</button></div></div>}</Modal>;
}

function ReviewModal({ place,onClose,onDone }: { place:Place;onClose:()=>void;onDone:()=>void }) {
  const [rating,setRating]=useState(5); const [body,setBody]=useState(""); const [tier,setTier]=useState("S"); const [visibility,setVisibility]=useState<ReviewVisibility>("public"); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const submit=async()=>{setBusy(true);setError("");try{await api("/api/reviews",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({placeId:place.id,rating,body,tier,visibility})});onDone();}catch(e){setError((e as Error).message);}finally{setBusy(false)}};
  return <Modal title={`${place.name}の記録`} onClose={onClose}><div className="review-form"><p>あなたの星</p><Stars value={rating} interactive onChange={setRating}/><label>ひとこと<textarea value={body} onChange={(e)=>setBody(e.target.value)} maxLength={600} placeholder="誰と、どんな日に行きたい？ 味だけでなく、あなたの記憶を。"/><small>{body.length}/600</small></label><div><p>あなた的Tier</p><div className="tier-picker">{(["S","A","B","C"] as const).map((t)=><button key={t} className={tier===t?"active":""} style={{"--tier":tierColors[t]} as React.CSSProperties} onClick={()=>setTier(t)}>{t}<small>TIER</small></button>)}</div></div><fieldset className="audience-picker"><legend>この記録を見せる人</legend>{(Object.keys(visibilityCopy) as ReviewVisibility[]).map((value)=><button type="button" key={value} className={visibility===value?"active":""} onClick={()=>setVisibility(value)} aria-pressed={visibility===value}>{value === "public" ? <Share2 /> : value === "following" ? <Heart /> : <Users />}<span><b>{visibilityCopy[value].label}</b><small>{visibilityCopy[value].detail}</small></span></button>)}<p><Users />対象外の人には、レビュー本文・星・件数を表示しません。</p></fieldset>{error&&<p className="form-error">{error}</p>}<button className="primary-submit" disabled={busy||body.trim().length<2} onClick={submit}>{busy?<LoaderCircle className="spin"/>:"レビューを残す"}</button></div></Modal>;
}

function TierView({data,current,onAuth,onChanged,onSelectPlace,toast}:{data:Bootstrap;current:User|null;onAuth:()=>void;onChanged:()=>void;onSelectPlace:(id:string)=>void;toast:(s:string)=>void}){
  const [drag,setDrag]=useState<string>();
  const user=current??data.users.find((u)=>u.handle==="yui_cafe")!;
  const entries=data.tiers.filter((entry)=>entry.userId===user.id);
  const tierNames: TierEntry["tier"][]=["S","A","B","C"];
  const descriptions=["絶対行く","かなり好き","また行く","気分次第"];
  const move=async(placeId:string,tier:string)=>{
    if(!current){onAuth();return;}
    try{
      await api("/api/tiers",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({placeId,tier})});
      onChanged();
      toast(`${tier} Tierへ移動しました`);
    }catch(e){toast((e as Error).message)}
  };
  return <main className="tier-page">
    <header className="page-hero"><span className="eyebrow"><Trophy/> PERSONAL RANKING</span><h1>{current?"わたし":"ユイ"}の、また行きたい順。</h1><p>{current?"ドラッグ、または矢印で移動できます。":"ログイン前は友だちのTier表をプレビューしています。"}</p></header>
    <div className="tier-board">{tierNames.map((tier,tierIndex)=>{
      const rowEntries=entries.filter((entry)=>entry.tier===tier).sort((a,b)=>a.position-b.position);
      return <section key={tier} className={`tier-row tier-row-${tier}`} onDragOver={(event)=>event.preventDefault()} onDrop={()=>{if(drag)move(drag,tier)}}>
        <div className="tier-letter"><b>{tier}</b><small>{descriptions[tierIndex]}</small></div>
        <div className="tier-items">{rowEntries.map((entry)=>{
          const place=data.places.find((candidate)=>candidate.id===entry.placeId)!;
          const image=place.imageKey?`/api/media/${place.imageKey}`:place.imageUrl;
          return <article key={place.id} draggable={Boolean(current)&&!entry.isSeed} onDragStart={()=>setDrag(place.id)}>
            <button className="tier-place" onClick={()=>onSelectPlace(place.id)}><span style={{backgroundImage:`url(${image})`}}/><b>{place.name}</b><small>{place.area}</small></button>
            {current&&!entry.isSeed&&<div className="tier-move"><button disabled={tierIndex===0} onClick={()=>move(place.id,tierNames[tierIndex-1])}><ChevronLeft/></button><button disabled={tierIndex===3} onClick={()=>move(place.id,tierNames[tierIndex+1])}><ChevronRight/></button></div>}
          </article>})}
          {!rowEntries.length&&<div className="tier-empty">ここへお店をドロップ</div>}
        </div>
      </section>})}</div>
    {!current&&<button className="floating-cta" onClick={onAuth}><Sparkles/>自分のTier表を作る</button>}
  </main>;
}

function PeopleView({data,current,followed,selected,onSelect,onFollow,onQr,onScan}:{data:Bootstrap;current:User|null;followed:Set<string>;selected?:User;onSelect:(id:string)=>void;onFollow:(id:string)=>void;onQr:()=>void;onScan:()=>void}){
  return <main className="people-page"><aside className="people-list"><header><div><span className="eyebrow"><Users/> YOUR PEOPLE</span><h1>誰の「うまい」を<br/>信じますか？</h1></div><div className="qr-actions"><button onClick={onScan}><QrCode/>QRを読む</button>{current&&<button onClick={onQr}><Share2/>自分のQR</button>}</div></header>{data.users.filter((u)=>u.id!==current?.id).map((user)=><button className={`person-row ${selected?.id===user.id?"active":""}`} key={user.id} onClick={()=>onSelect(user.id)}><Avatar user={user} size={52}/><span><b>{user.displayName}{user.isUnofficial&&<mark>非公式デモ</mark>}</b><small>@{user.handle}</small><p>{user.bio}</p></span><ChevronRight/></button>)}</aside><section className="profile-preview">{selected?<ProfileCard user={selected} data={data} followed={followed.has(selected.id)} self={selected.id===current?.id} onFollow={()=>onFollow(selected.id)}/>:<div className="people-empty"><Users/><h2>友だちを選んでください</h2><p>その人のレビューとTier表が見られます。</p></div>}</section></main>;
}

function ProfileCard({user,data,followed,self,onFollow}:{user:User;data:Bootstrap;followed:boolean;self:boolean;onFollow:()=>void}){const reviews=data.reviews.filter((r)=>r.userId===user.id);const tiers=data.tiers.filter((t)=>t.userId===user.id);return <div className="profile-card"><div className="profile-cover" style={{"--avatar":user.avatarColor} as React.CSSProperties}><span>KOKO / {user.handle.toUpperCase()}</span></div><div className="profile-main"><Avatar user={user} size={88}/><div className="profile-name"><h2>{user.displayName}</h2><p>@{user.handle}</p>{user.isUnofficial&&<mark>非公式・本人とは関係のないデモアカウント</mark>}</div>{!self&&<button className={followed?"following":""} onClick={onFollow}>{followed?"フォロー中":"フォローする"}</button>}<p className="profile-bio">{user.bio}</p><div className="profile-stats"><span><b>{reviews.length}</b>レビュー</span><span><b>{tiers.length}</b>Tier入り</span><span><b>{data.follows.filter((f)=>f.followerId===user.id).length}</b>フォロー</span></div><div className="mini-tier-board">{(["S","A","B","C"] as const).map((tier)=><div key={tier}><b style={{background:tierColors[tier]}}>{tier}</b><span>{tiers.filter((t)=>t.tier===tier).map((entry)=>{const place=data.places.find((p)=>p.id===entry.placeId)!;return <i key={place.id} title={place.name} style={{backgroundImage:`url(${place.imageUrl})`}}/>})}</span></div>)}</div><section className="profile-reviews"><h3>RECENT PICKS</h3>{reviews.slice(0,4).map((review)=>{const place=data.places.find((p)=>p.id===review.placeId)!;return <article key={review.id}><span style={{backgroundImage:`url(${place.imageUrl})`}}/><div><small>{place.area} · ★ {review.rating}</small><b>{place.name}</b><p>{review.body}</p></div></article>})}</section></div></div>}

function ProfileView({user,data,onQr,onLogout,onSelectPlace}:{user:User;data:Bootstrap;onQr:()=>void;onLogout:()=>void;onSelectPlace:(id:string)=>void}){return <main className="own-profile"><div className="own-head"><ProfileCard user={user} data={data} followed={false} self onFollow={()=>{}}/><div className="own-tools"><button onClick={onQr}><QrCode/>友達追加QRを表示</button><button onClick={onLogout}>ログアウト</button></div></div><div className="my-picks"><span className="eyebrow">MY FOOD MEMORY</span><h2>わたしの記録</h2>{data.reviews.filter((r)=>r.userId===user.id).length?<div className="my-pick-grid">{data.reviews.filter((r)=>r.userId===user.id).map((review)=>{const place=data.places.find((p)=>p.id===review.placeId)!;return <button key={review.id} onClick={()=>onSelectPlace(place.id)}><span style={{backgroundImage:`url(${place.imageUrl})`}}/><b>{place.name}</b><small>★ {review.rating}</small></button>})}</div>:<div className="empty-state"><Star/><h3>最初のレビューを残しましょう。</h3><p>見つける画面からお店を選んでください。</p></div>}</div></main>}

function QrModal({user,onClose}:{user:User;onClose:()=>void}){const [url,setUrl]=useState("");useEffect(()=>setUrl(`${location.origin}/?profile=${user.handle}`),[user]);const share=async()=>{if(navigator.share)await navigator.share({title:`${user.displayName}のKOKOUMA`,text:"食の地図でつながろう",url});else{await navigator.clipboard.writeText(url)}};return <Modal title="QRで、食の地図を交換。" onClose={onClose}><div className="qr-card"><div className="qr-brand">KOKOUMA <span>FRIEND PASS</span></div><div className="qr-code">{url&&<QRCodeSVG value={url} size={220} level="H" bgColor="#f7f0e3" fgColor="#17130f"/>}</div><Avatar user={user} size={54}/><h3>{user.displayName}</h3><p>@{user.handle}</p><small>カメラで読み取るとプロフィールが開きます</small></div><button className="primary-submit" onClick={share}><Share2/>QRを共有</button></Modal>}

function ScanModal({onClose,onScanned}:{onClose:()=>void;onScanned:(handle:string)=>void}){const [status,setStatus]=useState("カメラを準備しています…");useEffect(()=>{let scanner:{stop:()=>Promise<void>;clear:()=>void}|undefined;let live=true;import("html5-qrcode").then(async({Html5Qrcode})=>{if(!live)return;const instance=new Html5Qrcode("qr-reader");scanner=instance;try{await instance.start({facingMode:"environment"},{fps:10,qrbox:{width:230,height:230}},(text)=>{try{const url=new URL(text);const handle=url.searchParams.get("profile");if(handle){instance.stop();onScanned(handle)}}catch{setStatus("KOKOUMAのQRではありません")}},()=>{});setStatus("QRコードを枠の中に入れてください")}catch{setStatus("カメラを使えません。スマホ標準カメラでも読み取れます。")}});return()=>{live=false;scanner?.stop().catch(()=>{}).finally(()=>scanner?.clear())}},[onScanned]);return <Modal title="友達のQRを読む" onClose={onClose}><div className="scanner-shell"><div id="qr-reader"/><div className="scan-corners"/><p>{status}</p></div></Modal>}
