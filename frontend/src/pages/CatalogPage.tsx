import { useEffect, useState, useRef, useCallback } from "react";
import { Search, X, ChevronRight, ArrowLeft, ShoppingCart, Star, Zap } from "lucide-react";
import { getGames, getProducts } from "../api";

interface Game { id: string; name: string; description: string; photo_id: string }
interface Product { id: string; name: string; description: string; price: number; photo_id: string }
interface Props {
  onBuy: (product: Product & { gameName: string }) => void;
  onTopup: () => void;
}

// ─── Deterministic gradient palette ─────────────────────────────────────────

const PALETTES = [
  ["#FF6B35", "#F7931E"],  // orange
  ["#7B2FBE", "#C850C0"],  // purple-pink
  ["#0F3460", "#533483"],  // deep blue-purple
  ["#11998E", "#38EF7D"],  // teal-green
  ["#FC5C7D", "#6A3093"],  // pink-purple
  ["#4776E6", "#8E54E9"],  // blue-purple
  ["#F7971E", "#FFD200"],  // amber
  ["#FE8C00", "#F83600"],  // red-orange
  ["#43CBFF", "#9708CC"],  // cyan-purple
  ["#1D976C", "#93F9B9"],  // emerald
];

function palette(id: string) {
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
}

// ─── Static banners ──────────────────────────────────────────────────────────

const BANNERS = [
  {
    title: "Top Up Balance",
    sub: "Instant top-up via card, Payme or ATM",
    action: "Top Up Now",
    grad: ["#7C3AED", "#4F46E5"],
    icon: "💳",
  },
  {
    title: "Fast Delivery",
    sub: "Orders processed within minutes",
    action: "Browse Games",
    grad: ["#059669", "#0891B2"],
    icon: "⚡",
  },
  {
    title: "Best Prices",
    sub: "No markup. Official rates guaranteed",
    action: "Shop Now",
    grad: ["#DC2626", "#9333EA"],
    icon: "🔥",
  },
];

// ─── Components ──────────────────────────────────────────────────────────────

function GameIcon({ game, size }: { game: Game; size: "sm" | "md" | "xl" }) {
  const [g1, g2] = palette(game.id);
  const cls = size === "sm" ? "w-14 h-14 rounded-[18px] text-lg"
            : size === "md" ? "w-16 h-16 rounded-[20px] text-xl"
            : "w-20 h-20 rounded-[24px] text-2xl";
  if (game.photo_id) {
    return (
      <div className={`${cls} overflow-hidden flex-shrink-0`}>
        <img src={game.photo_id} className="w-full h-full object-cover" alt={game.name} />
      </div>
    );
  }
  return (
    <div className={`${cls} flex items-center justify-center font-black flex-shrink-0`}
      style={{ background: `linear-gradient(145deg, ${g1}, ${g2})`, boxShadow: `0 4px 20px ${g1}40` }}>
      <span className="text-white">{initials(game.name)}</span>
    </div>
  );
}

function BannerCarousel({ onTopup }: { onTopup: () => void }) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollLeft / ref.current.offsetWidth);
    setActive(idx);
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {BANNERS.map((b, i) => (
          <button
            key={i}
            onClick={() => { if (i === 0) onTopup(); }}
            className="flex-shrink-0 w-full snap-center mx-0 px-4 active:opacity-90"
          >
            <div className="rounded-2xl overflow-hidden relative h-36"
              style={{ background: `linear-gradient(135deg, ${b.grad[0]}, ${b.grad[1]})` }}>
              <div className="absolute inset-0 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-white/70" />
                    <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">Doonya Shop</span>
                  </div>
                  <p className="text-white font-black text-xl leading-tight">{b.title}</p>
                  <p className="text-white/70 text-xs mt-1">{b.sub}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-white/20 w-fit px-3 py-1.5 rounded-full">
                  <span className="text-white text-xs font-bold">{b.action}</span>
                  <ChevronRight className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-30 select-none">
                {b.icon}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-2.5">
        {BANNERS.map((_, i) => (
          <div key={i} className={`rounded-full transition-all ${active === i ? "w-4 h-1.5 bg-violet-400" : "w-1.5 h-1.5 bg-white/20"}`} />
        ))}
      </div>
    </div>
  );
}

function GameGrid({ games, onSelect }: { games: Game[]; onSelect: (g: Game) => void }) {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-4">
      {games.map((g) => (
        <button key={g.id} onClick={() => onSelect(g)}
          className="flex flex-col items-center gap-1.5 active:opacity-70">
          <GameIcon game={g} size="md" />
          <span className="text-[11px] text-white/80 font-medium text-center leading-tight line-clamp-2 w-full">
            {g.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function ProductCard({ product, gameName, onBuy }: {
  product: Product;
  gameName: string;
  onBuy: () => void;
}) {
  return (
    <div className="shop-card flex flex-col">
      <div className="flex-1 p-3 pb-2">
        <p className="text-[13px] font-bold text-white leading-snug">{product.name}</p>
        {product.description && (
          <p className="text-[11px] text-white/40 mt-0.5 line-clamp-1">{product.description}</p>
        )}
      </div>
      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-violet-400">{product.price.toLocaleString()}</span>
        <button
          onClick={onBuy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 text-[11px] font-bold text-white active:opacity-70">
          <ShoppingCart className="w-3 h-3" /> Buy
        </button>
      </div>
    </div>
  );
}

function GameDetailPage({
  game,
  onBack,
  onBuy,
}: {
  game: Game;
  onBack: () => void;
  onBuy: (product: Product & { gameName: string }) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [g1, g2] = palette(game.id);

  useEffect(() => {
    getProducts(game.id).then((p) => { setProducts(p); setLoading(false); });
  }, [game.id]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Hero header */}
      <div className="relative h-36 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${g1}cc, ${g2}cc)` }}>
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <div className="flex items-end gap-3">
            <GameIcon game={game} size="xl" />
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-white font-black text-xl leading-tight">{game.name}</p>
              {game.description && (
                <p className="text-white/70 text-xs mt-0.5 line-clamp-2">{game.description}</p>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onBack}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center active:opacity-70">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Products */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-white/30">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">Products coming soon</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
                {products.length} products
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  gameName={game.name}
                  onBuy={() => onBuy({ ...p, gameName: game.name })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CatalogPage({ onBuy, onTopup }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Game | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getGames().then((g) => { setGames(g); setLoading(false); });
  }, []);

  const filtered = query
    ? games.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()))
    : games;

  if (selected) {
    return (
      <GameDetailPage
        game={selected}
        onBack={() => setSelected(null)}
        onBuy={(p) => onBuy(p)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games..."
          className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50 transition-colors"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-white/30" />
          </button>
        )}
      </div>

      {/* Banners */}
      {!query && <BannerCarousel onTopup={onTopup} />}

      {/* Games */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-white/30">
          <Search className="w-8 h-8" />
          <p className="text-sm">Nothing found for "{query}"</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-white">
              {query ? `Results (${filtered.length})` : "All Games"}
            </p>
            {!query && (
              <span className="text-xs text-white/30 font-medium">{games.length} total</span>
            )}
          </div>
          <GameGrid games={filtered} onSelect={setSelected} />
        </div>
      )}
    </div>
  );
}
