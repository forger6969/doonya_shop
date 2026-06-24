import { useEffect, useState } from "react";
import { Search, X, ArrowLeft, ShoppingCart, Flame, Tag } from "lucide-react";
import { getGames, getCategories, getProducts, getTopProducts, getOnSaleProducts, searchCatalog, buyStars, getActiveBanners, type Banner } from "../api";
import { useLang } from "../i18n";
import ProductDetailSheet from "./ProductDetailSheet";

interface Variant { label: string; price: number }
interface PurchaseField { label: string; required: boolean }
interface Category { id: string; name: string }
interface Game { id: string; name: string; description: string; photo_id: string; banner_url?: string }
interface Product {
  id: string; name: string; description?: string; price: number;
  discounted_price?: number; discount_percent?: number;
  photo_id?: string; category_id?: string; category_name?: string;
  variants?: Variant[]; purchase_fields?: PurchaseField[];
  variant_label?: string; gameName?: string;
}

interface CardItem {
  id: string; name: string; price: number;
  discounted_price?: number; discount_percent?: number;
  photo_id?: string; purchase_fields?: PurchaseField[];
  variant_label?: string; category_id?: string;
  gameName?: string;
  raw: Product;
}

interface Props { onBuy: (product: Product) => void; onTopup: () => void }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PALETTES = [
  ["#22c55e","#16a34a"],["#16a34a","#14532d"],["#4ade80","#22c55e"],
  ["#86efac","#22c55e"],["#f97316","#ea580c"],["#fb923c","#f97316"],
  ["#22c55e","#0ea5e9"],["#0ea5e9","#22c55e"],["#3b82f6","#22c55e"],["#22c55e","#6366f1"],
];

function palette(id: string) {
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
}

