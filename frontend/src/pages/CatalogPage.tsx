import { useEffect, useState } from "react";
import { Search, X, ArrowLeft, ShoppingCart, Zap, Flame, Tag } from "lucide-react";
import { getGames, getCategories, getProducts, getTopProducts, getOnSaleProducts, searchCatalog } from "../api";
import { useLang } from "../i18n";
import ProductDetailSheet from "./ProductDetailSheet";

interface Variant { label: string; price: number }
interface PurchaseField { label: string; required: boolean }
interface Category { id: string; name: string }
interface Game { id: string; name: string; description: string; photo_id: string }
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
  raw: Product;
}

interface Props { onBuy: (product: Product) => void; onTopup: () => void }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PALETTES = [
  ["#EC4899","#A855F7"],["#A855F7","#6366F1"],["#F472B6","#EC4899"],
  ["#C084FC","#818CF8"],["#FB7185","#EC4899"],["#E879F9","#A855F7"],
  ["#F9A8D4","#C084FC"],["#EC4899","#8B5CF6"],["#A78BFA","#EC4899"],["#F0ABFC","#A855F7"],
];
const BANNER_GRADS = [["#4c1d95","#1e1b4b"],["#0c4a6e","#064e3b"],["#7c2d12","#1c1917"]];

function palette(id: string) {
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
}

