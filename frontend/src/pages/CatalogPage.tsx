import { useEffect, useState } from "react";
import { Search, X, ChevronRight, ArrowLeft, ShoppingCart, Zap, Flame, Tag } from "lucide-react";
import { getGames, getProducts, getTopProducts, getOnSaleProducts } from "../api";
import { useLang } from "../i18n";
import ProductDetailSheet from "./ProductDetailSheet";

interface Variant { label: string; price: number }
interface PurchaseField { label: string; required: boolean }
interface Game { id: string; name: string; description: string; photo_id: string }
interface Product {
  id: string; name: string; description?: string; price: number;
  discounted_price?: number; discount_percent?: number;
  photo_id?: string;
  variants?: Variant[]; purchase_fields?: PurchaseField[];
  variant_label?: string; gameName?: string;
}

// Virtual card: a product OR a single variant expanded into its own card
interface CardItem {
  id: string;            // product id
  name: string;          // display name (variant label or product name)
  price: number;         // display price
  discounted_price?: number;
  discount_percent?: number;
  photo_id?: string;
  purchase_fields?: PurchaseField[];
  variant_label?: string;
  raw: Product;          // full product for BuyModal
}

interface Props {
  onBuy: (product: Product) => void;
  onTopup: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PALETTES = [
  ["#FF6B35","#F7931E"],["#7B2FBE","#C850C0"],["#0F3460","#533483"],
  ["#11998E","#38EF7D"],["#FC5C7D","#6A3093"],["#4776E6","#8E54E9"],
  ["#F7971E","#FFD200"],["#FE8C00","#F83600"],["#43CBFF","#9708CC"],["#1D976C","#93F9B9"],
];

function palette(id: string) {
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
}

/** Expand a product into 1..N cards depending on whether it has variants */
function toCards(product: Product): CardItem[] {
  if (product.variants && product.variants.length > 0) {
    return product.variants.map((v) => ({
      id: product.id,
      name: v.label,
      price: v.price,
      discounted_price: product.discount_percent
        ? Math.max(1, Math.floor(v.price * (100 - product.discount_percent) / 100))
        : undefined,
      discount_percent: product.discount_percent,
      photo_id: product.photo_id,
      purchase_fields: product.purchase_fields,
      variant_label: v.label,
      raw: product,
    }));
  }
  return [{
    id: product.id,
    name: product.name,
    price: product.price,
    discounted_price: product.discounted_price,
    discount_percent: product.discount_percent,
    photo_id: product.photo_id,
    purchase_fields: product.purchase_fields,
    raw: product,
  }];
}

const BANNER_GRADS = [["#3b82f6","#2563eb"],["#059669","#0891B2"],["#DC2626","#9333EA"]];

// ─── Components ──────────────────────────────────────────────────────────────

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
    <div
      className="flex-shrink-0 w-[128px] rounded-2xl overflow-hidden flex flex-col active:opacity-80 relative"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
      onClick={onDetail}
    >
      {item.discount_percent ? <DiscountBadge pct={item.discount_percent} /> : null}
      <div className="h-[70px] flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={item.photo_id ? undefined : { background: `linear-gradient(145deg,${g1},${g2})` }}>
        {item.photo_id
          ? <img src={item.photo_id} className="w-full h-full object-cover" alt={item.name} />
          : <span className="text-xl font-black text-white/80">{initials(item.name)}</span>
        }
      </div>
      <div className="p-2.5 flex flex-col gap-1.5 flex-1">
        <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">{item.name}</p>
        <div className="flex items-center justify-between mt-auto pt-1">
          <CardPrice item={item} />
          <button
            onClick={(e) => { e.stopPropagation(); onBuy(); }}
            className="px-2 py-1 rounded-lg bg-blue-600 text-[10px] font-bold text-white active:opacity-70"
          >
            {t.buy}
          </button>
        </div>
      </div>
    </div>
  );
}

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

// Horizontal scroll row of variant cards
function CardRow({ cards, gameId, onBuy, onDetail }: {
  cards: CardItem[]; gameId: string;
  onBuy: (item: CardItem) => void; onDetail: (item: CardItem) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
      {cards.map((item, i) => (
        <VariantCard
          key={`${item.id}-${item.variant_label || i}`}
          item={item}
          gameId={gameId}
          onBuy={() => onBuy(item)}
          onDetail={() => onDetail(item)}
        />
      ))}
    </div>
  );
}