function toCards(product: Product, gameName?: string): CardItem[] {
  if (product.variants && product.variants.length > 0) {
    return product.variants.map((v) => ({
      id: product.id, name: v.label, price: v.price,
      discounted_price: product.discount_percent
        ? Math.max(1, Math.floor(v.price * (100 - product.discount_percent) / 100)) : undefined,
      discount_percent: product.discount_percent,
      photo_id: product.photo_id, purchase_fields: product.purchase_fields,
      variant_label: v.label, category_id: product.category_id,
      gameName: gameName ?? product.gameName,
      raw: product,
    }));
  }
  return [{
    id: product.id, name: product.name, price: product.price,
    discounted_price: product.discounted_price, discount_percent: product.discount_percent,
    photo_id: product.photo_id, purchase_fields: product.purchase_fields,
    category_id: product.category_id,
    gameName: gameName ?? product.gameName,
    raw: product,
  }];
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function GameIcon({ game, size }: { game: Game; size: "sm" | "md" | "lg" }) {
  const [g1, g2] = palette(game.id);
  const cls = size === "sm" ? "w-11 h-11 rounded-[14px] text-base"
    : size === "md" ? "w-14 h-14 rounded-[18px] text-lg"
    : "w-[72px] h-[72px] rounded-[22px] text-2xl";
  if (game.photo_id) {
    return <div className={`${cls} overflow-hidden flex-shrink-0`}>
      <img src={game.photo_id} className="w-full h-full object-cover" alt={game.name} />
    </div>;
  }
  return (
    <div className={`${cls} flex items-center justify-center font-black flex-shrink-0`}
      style={{ background: `linear-gradient(145deg,${g1},${g2})`, boxShadow: `0 4px 16px ${g1}40` }}>
      <span className="text-white">{initials(game.name)}</span>
    </div>
  );
}

// ─── ListingCard — playerok marketplace style ─────────────────────────────────

function ListingCard({ item, onBuy, onDetail }: {
  item: CardItem; onBuy: () => void; onDetail: () => void;
}) {
  const { t } = useLang();
  const [g1, g2] = palette(item.id + (item.variant_label || ""));
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col active:opacity-80 cursor-pointer"
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border-card)" }}
      onClick={onDetail}>
      {/* Square photo */}
      <div className="w-full flex-shrink-0 overflow-hidden relative"
        style={{ aspectRatio: "1/1", background: item.photo_id ? "#111" : `linear-gradient(145deg,${g1},${g2})` }}>
        {item.photo_id
          ? <img src={item.photo_id} className="w-full h-full object-cover" alt={item.name} />
          : <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl font-black text-white/80">{initials(item.name)}</span>
            </div>}
        {/* Discount badge */}
        {item.discount_percent ? (
          <div className="absolute top-2 right-2 rounded-lg px-1.5 py-0.5" style={{ background: "#ef4444" }}>
            <span className="text-[9px] font-black text-white">−{item.discount_percent}%</span>
          </div>
        ) : null}
        {/* Game badge */}
        {item.gameName && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md"
            style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}>
            <span className="text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{item.gameName}</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-2.5 flex flex-col gap-2 flex-1">
        <p className="text-[12px] font-bold leading-tight line-clamp-2" style={{ color: "var(--text)" }}>{item.name}</p>
        <div className="flex items-end justify-between gap-1 mt-auto">
          <div className="flex flex-col gap-0">
            {item.discounted_price && item.discount_percent ? (
              <>
                <span className="text-[9px] leading-none line-through" style={{ color: "var(--text-muted)" }}>{item.price.toLocaleString()}</span>
                <span className="text-[14px] font-black leading-tight" style={{ color: "#22c55e" }}>{item.discounted_price.toLocaleString()}</span>
              </>
            ) : (
              <span className="text-[14px] font-black leading-tight" style={{ color: "#22c55e" }}>{item.price.toLocaleString()}</span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onBuy(); }}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white active:opacity-70 flex-shrink-0"
            style={{ background: "#22c55e" }}>
            {t.buy}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GameDetailProductCard (used inside GameDetailPage) ───────────────────────

function GameDetailProductCard({ item, onBuy, onDetail }: {
  item: CardItem; onBuy: () => void; onDetail: () => void;
}) {
  const { t } = useLang();
  const [g1, g2] = palette(item.id + (item.variant_label || ""));
  return (
    <div className="rounded-xl overflow-hidden flex flex-col active:opacity-80 relative"
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border-card)" }}
      onClick={onDetail}>
      {item.discount_percent ? (
        <div className="absolute top-1.5 right-1.5 bg-red-500 rounded-md px-1.5 py-0.5 z-10">
          <span className="text-[9px] font-black text-white">−{item.discount_percent}%</span>
        </div>
      ) : null}
      <div className="w-full flex-shrink-0 overflow-hidden"
        style={{ aspectRatio: "1/1", background: item.photo_id ? "#0a0a14" : `linear-gradient(145deg,${g1},${g2})` }}>
        {item.photo_id
          ? <img src={item.photo_id} className="w-full h-full object-cover object-center" alt={item.name} />
          : <div className="w-full h-full flex items-center justify-center">
              <span className="text-xl font-black text-white/80">{initials(item.name)}</span>
            </div>}
      </div>
      <div className="p-2 pb-1 flex-1">
        <p className="text-[12px] font-bold leading-snug pr-5" style={{ color: "var(--text)" }}>{item.name}</p>
        {item.raw.description && !item.variant_label && (
          <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "var(--text-dim)" }}>{item.raw.description}</p>
        )}
      </div>
      <div className="px-2 pb-2 flex items-center justify-between gap-1.5">
        {item.discounted_price && item.discount_percent ? (
          <div className="flex flex-col gap-0">
            <span className="text-[9px] text-white/30 line-through leading-none">{item.price.toLocaleString()}</span>
            <span className="text-[10px] font-black leading-none" style={{ color: "#22c55e" }}>{item.discounted_price.toLocaleString()}</span>
          </div>
        ) : (
          <span className="text-[10px] font-black" style={{ color: "#22c55e" }}>{item.price.toLocaleString()}</span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onBuy(); }}
          className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold text-white active:opacity-70 flex-shrink-0"
          style={{ background: "#22c55e" }}>
          <ShoppingCart className="w-2.5 h-2.5" /> {t.buy}
        </button>
      </div>
    </div>
  );
}

// ─── GameFilterChips ──────────────────────────────────────────────────────────

