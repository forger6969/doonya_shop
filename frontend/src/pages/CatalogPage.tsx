import { useEffect, useState } from "react";
import { Search, X, ChevronRight, ArrowLeft, ShoppingCart, Zap } from "lucide-react";
import { getGames, getProducts } from "../api";
import { useLang } from "../i18n";
import ProductDetailSheet from "./ProductDetailSheet";

interface Variant { label: string; price: number }
interface PurchaseField { label: string; required: boolean }
interface Game { id: string; name: string; description: string; photo_id: string }
interface Product {
  id: string; name: string; description?: string; price: number; photo_id?: string;
  variants?: Variant[]; purchase_fields?: PurchaseField[];
  variant_label?: string; gameName?: string;
}
interface Props {
  onBuy: (product: Product) => void;
  onTopup: () => void;
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const PALETTES = [
  ["#FF6B35", "#F7931E"],
  ["#7B2FBE", "#C850C0"],
  ["#0F3460", "#533483"],
  ["#11998E", "#38EF7D"],
  ["#FC5C7D", "#6A3093"],
  ["#4776E6", "#8E54E9"],
  ["#F7971E", "#FFD200"],
  ["#FE8C00", "#F83600"],
  ["#43CBFF", "#9708CC"],
  ["#1D976C", "#93F9B9"],
];

function palette(id: string) {
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
}

// ─── Static banners ──────────────────────────────────────────────────────────

const BANNER_GRADS = [
  ["#3b82f6", "#2563eb"],
  ["#059669", "#0891B2"],
  ["#DC2626", "#9333EA"],
];

// ─── Components ──────────────────────────────────────────────────────────────

function GameIcon({ game, size }: { game: Game; size: "sm" | "md" | "lg" }) {
  const [g1, g2] = palette(game.id);
  const cls =
    size === "sm" ? "w-11 h-11 rounded-[14px] text-base"
    : size === "md" ? "w-14 h-14 rounded-[18px] text-lg"
    : "w-[72px] h-[72px] rounded-[22px] text-2xl";

  if (game.photo_id) {
    return (
      <div className={`${cls} overflow-hidden flex-shrink-0`}>
        <img src={game.photo_id} className="w-full h-full object-cover" alt={game.name} />
      </div>
    );
  }
  return (
    <div
      className={`${cls} flex items-center justify-center font-black flex-shrink-0`}
      style={{ background: `linear-gradient(145deg,${g1},${g2})`, boxShadow: `0 4px 16px ${g1}40` }}
    >
      <span className="text-white">{initials(game.name)}</span>
    </div>
  );
}

function BannerCarousel({ onTopup }: { onTopup: () => void }) {
  const { t } = useLang();
  const [active, setActive] = useState(0);

  const banners = [
    { title: t.topUpBalance, sub: "Instant top-up via card, Payme or ATM", action: t.topUpNow, grad: BANNER_GRADS[0] },
    { title: t.fastDelivery, sub: "Orders processed within minutes", action: t.browseGames, grad: BANNER_GRADS[1] },
    { title: t.bestPrices, sub: "No markup. Official rates guaranteed", action: t.shopNow, grad: BANNER_GRADS[2] },
  ];

  return (
    <div className="relative -mx-4">
      <div
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / el.offsetWidth));
        }}
      >
        {banners.map((b, i) => (
          <button
            key={i}
            onClick={() => { if (i === 0) onTopup(); }}
            className="flex-shrink-0 w-full snap-center px-4 active:opacity-90"
          >
            <div
              className="rounded-2xl overflow-hidden relative h-[130px]"
              style={{ background: `linear-gradient(135deg,${b.grad[0]},${b.grad[1]})` }}
            >
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
          <div
            key={i}
            className={`rounded-full transition-all ${active === i ? "w-4 h-1.5 bg-blue-400" : "w-1.5 h-1.5 bg-white/20"}`}
          />
        ))}
      </div>
    </div>
  );
}