function GameSection({ game, onBuy, onSeeAll, onDetail }: {
  game: Game; onBuy: (p: Product) => void; onSeeAll: () => void; onDetail: (p: Product) => void;
}) {
  const { t } = useLang();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts(game.id).then((products: Product[]) => {
      setCards(products.flatMap(toCards));
      setLoading(false);
    });
  }, [game.id]);

  if (!loading && cards.length === 0) return null;

  const handleBuy = (item: CardItem) => {
    onBuy({ ...item.raw, gameName: game.name, variant_label: item.variant_label });
  };
  const handleDetail = (item: CardItem) => {
    onDetail({ ...item.raw, gameName: game.name, variant_label: item.variant_label });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <GameIcon game={game} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white leading-tight">{game.name}</p>
          {!loading && <p className="text-[11px] text-white/30 mt-0.5">{cards.length} {t.products}</p>}
        </div>
        <button onClick={onSeeAll} className="flex items-center gap-0.5 text-blue-400 text-xs font-bold active:opacity-70 flex-shrink-0">
          {t.all} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {loading ? (
        <div className="flex gap-3 -mx-4 px-4">
          {[1,2,3].map((i) => <div key={i} className="flex-shrink-0 w-[128px] h-[140px] rounded-2xl bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : (
        <CardRow cards={cards.slice(0, 10)} gameId={game.id} onBuy={handleBuy} onDetail={handleDetail} />
      )}
    </div>
  );
}

// ── Top products horizontal strip ─────────────────────────────────────────────

function TopProductsSection({ onBuy, onDetail }: {
  onBuy: (p: Product) => void; onDetail: (p: Product) => void;
}) {
  const [cards, setCards] = useState<CardItem[]>([]);
  useEffect(() => {
    getTopProducts().then((products: Product[]) => setCards(products.flatMap(toCards)));
  }, []);
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <p className="text-sm font-black text-white">Топ продаж</p>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {cards.slice(0, 8).map((item, i) => (
          <VariantCard
            key={`top-${item.id}-${i}`}
            item={item}
            gameId={item.id}
            onBuy={() => onBuy({ ...item.raw, variant_label: item.variant_label })}
            onDetail={() => onDetail({ ...item.raw, variant_label: item.variant_label })}
          />
        ))}
      </div>
    </div>
  );
}

// ── On-sale products strip ────────────────────────────────────────────────────

function OnSaleSection({ onBuy, onDetail }: {
  onBuy: (p: Product) => void; onDetail: (p: Product) => void;
}) {
  const [cards, setCards] = useState<CardItem[]>([]);
  useEffect(() => {
    getOnSaleProducts().then((products: Product[]) => setCards(products.flatMap(toCards)));
  }, []);
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-red-400" />
        <p className="text-sm font-black text-white">Скидки</p>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {cards.slice(0, 10).map((item, i) => (
          <VariantCard
            key={`sale-${item.id}-${i}`}
            item={item}
            gameId={item.id}
            onBuy={() => onBuy({ ...item.raw, variant_label: item.variant_label })}
            onDetail={() => onDetail({ ...item.raw, variant_label: item.variant_label })}
          />
        ))}
      </div>
    </div>
  );
}

// ── Game detail (full list of variant cards) ──────────────────────────────────

function GameDetailProductCard({ item, onBuy, onDetail }: {
  item: CardItem; onBuy: () => void; onDetail: () => void;
}) {
  const { t } = useLang();
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col active:opacity-80 relative"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
      onClick={onDetail}
    >
      {item.discount_percent ? <DiscountBadge pct={item.discount_percent} /> : null}
      <div className="p-3 pb-2 flex-1">
        <p className="text-[13px] font-bold text-white leading-snug pr-6">{item.name}</p>
        {item.raw.description && !item.variant_label && (
          <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{item.raw.description}</p>
        )}
      </div>
      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        <CardPrice item={item} />
        <button
          onClick={(e) => { e.stopPropagation(); onBuy(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-[11px] font-bold text-white active:opacity-70"
        >
          <ShoppingCart className="w-3 h-3" /> {t.buy}
        </button>
      </div>
    </div>
  );
}

function GameDetailPage({ game, onBack, onBuy, onDetail }: {
  game: Game; onBack: () => void; onBuy: (product: Product) => void; onDetail: (product: Product) => void;
}) {
  const { t } = useLang();
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [g1, g2] = palette(game.id);

  useEffect(() => {
    getProducts(game.id).then((products: Product[]) => {
      setCards(products.flatMap(toCards));
      setLoading(false);
    });
  }, [game.id]);

  return (
    <div className="flex flex-col min-h-full">
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

      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-white/25">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">{t.comingSoon}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              {cards.length} {t.products}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {cards.map((item, i) => (
                <GameDetailProductCard
                  key={`${item.id}-${item.variant_label || i}`}
                  item={item}
                  onBuy={() => onBuy({ ...item.raw, gameName: game.name, variant_label: item.variant_label })}
                  onDetail={() => onDetail({ ...item.raw, gameName: game.name, variant_label: item.variant_label })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
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

  const filtered = query
    ? games.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()))
    : games;

  return (
    <>
      <div className="flex flex-col gap-5 pb-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchGames}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/40 transition-colors"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-white/30" />
            </button>
          )}
        </div>

        {!query && <BannerCarousel onTopup={onTopup} />}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-white/25">
            <Search className="w-8 h-8" />
            <p className="text-sm">{t.nothingFound} "{query}"</p>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {!query && (
              <>
                <OnSaleSection onBuy={onBuy} onDetail={(p) => setDetailProduct(p)} />
                <TopProductsSection onBuy={onBuy} onDetail={(p) => setDetailProduct(p)} />
              </>
            )}
            {query && <p className="text-sm font-bold text-white">{t.results} ({filtered.length})</p>}
            {filtered.map((g) => (
              <GameSection
                key={g.id}
                game={g}
                onBuy={onBuy}
                onSeeAll={() => setSelected(g)}
                onDetail={(p) => setDetailProduct(p)}
              />
            ))}
          </div>
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