function GameFilterChips({ games, selected, onSelect }: {
  games: Game[]; selected: Game | null; onSelect: (g: Game | null) => void;
}) {
  const { t } = useLang();
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5"
      style={{ background: "var(--header-bg)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <button onClick={() => onSelect(null)}
          className="flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all active:scale-95"
          style={selected === null
            ? { background: "#22c55e", color: "#fff", boxShadow: "0 2px 10px rgba(34,197,94,0.30)" }
            : { background: "var(--bg-surface)", color: "var(--text-dim)", border: "1px solid var(--border-card)" }}>
          {t.allGames}
        </button>
        {games.map((g) => {
          const [c1, c2] = palette(g.id);
          const isActive = selected?.id === g.id;
          return (
            <button key={g.id} onClick={() => onSelect(g)}
              className="flex-shrink-0 flex items-center gap-1.5 pl-1 pr-3.5 py-1.5 rounded-full text-[13px] font-bold transition-all active:scale-95"
              style={isActive
                ? { background: "#22c55e", color: "#fff", boxShadow: "0 2px 10px rgba(34,197,94,0.30)" }
                : { background: "var(--bg-surface)", color: "var(--text-dim)", border: "1px solid var(--border-card)" }}>
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={g.photo_id ? undefined : { background: `linear-gradient(145deg,${c1},${c2})` }}>
                {g.photo_id
                  ? <img src={g.photo_id} className="w-full h-full object-cover" alt={g.name} />
                  : <span className="text-[8px] font-black text-white">{initials(g.name)[0]}</span>}
              </div>
              <span className="truncate max-w-[80px]">{g.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Promo strip ─────────────────────────────────────────────────────────────

function PromoStrip({ onTopup }: { onTopup: () => void }) {
  const { t } = useLang();
  return (
    <button onClick={onTopup} className="flex items-center justify-between p-3.5 rounded-2xl w-full active:opacity-80"
      style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.16)" }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "rgba(34,197,94,0.15)" }}>💰</div>
        <div className="text-left">
          <p className="text-sm font-black" style={{ color: "var(--text)" }}>{t.topUpBalance}</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t.bannerSub1}</p>
        </div>
      </div>
      <span className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
        style={{ background: "#22c55e" }}>{t.topUpNow} →</span>
    </button>
  );
}

// ─── Game detail — sticky category tabs + grouped products ────────────────────

function GameDetailPage({ game, onBack, onBuy, onDetail }: {
  game: Game; onBack: () => void;
  onBuy: (product: Product) => void; onDetail: (product: Product) => void;
}) {
  const { t } = useLang();
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<Record<string, CardItem[]>>({});
  const [uncategorized, setUncategorized] = useState<CardItem[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [g1, g2] = palette(game.id);

  useEffect(() => {
    Promise.all([getCategories(game.id), getProducts(game.id)]).then(([cats, products]: [Category[], Product[]]) => {
      setCategories(cats);
      const grouped: Record<string, CardItem[]> = {};
      const uncats: CardItem[] = [];
      for (const p of products) {
        const cards = toCards(p);
        if (p.category_id && cats.some((c) => c.id === p.category_id)) {
          grouped[p.category_id] = [...(grouped[p.category_id] ?? []), ...cards];
        } else {
          uncats.push(...cards);
        }
      }
      setProductsByCategory(grouped);
      setUncategorized(uncats);
      if (cats.length > 0) setActiveTab(cats[0].id);
      setLoading(false);
    });
  }, [game.id]);

  const visibleItems = activeTab
    ? (productsByCategory[activeTab] ?? [])
    : uncategorized;

  const totalCards = Object.values(productsByCategory).reduce((n, arr) => n + arr.length, 0) + uncategorized.length;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header banner */}
      <div className="relative flex-shrink-0 overflow-hidden"
        style={{
          height: game.banner_url ? 160 : 128,
          background: game.banner_url ? "transparent" : `linear-gradient(135deg,${g1}cc,${g2}cc)`,
        }}>
        {game.banner_url && (
          <>
            <img src={game.banner_url} className="absolute inset-0 w-full h-full object-cover" alt={game.name} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.10) 50%, transparent 100%)" }} />
          </>
        )}
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <div className="flex items-end gap-3">
            <GameIcon game={game} size="lg" />
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-white font-black text-xl leading-tight tracking-tight">{game.name}</p>
              {game.description && (
                <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "rgba(240,242,250,0.70)" }}>{game.description}</p>
              )}
            </div>
          </div>
        </div>
        <button onClick={onBack}
          className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center active:opacity-70"
          style={{ background: "rgba(0,0,0,0.35)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Sticky category tabs */}
      {categories.length > 0 && (
        <div className="sticky top-0 z-10 border-b"
          style={{ background: "var(--header-bg)", backdropFilter: "blur(16px)", borderColor: "var(--border)" }}>
          <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveTab(cat.id)}
                className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all active:scale-95"
                style={activeTab === cat.id
                  ? { background: "#22c55e", color: "#fff", boxShadow: "0 4px 16px rgba(34,197,94,0.30)" }
                  : { background: "var(--bg-raised)", color: "var(--text-dim)", border: "1px solid var(--border-card)" }}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22c55e", borderTopColor: "transparent" }} />
          </div>
        ) : totalCards === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14" style={{ color: "var(--text-muted)" }}>
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">{t.comingSoon}</p>
          </div>
        ) : (
          <div>
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14" style={{ color: "var(--text-muted)" }}>
                <ShoppingCart className="w-10 h-10" />
                <p className="text-sm">{t.comingSoon}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {visibleItems.map((item, i) => (
                  <GameDetailProductCard
                    key={`${item.id}-${item.variant_label || i}`}
                    item={item}
                    onBuy={() => onBuy({ ...item.raw, gameName: game.name, variant_label: item.variant_label })}
                    onDetail={() => onDetail({ ...item.raw, gameName: game.name, variant_label: item.variant_label })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search results ───────────────────────────────────────────────────────────

function SearchResults({ query, onGameSelect, onBuy, onDetail }: {
  query: string;
  onGameSelect: (g: Game) => void;
  onBuy: (p: Product) => void;
  onDetail: (p: Product) => void;
}) {
  const { t } = useLang();
  const [results, setResults] = useState<{ games: Game[]; categories: { id: string; game_id: string; name: string }[]; products: Product[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      searchCatalog(query).then((r) => { setResults(r); setLoading(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (loading) {
    return <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22c55e", borderTopColor: "transparent" }} />
    </div>;
  }
  if (!results) return null;

  const hasAny = results.games.length + results.categories.length + results.products.length > 0;
  if (!hasAny) {
    return (
      <div className="flex flex-col items-center gap-3 py-14" style={{ color: "var(--text-muted)" }}>
        <Search className="w-8 h-8" />
        <p className="text-sm">{t.nothingFound} «{query}»</p>
      </div>
    );
  }

  const productCards = results.products.flatMap((p) => toCards(p));

  return (
    <div className="flex flex-col gap-6">
      {results.games.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.1em] mb-3"
            style={{ color: "var(--text-muted)" }}>{t.gamesTitle}</p>
          <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {results.games.map((g) => {
              const [c1, c2] = palette(g.id);
              return (
                <button key={g.id} onClick={() => onGameSelect(g)}
                  className="flex flex-col items-center gap-2 flex-shrink-0 active:opacity-70 w-[72px]">
                  <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden"
                    style={g.photo_id
                      ? { border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }
                      : { background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 8px 24px ${c1}50` }}>
                    {g.photo_id
                      ? <img src={g.photo_id} className="w-full h-full object-cover" alt={g.name} />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl font-black text-white">{initials(g.name)}</span>
                        </div>}
                  </div>
                  <p className="text-[11px] font-semibold text-center leading-tight w-full truncate"
                    style={{ color: "var(--text-dim)" }}>{g.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {results.categories.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.1em] mb-3"
            style={{ color: "var(--text-muted)" }}>{t.categories}</p>
          <div className="flex flex-wrap gap-2">
            {results.categories.map((c) => (
              <span key={c.id} className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)", color: "#22c55e" }}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {productCards.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.1em] mb-3"
            style={{ color: "var(--text-muted)" }}>{t.productsSubtitle}</p>
          <div className="grid grid-cols-2 gap-3">
            {productCards.map((item, i) => (
              <ListingCard
                key={`sr-${item.id}-${item.variant_label || i}`}
                item={item}
                onBuy={() => onBuy({ ...item.raw, variant_label: item.variant_label })}
                onDetail={() => onDetail({ ...item.raw, variant_label: item.variant_label })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stars section ────────────────────────────────────────────────────────────

const STAR_PRICE = 225;
const STAR_MIN = 50;

function StarsSection({ balance, onSuccess }: { balance?: number; onSuccess?: () => void }) {
  const { t } = useLang();
  const [username, setUsername] = useState("");
  const [count, setCount] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const stars = typeof count === "number" && count >= STAR_MIN ? count : 0;
  const total = stars * STAR_PRICE;
  const notEnough = balance !== undefined && total > 0 && balance < total;

  const handleBuy = async () => {
    if (!username.trim()) { setError(t.enterTgLogin); return; }
    if (!stars) { setError(`${t.topupMinError.split(' ')[0]} ${STAR_MIN}`); return; }
    if (notEnough) { setError(t.insufficientBalance); return; }
    setError("");
    setLoading(true);
    try {
      await buyStars(username.trim().replace(/^@/, ""), stars);
      setDone(true);
      onSuccess?.();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || t.orderError);
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: "linear-gradient(135deg,#1a1a2e,#16213e)", border: "1px solid rgba(251,191,36,0.20)" }}>
      <span className="text-2xl">✅</span>
      <div className="flex-1 min-w-0">
        <p className="font-black text-white text-[13px]">{t.orderPlaced}</p>
        <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.40)" }}>
          ⭐ @{username.replace(/^@/, "")}
        </p>
      </div>
      <button className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-amber-400 active:opacity-70 flex-shrink-0"
        style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.20)" }}
        onClick={() => { setDone(false); setUsername(""); setCount(""); }}>
        +
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(135deg,#1a1040,#0d1527)", border: "1px solid rgba(251,191,36,0.18)" }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
          style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>⭐</div>
        <p className="font-black text-white text-[13px] flex-1">Telegram Stars</p>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>1⭐ = {STAR_PRICE.toLocaleString()} {t.sumLabel}</p>
      </div>

      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-2"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.30)" }}>@</span>
          <input
            className="flex-1 bg-transparent outline-none text-[13px] font-semibold text-white placeholder:text-white/20"
            placeholder="telegram_username"
            value={username.replace(/^@/, "")}
            onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        {(() => {
          const isBelowMin = typeof count === "number" && count > 0 && count < STAR_MIN;
          return (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors"
              style={{
                background: isBelowMin ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.05)",
                border: isBelowMin ? "1px solid rgba(239,68,68,0.55)" : "1px solid rgba(255,255,255,0.09)",
              }}>
              <span className="text-[11px]" style={{ color: isBelowMin ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.30)" }}>⭐</span>
              <input
                type="number" min={STAR_MIN}
                className="flex-1 bg-transparent outline-none text-[13px] font-black text-white placeholder:text-white/20"
                placeholder={`min. ${STAR_MIN}`}
                value={count === "" ? "" : count}
                onChange={(e) => { const v = e.target.value; setCount(v === "" ? "" : Math.max(0, parseInt(v) || 0)); }}
              />
              {stars > 0 && (
                <span className="text-[12px] font-black flex-shrink-0" style={{ color: "#22c55e" }}>
                  {total.toLocaleString()} {t.sumLabel}
                </span>
              )}
              {isBelowMin && (
                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "rgba(239,68,68,0.8)" }}>
                  min. {STAR_MIN}
                </span>
              )}
            </div>
          );
        })()}

        {error && <p className="text-red-400 text-[11px] font-semibold -mt-1">{error}</p>}

        <button onClick={handleBuy} disabled={loading || !stars || !username.trim()}
          className="w-full py-2.5 rounded-xl font-black text-[13px] text-white transition-all active:scale-[0.98]"
          style={loading || !stars || !username.trim()
            ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)", cursor: "not-allowed" }
            : { background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 3px 14px rgba(245,158,11,0.30)" }
          }>
          {loading ? t.placing : `⭐ ${t.buy}${total > 0 ? " · " + total.toLocaleString() + " " + t.sumLabel : ""}`}
        </button>

        {notEnough && <p className="text-[11px] text-center -mt-1" style={{ color: "rgba(255,255,255,0.28)" }}>{t.insufficientBalance}</p>}
      </div>
    </div>
  );
}

// ─── Feed sections ────────────────────────────────────────────────────────────

function HotFeed({ onBuy, onDetail }: { onBuy: (p: Product) => void; onDetail: (p: Product) => void }) {
  const { t } = useLang();
  const [cards, setCards] = useState<CardItem[]>([]);
  useEffect(() => { getTopProducts().then((ps: Product[]) => setCards(ps.flatMap((p) => toCards(p)))); }, []);
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <p className="text-[13px] font-black" style={{ color: "var(--text)" }}>{t.topSales}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.slice(0, 6).map((item, i) => (
          <ListingCard key={`hot-${item.id}-${i}`} item={item}
            onBuy={() => onBuy({ ...item.raw, variant_label: item.variant_label })}
            onDetail={() => onDetail({ ...item.raw, variant_label: item.variant_label })} />
        ))}
      </div>
    </div>
  );
}

function SaleFeed({ onBuy, onDetail }: { onBuy: (p: Product) => void; onDetail: (p: Product) => void }) {
  const { t } = useLang();
  const [cards, setCards] = useState<CardItem[]>([]);
  useEffect(() => { getOnSaleProducts().then((ps: Product[]) => setCards(ps.flatMap((p) => toCards(p)))); }, []);
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-red-400" />
        <p className="text-[13px] font-black" style={{ color: "var(--text)" }}>{t.discounts}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.slice(0, 8).map((item, i) => (
          <ListingCard key={`sale-${item.id}-${i}`} item={item}
            onBuy={() => onBuy({ ...item.raw, variant_label: item.variant_label })}
            onDetail={() => onDetail({ ...item.raw, variant_label: item.variant_label })} />
        ))}
      </div>
    </div>
  );
}

// ─── Admin banners ────────────────────────────────────────────────────────────

const GRADIENT_MAP: Record<string, string> = {
  pink:   "#22c55e",
  gold:   "linear-gradient(135deg,#F59E0B,#EF4444)",
  blue:   "linear-gradient(135deg,#3B82F6,#06B6D4)",
  green:  "linear-gradient(135deg,#10B981,#3B82F6)",
  orange: "linear-gradient(135deg,#F97316,#EAB308)",
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CatalogPage({ onBuy, onTopup }: Props) {
  const { t } = useLang();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [query, setQuery] = useState("");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [userBalance, setUserBalance] = useState<number | undefined>(undefined);
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    import("../api").then(({ getMe }) => getMe().then((u) => setUserBalance(u.balance)).catch(() => {}));
  }, []);

  useEffect(() => {
    getGames().then((g) => { setGames(g); setLoading(false); });
    getActiveBanners().then(setBanners).catch(() => {});
  }, []);

  // Game chip selected → show GameDetailPage
  if (selectedGame) {
    return (
      <>
        <GameDetailPage
          game={selectedGame}
          onBack={() => setSelectedGame(null)}
          onBuy={onBuy}
          onDetail={(p) => setDetailProduct(p)}
        />
        {detailProduct && (
          <ProductDetailSheet
            product={detailProduct}
            onClose={() => setDetailProduct(null)}
            onBuy={(p) => { onBuy(p); setDetailProduct(null); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 pb-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#22c55e" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchGames}
            className="w-full rounded-2xl pl-10 pr-9 py-3 text-sm outline-none transition-colors s-input"
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(34,197,94,0.40)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4" style={{ color: "rgba(240,242,250,0.3)" }} />
            </button>
          )}
        </div>

        {/* Game filter chips — sticky */}
        {!loading && games.length > 0 && (
          <GameFilterChips games={games} selected={null} onSelect={(g) => { if (g) setSelectedGame(g); }} />
        )}

        {/* Search results or feed */}
        {query ? (
          <SearchResults
            query={query}
            onGameSelect={(g) => { setQuery(""); setSelectedGame(g); }}
            onBuy={onBuy}
            onDetail={(p) => setDetailProduct(p)}
          />
        ) : (
          <>
            {/* Admin banners */}
            {banners.length > 0 && (
              <div className="flex flex-col gap-2">
                {banners.map((b) => (
                  <div key={b.id} className="rounded-2xl p-4 flex items-center gap-3"
                    style={{
                      background: GRADIENT_MAP[b.gradient] ?? GRADIENT_MAP.pink,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                    }}>
                    <span className="text-3xl flex-shrink-0">{b.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm">{b.title}</p>
                      {b.subtitle && <p className="text-white/75 text-[12px] mt-0.5">{b.subtitle}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Promo topup strip */}
            <PromoStrip onTopup={onTopup} />

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "#22c55e", borderTopColor: "transparent" }} />
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* ⭐ Stars — наверху, как просил nyx */}
                <StarsSection balance={userBalance} onSuccess={() => import("../api").then(({ getMe }) => getMe().then((u) => setUserBalance(u.balance)).catch(() => {}))} />

                {/* 🔥 Hot products feed */}
                <HotFeed onBuy={onBuy} onDetail={(p) => setDetailProduct(p)} />

                {/* 🏷️ Sale feed */}
                <SaleFeed onBuy={onBuy} onDetail={(p) => setDetailProduct(p)} />
              </div>
            )}
          </>
        )}
      </div>

      {detailProduct && (
        <ProductDetailSheet
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onBuy={(p) => { onBuy(p); setDetailProduct(null); }}
        />
      )}
    </>
  );
}
