import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronRight, ArrowLeft, ShoppingCart, Zap, Flame, Tag } from "lucide-react";
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
  ["#FF6B35","#F7931E"],["#7B2FBE","#C850C0"],["#0F3460","#533483"],
  ["#11998E","#38EF7D"],["#FC5C7D","#6A3093"],["#4776E6","#8E54E9"],
  ["#F7971E","#FFD200"],["#FE8C00","#F83600"],["#43CBFF","#9708CC"],["#1D976C","#93F9B9"],
];
const BANNER_GRADS = [["#3b82f6","#2563eb"],["#059669","#0891B2"],["#DC2626","#9333EA"]];

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
        <span className="text-[10px] font-black text-red-400 leading-none">{item.discounted_price.toLocaleString()}</span>
      </div>
    );
  }
  return <span className="text-[10px] font-black text-blue-400">{item.price.toLocaleString()}</span>;
}

function VariantCard({ item, gameId, onBuy, onDetail }: {
  item: CardItem; gameId: string; onBuy: () => void; onDetail: () => void;
}) {
  const { t } = useLang();
  const [g1, g2] = palette(gameId + item.id + (item.variant_label || ""));
  return (
    <div className="flex-shrink-0 w-[128px] rounded-2xl overflow-hidden flex flex-col active:opacity-80 relative"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
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
            className="px-2 py-1 rounded-lg bg-blue-600 text-[10px] font-bold text-white active:opacity-70">
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
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col active:opacity-80 relative"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
      onClick={onDetail}>
      {item.discount_percent ? <DiscountBadge pct={item.discount_percent} /> : null}
      <div className="p-3 pb-2 flex-1">
        <p className="text-[13px] font-bold text-white leading-snug pr-6">{item.name}</p>
        {item.raw.description && !item.variant_label && (
          <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{item.raw.description}</p>
        )}
      </div>
      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        <CardPrice item={item} />
        <button onClick={(e) => { e.stopPropagation(); onBuy(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-[11px] font-bold text-white active:opacity-70">
          <ShoppingCart className="w-3 h-3" /> {t.buy}
        </button>
      </div>
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function BannerCarousel({ onTopup }: { onTopup: () => void }) {
  const { t } = useLang();
  const [active, setActive] = useState(0);
  const banners = [
    { title: t.topUpBalance, sub: "Instant top-up via card or ATM", action: t.topUpNow, grad: BANNER_GRADS[0] },
    { title: t.fastDelivery, sub: "Orders processed within minutes", action: t.browseGames, grad: BANNER_GRADS[1] },
    { title: t.bestPrices, sub: "No markup. Official rates guaranteed", action: t.shopNow, grad: BANNER_GRADS[2] },
  ];
  return (
    <div className="relative -mx-4">
      <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth))}>
        {banners.map((b, i) => (
          <button key={i} onClick={() => { if (i === 0) onTopup(); }}
            className="flex-shrink-0 w-full snap-center px-4 active:opacity-90">
            <div className="rounded-2xl overflow-hidden relative h-[130px]"
              style={{ background: `linear-gradient(135deg,${b.grad[0]},${b.grad[1]})` }}>
              <div className="absolute inset-0 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Doonya Shop</span>
                  </div>
                  <p className="text-white font-black text-[18px] leading-tight">{b.title}</p>
                  <p className="text-white/70 text-xs mt-0.5">{b.sub}</p>
                </div>
                <div className="flex items-center gap-1 bg-white/20 w-fit px-3 py-1.5 rounded-full">
                  <span className="text-white text-[11px] font-bold">{b.action}</span>
                  <ChevronRight className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-2">
        {banners.map((_, i) => (
          <div key={i} className={`rounded-full transition-all ${active === i ? "w-4 h-1.5 bg-blue-400" : "w-1.5 h-1.5 bg-white/20"}`} />
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
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
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

  const scrollToSection = (catId: string) => {
    setActiveTab(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
              <p className="text-white font-black text-xl leading-tight">{game.name}</p>
              {game.description && (
                <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{game.description}</p>
              )}
            </div>
          </div>
        </div>
        <button onClick={onBack}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center active:opacity-70">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Sticky category tabs */}
      {categories.length > 0 && (
        <div className="sticky top-0 z-10 bg-[#0d0f1a]/95 backdrop-blur border-b border-white/[0.06]">
          <div className="flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => scrollToSection(cat.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  activeTab === cat.id ? "bg-blue-600 text-white" : "bg-white/[0.06] text-white/50 active:bg-white/10"
                }`}>
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
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : totalCards === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-white/25">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">{t.comingSoon}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {categories.map((cat) => {
              const items = productsByCategory[cat.id] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }}>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">{cat.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {items.map((item, i) => (
                      <GameDetailProductCard
                        key={`${item.id}-${item.variant_label || i}`}
                        item={item}
                        onBuy={() => onBuy({ ...item.raw, gameName: game.name, variant_label: item.variant_label })}
                        onDetail={() => onDetail({ ...item.raw, gameName: game.name, variant_label: item.variant_label })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {uncategorized.length > 0 && (
              <div>
                {categories.length > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Другое</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {uncategorized.map((item, i) => (
                    <GameDetailProductCard
                      key={`unc-${item.id}-${item.variant_label || i}`}
                      item={item}
                      onBuy={() => onBuy({ ...item.raw, gameName: game.name, variant_label: item.variant_label })}
                      onDetail={() => onDetail({ ...item.raw, gameName: game.name, variant_label: item.variant_label })}
                    />
                  ))}
                </div>
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
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }
  if (!results) return null;

  const hasAny = results.games.length + results.categories.length + results.products.length > 0;
  if (!hasAny) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-white/25">
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Игры</p>
          <div className="flex flex-col gap-1">
            {results.games.map((g) => (
              <button key={g.id} onClick={() => onGameSelect(g)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] active:bg-white/[0.08] text-left">
                <GameIcon game={g} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white">{g.name}</p>
                  {g.description && <p className="text-[11px] text-white/40 truncate">{g.description}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {results.categories.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Категории</p>
          <div className="flex flex-wrap gap-2">
            {results.categories.map((c) => (
              <span key={c.id} className="px-3 py-1.5 rounded-full bg-white/[0.06] text-xs font-bold text-white/60">
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {productCards.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Товары</p>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchGames}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/40 transition-colors" />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-white/30" />
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
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-7">
                <OnSaleSection onBuy={onBuy} onDetail={(p) => setDetailProduct(p)} />
                <TopProductsSection onBuy={onBuy} onDetail={(p) => setDetailProduct(p)} />

                {/* Games list */}
                {games.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Все игры</p>
                    <div className="flex flex-col gap-1">
                      {games.map((g) => (
                        <button key={g.id} onClick={() => setSelected(g)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] active:bg-white/[0.08] text-left">
                          <GameIcon game={g} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-white">{g.name}</p>
                            {g.description && <p className="text-[11px] text-white/40 truncate">{g.description}</p>}
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
                        </button>
                      ))}
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