function HorizProductCard({ product, gameId, onBuy, onDetail }: {
  product: Product;
  gameId: string;
  onBuy: () => void;
  onDetail: () => void;
}) {
  const { t } = useLang();
  const [g1, g2] = palette(gameId + product.id);
  return (
    <div
      className="flex-shrink-0 w-[128px] rounded-2xl overflow-hidden flex flex-col active:opacity-80"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
      onClick={onDetail}
    >
      <div className="h-[70px] flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={product.photo_id ? undefined : { background: `linear-gradient(145deg,${g1},${g2})` }}>
        {product.photo_id
          ? <img src={product.photo_id} className="w-full h-full object-cover" alt={product.name} />
          : <span className="text-xl font-black text-white/80">{initials(product.name)}</span>
        }
      </div>
      <div className="p-2.5 flex flex-col gap-1.5 flex-1">
        <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">{product.name}</p>
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-[10px] font-black text-blue-400">{product.price.toLocaleString()}</span>
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

function GameSection({ game, onBuy, onSeeAll, onDetail }: {
  game: Game;
  onBuy: (p: Product) => void;
  onSeeAll: () => void;
  onDetail: (p: Product) => void;
}) {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts(game.id).then((p) => { setProducts(p); setLoading(false); });
  }, [game.id]);

  if (!loading && products.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <GameIcon game={game} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white leading-tight">{game.name}</p>
          {!loading && (
            <p className="text-[11px] text-white/30 mt-0.5">{products.length} {t.products}</p>
          )}
        </div>
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-blue-400 text-xs font-bold active:opacity-70 flex-shrink-0"
        >
          {t.all} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Horizontal scroll */}
      {loading ? (
        <div className="flex gap-3 -mx-4 px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[128px] h-[140px] rounded-2xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {products.slice(0, 10).map((p) => (
            <HorizProductCard
              key={p.id}
              product={p}
              gameId={game.id}
              onBuy={() => onBuy({ ...p, gameName: game.name })}
              onDetail={() => onDetail({ ...p, gameName: game.name })}
            />

          ))}
        </div>
      )}
    </div>
  );
}

// ─── Game detail ─────────────────────────────────────────────────────────────

function ProductDetailCard({ product, onBuy, onDetail }: {
  product: Product;
  onBuy: () => void;
  onDetail: () => void;
}) {
  const { t } = useLang();
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col active:opacity-80"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
      onClick={onDetail}
    >
      <div className="flex-1 p-3 pb-2">
        <p className="text-[13px] font-bold text-white leading-snug">{product.name}</p>
        {product.description && (
          <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{product.description}</p>
        )}
      </div>
      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-blue-400">{product.price.toLocaleString()} sum</span>
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
  game: Game;
  onBack: () => void;
  onBuy: (product: Product) => void;
  onDetail: (product: Product) => void;
}) {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [g1, g2] = palette(game.id);

  useEffect(() => {
    getProducts(game.id).then((p) => { setProducts(p); setLoading(false); });
  }, [game.id]);

  return (
    <div className="flex flex-col min-h-full">
      <div
        className="relative h-32 flex-shrink-0"
        style={{ background: `linear-gradient(135deg,${g1}cc,${g2}cc)` }}
      >
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
        <button
          onClick={onBack}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center active:opacity-70"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-white/25">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">{t.comingSoon}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              {products.length} {t.products}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <ProductDetailCard
                  key={p.id}
                  product={p}
                  onBuy={() => onBuy({ ...p, gameName: game.name })}
                  onDetail={() => onDetail({ ...p, gameName: game.name })}
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
          onBuy={(p) => { onBuy(p); }}
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

        {/* Banner */}
        {!query && <BannerCarousel onTopup={onTopup} />}

        {/* Content */}
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
            {query && (
              <p className="text-sm font-bold text-white">{t.results} ({filtered.length})</p>
            )}
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

      {/* Product detail sheet */}
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