function toCards(product: Product): CardItem[] {
  if (product.variants && product.variants.length > 0) {
    return product.variants.map((v) => ({
      id: product.id, name: v.label, price: v.price,
      discounted_price: product.discount_percent
        ? Math.max(1, Math.floor(v.price * (100 - product.discount_percent) / 100)) : undefined,
      discount_percent: product.discount_percent,
      photo_id: product.photo_id, purchase_fields: product.purchase_fields,
      variant_label: v.label, category_id: product.category_id, raw: product,
    }));
  }
  return [{
    id: product.id, name: product.name, price: product.price,
    discounted_price: product.discounted_price, discount_percent: product.discount_percent,
    photo_id: product.photo_id, purchase_fields: product.purchase_fields,
    category_id: product.category_id, raw: product,
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

function DiscountBadge({ pct }: { pct: number }) {
  return (
    <div className="absolute top-1.5 right-1.5 bg-red-500 rounded-md px-1.5 py-0.5">
      <span className="text-[9px] font-black text-white">−{pct}%</span>
    </div>
  );
}

function CardPrice({ item }: { item: CardItem }) {
  if (item.discounted_price && item.discount_percent) {
    return (
      <div className="flex flex-col gap-0">
        <span className="text-[9px] text-white/30 line-through leading-none">{item.price.toLocaleString()}</span>
        <span className="text-[10px] font-black leading-none" style={{ color: "#EC4899" }}>{item.discounted_price.toLocaleString()}</span>
      </div>
    );
  }
  return <span className="text-[10px] font-black" style={{ color: "#FBBF24" }}>{item.price.toLocaleString()}</span>;
}

function VariantCard({ item, gameId, onBuy, onDetail }: {
  item: CardItem; gameId: string; onBuy: () => void; onDetail: () => void;
}) {
  const { t } = useLang();
  const [g1, g2] = palette(gameId + item.id + (item.variant_label || ""));
  return (
    <div className="flex-shrink-0 w-[128px] rounded-2xl overflow-hidden flex flex-col active:opacity-80 relative"
      style={{ background: "#100D1E", border: "1px solid rgba(168,85,247,0.15)" }}
      onClick={onDetail}>
      {item.discount_percent ? <DiscountBadge pct={item.discount_percent} /> : null}
      <div className="h-[70px] flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={item.photo_id ? undefined : { background: `linear-gradient(145deg,${g1},${g2})` }}>
        {item.photo_id
          ? <img src={item.photo_id} className="w-full h-full object-cover" alt={item.name} />
          : <span className="text-xl font-black text-white/80">{initials(item.name)}</span>}
      </div>
      <div className="p-2.5 flex flex-col gap-1.5 flex-1">
        <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">{item.name}</p>
        <div className="flex items-center justify-between mt-auto pt-1">
          <CardPrice item={item} />
          <button onClick={(e) => { e.stopPropagation(); onBuy(); }}
            className="px-2 py-1 rounded-lg text-[10px] font-bold text-white active:opacity-70"
            style={{ background: "linear-gradient(135deg,#EC4899,#A855F7)" }}>
            {t.buy}
          </button>
        </div>
      </div>
    </div>
  );
}

function GameDetailProductCard({ item, onBuy, onDetail }: {
  item: CardItem; onBuy: () => void; onDetail: () => void;
}) {
  const { t } = useLang();
  const [g1, g2] = palette(item.id + (item.variant_label || ""));
  return (
    <div className="rounded-2xl overflow-hidden flex flex-row active:scale-[0.98] transition-transform relative"
      style={{ background: "#100D1E", border: "1px solid rgba(168,85,247,0.15)", minHeight: 100 }}
      onClick={onDetail}>

      {/* Image / art block — left side */}
      <div className="relative w-[110px] flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={item.photo_id ? undefined : { background: `linear-gradient(145deg,${g1}dd,${g2}dd)` }}>
        {item.photo_id
          ? <img src={item.photo_id} className="w-full h-full object-cover" alt={item.name} />
          : (
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <p className="text-white font-black text-center leading-tight text-sm">{item.name}</p>
            </div>
          )}
        {/* Gradient overlay right */}
        <div className="absolute inset-y-0 right-0 w-8"
          style={{ background: "linear-gradient(to right, transparent, #100D1E)" }} />
        {/* Discount badge */}
        {item.discount_percent ? (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-black text-white"
            style={{ background: "linear-gradient(135deg,#EC4899,#A855F7)" }}>
            -{item.discount_percent}%
          </div>
        ) : null}
      </div>

      {/* Info — right side */}
      <div className="flex-1 px-3 py-3 flex flex-col justify-between min-w-0">
        <p className="text-[14px] font-bold text-white leading-snug line-clamp-2">{item.name}</p>
        {item.raw.description && !item.variant_label && (
          <p className="text-[11px] mt-1 line-clamp-1" style={{ color: "rgba(245,240,255,0.35)" }}>
            {item.raw.description}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex flex-col">
            {item.discounted_price ? (
              <>
                <span className="text-[10px] line-through leading-none" style={{ color: "rgba(245,240,255,0.30)" }}>{item.price.toLocaleString()}</span>
                <span className="text-[15px] font-black leading-tight" style={{ color: "#FBBF24" }}>{item.discounted_price.toLocaleString()} сум</span>
              </>
            ) : (
              <span className="text-[15px] font-black" style={{ color: "#FBBF24" }}>{item.price.toLocaleString()} сум</span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onBuy(); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-black text-white active:opacity-70 flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#EC4899,#A855F7)", boxShadow: "0 2px 12px rgba(236,72,153,0.30)" }}>
            <ShoppingCart className="w-3.5 h-3.5" /> {t.buy}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function BannerCarousel({ onTopup }: { onTopup: () => void }) {
  const { t } = useLang();
  const [active, setActive] = useState(0);
  const banners = [
    { title: t.topUpBalance, sub: "Мгновенное пополнение через карту или банкомат", action: t.topUpNow, grad: BANNER_GRADS[0] },
    { title: t.fastDelivery, sub: "Заказы обрабатываются в течение минут", action: t.browseGames, grad: BANNER_GRADS[1] },
    { title: t.bestPrices, sub: "Официальные курсы без накрутки", action: t.shopNow, grad: BANNER_GRADS[2] },
  ];
  return (
    <div className="relative -mx-4">
      <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth))}>
        {banners.map((b, i) => (
          <button key={i} onClick={() => { if (i === 0) onTopup(); }}
            className="flex-shrink-0 w-full snap-center px-4 active:opacity-90">
            <div className="rounded-2xl overflow-hidden relative h-36"
              style={{
                background: `linear-gradient(135deg,${b.grad[0]},${b.grad[1]})`,
                border: "1px solid rgba(139,92,246,0.15)",
              }}>
              <div className="absolute inset-0 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(240,242,250,0.3)" }}>Doonya Shop</span>
                  </div>
                  <p className="text-white font-black text-[22px] leading-tight tracking-tight">{b.title}</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(240,242,250,0.45)" }}>{b.sub}</p>
                </div>
                <div className="flex items-center gap-1.5 w-fit px-4 py-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <span className="text-white text-[11px] font-bold">{b.action}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-2.5">
        {banners.map((_, i) => (
          <div key={i} className={`rounded-full transition-all ${active === i ? "w-4 h-1.5" : "w-1.5 h-1.5 bg-white/15"}`}
            style={active === i ? { background: "#EC4899" } : undefined} />
        ))}
      </div>
    </div>
  );
}

// ─── Home sections ────────────────────────────────────────────────────────────

function TopProductsSection({ onBuy, onDetail }: { onBuy: (p: Product) => void; onDetail: (p: Product) => void }) {
  const [cards, setCards] = useState<CardItem[]>([]);
  useEffect(() => { getTopProducts().then((ps: Product[]) => setCards(ps.flatMap(toCards))); }, []);
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <p className="text-sm font-black text-white">Топ продаж</p>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {cards.slice(0, 8).map((item, i) => (
          <VariantCard key={`top-${item.id}-${i}`} item={item} gameId={item.id}
            onBuy={() => onBuy({ ...item.raw, variant_label: item.variant_label })}
            onDetail={() => onDetail({ ...item.raw, variant_label: item.variant_label })} />
        ))}
      </div>
    </div>
  );
}

function OnSaleSection({ onBuy, onDetail }: { onBuy: (p: Product) => void; onDetail: (p: Product) => void }) {
  const [cards, setCards] = useState<CardItem[]>([]);
  useEffect(() => { getOnSaleProducts().then((ps: Product[]) => setCards(ps.flatMap(toCards))); }, []);
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-red-400" />
        <p className="text-sm font-black text-white">Скидки</p>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {cards.slice(0, 10).map((item, i) => (
          <VariantCard key={`sale-${item.id}-${i}`} item={item} gameId={item.id}
            onBuy={() => onBuy({ ...item.raw, variant_label: item.variant_label })}
            onDetail={() => onDetail({ ...item.raw, variant_label: item.variant_label })} />
        ))}
      </div>
    </div>
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
      <div className="relative h-32 flex-shrink-0"
        style={{ background: `linear-gradient(135deg,${g1}cc,${g2}cc)` }}>
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <div className="flex items-end gap-3">
            <GameIcon game={game} size="lg" />
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-white font-black text-xl leading-tight tracking-tight">{game.name}</p>
              {game.description && (
                <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "rgba(240,242,250,0.55)" }}>{game.description}</p>
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
        <div className="sticky top-0 z-10 border-b border-white/[0.04]"
          style={{ background: "rgba(8,5,16,0.95)", backdropFilter: "blur(16px)" }}>
          <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveTab(cat.id)}
                className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all active:scale-95"
                style={activeTab === cat.id
                  ? { background: "linear-gradient(135deg,#EC4899,#A855F7)", color: "#fff", boxShadow: "0 4px 16px rgba(236,72,153,0.35)" }
                  : { background: "#100D1E", color: "rgba(245,240,255,0.45)", border: "1px solid rgba(168,85,247,0.12)" }}>
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
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#EC4899", borderTopColor: "transparent" }} />
          </div>
        ) : totalCards === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14" style={{ color: "rgba(240,242,250,0.2)" }}>
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">{t.comingSoon}</p>
          </div>
        ) : (
          <div>
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14" style={{ color: "rgba(240,242,250,0.2)" }}>
                <ShoppingCart className="w-10 h-10" />
                <p className="text-sm">{t.comingSoon}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
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
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#EC4899", borderTopColor: "transparent" }} />
    </div>;
  }
  if (!results) return null;

  const hasAny = results.games.length + results.categories.length + results.products.length > 0;
  if (!hasAny) {
    return (
      <div className="flex flex-col items-center gap-3 py-14" style={{ color: "rgba(240,242,250,0.2)" }}>
        <Search className="w-8 h-8" />
        <p className="text-sm">Ничего не найдено по «{query}»</p>
      </div>
    );
  }

  const productCards = results.products.flatMap(toCards);

  return (
    <div className="flex flex-col gap-6">
      {results.games.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.1em] mb-3"
            style={{ color: "rgba(240,242,250,0.3)" }}>Игры</p>
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
                    style={{ color: "rgba(240,242,250,0.6)" }}>{g.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {results.categories.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.1em] mb-3"
            style={{ color: "rgba(240,242,250,0.3)" }}>Категории</p>
          <div className="flex flex-wrap gap-2">
            {results.categories.map((c) => (
              <span key={c.id} className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", color: "#A78BFA" }}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {productCards.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.1em] mb-3"
            style={{ color: "rgba(240,242,250,0.3)" }}>Товары</p>
          <div className="grid grid-cols-2 gap-3">
            {productCards.map((item, i) => (
              <GameDetailProductCard
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CatalogPage({ onBuy, onTopup }: Props) {
  const { t } = useLang();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Game | null>(null);
  const [query, setQuery] = useState("");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  useEffect(() => {
    getGames().then((g) => { setGames(g); setLoading(false); });
  }, []);

  if (selected) {
    return (
      <>
        <GameDetailPage
          game={selected}
          onBack={() => setSelected(null)}
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
      <div className="flex flex-col gap-5 pb-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#EC4899" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchGames}
            className="w-full rounded-2xl pl-10 pr-9 py-3 text-sm text-white placeholder-white/25 outline-none transition-colors"
            style={{
              background: "#100D1E",
              border: "1px solid rgba(168,85,247,0.15)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(236,72,153,0.40)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(168,85,247,0.15)"; }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4" style={{ color: "rgba(240,242,250,0.3)" }} />
            </button>
          )}
        </div>

        {/* Search results */}
        {query ? (
          <SearchResults
            query={query}
            onGameSelect={(g) => { setQuery(""); setSelected(g); }}
            onBuy={onBuy}
            onDetail={(p) => setDetailProduct(p)}
          />
        ) : (
          <>
            <BannerCarousel onTopup={onTopup} />

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "#EC4899", borderTopColor: "transparent" }} />
              </div>
            ) : (
              <div className="flex flex-col gap-7">
                <OnSaleSection onBuy={onBuy} onDetail={(p) => setDetailProduct(p)} />
                <TopProductsSection onBuy={onBuy} onDetail={(p) => setDetailProduct(p)} />

                {/* Games list — icon grid */}
                {games.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em]"
                      style={{ color: "rgba(240,242,250,0.3)" }}>Все игры</p>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                      {games.map((g) => {
                        const [c1, c2] = palette(g.id);
                        return (
                          <button key={g.id} onClick={() => setSelected(g)}
                            className="flex flex-col items-center gap-2 flex-shrink-0 active:opacity-70 w-[72px]">
                            <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden flex-shrink-0"
                              style={g.photo_id
                                ? { border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }
                                : { background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 8px 24px ${c1}50` }}>
                              {g.photo_id
                                ? <img src={g.photo_id} className="w-full h-full object-cover" alt={g.name} />
                                : <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-2xl font-black text-white">{initials(g.name)}</span>
                                  </div>
                              }
                            </div>
                            <p className="text-[11px] font-semibold text-center leading-tight w-full truncate"
                              style={{ color: "rgba(240,242,250,0.65)" }}>{g.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
