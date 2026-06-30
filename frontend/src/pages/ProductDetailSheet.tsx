import { useEffect, useState } from "react";
import { X, Star, ShoppingCart } from "lucide-react";
import { getProduct, getReviews } from "../api";
import { useLang } from "../i18n";

interface Variant { label: string; price: number }
interface PurchaseField { label: string; required: boolean }
interface Product {
  id: string; name: string; price: number; gameName?: string;
  variant_label?: string;
  variants?: Variant[];
  purchase_fields?: PurchaseField[];
}
interface Detail {
  id: string; name: string; description: string; price: number;
  photo_id: string; avg_rating: number | null; reviews_count: number;
  variants: Variant[];
  purchase_fields: PurchaseField[];
}
interface Review {
  rating: number; text: string; photo_url: string; created_at: string, db_user_id: {
    _id: string,
    user_id: number,
    username: string,
    first_name: string,
    balance: number
  }
}

interface Props {
  product: Product;
  onClose: () => void;
  onBuy: (p: Product) => void;
}

const PALETTES = [
  ["#EC4899", "#f97316"], ["#f97316", "#0ea5e9"], ["#EC4899", "#EC4899"],
  ["#EC4899", "#818CF8"], ["#FB7185", "#EC4899"], ["#EC4899", "#f97316"],
  ["#EC4899", "#EC4899"], ["#EC4899", "#EC4899"], ["#EC4899", "#EC4899"], ["#EC4899", "#f97316"],
];
function palette(id: string) {
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${sz} ${i <= Math.round(rating) ? "fill-pink-400 text-pink-400" : ""}`}
          style={i > Math.round(rating) ? { color: "var(--text-muted)" } : undefined}
        />
      ))}
    </div>
  );
}

function SkeletonPulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`s-shimmer ${className ?? ""}`} style={style} />;
}

function LoadingSkeleton() {
  return (
    <div className="px-4 mt-4 flex flex-col gap-5 s-fade-in">
      {/* Title skeleton */}
      <div className="flex flex-col gap-2">
        <SkeletonPulse style={{ height: 12, width: "40%", borderRadius: 6 }} />
        <SkeletonPulse style={{ height: 22, width: "75%", borderRadius: 8 }} />
        <SkeletonPulse style={{ height: 14, width: "55%", borderRadius: 6 }} />
      </div>
      {/* Description skeleton */}
      <div className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SkeletonPulse style={{ height: 10, width: "30%", borderRadius: 4, marginBottom: 10 }} />
        <SkeletonPulse style={{ height: 13, width: "100%", borderRadius: 4, marginBottom: 6 }} />
        <SkeletonPulse style={{ height: 13, width: "85%", borderRadius: 4, marginBottom: 6 }} />
        <SkeletonPulse style={{ height: 13, width: "65%", borderRadius: 4 }} />
      </div>
      {/* Price skeleton */}
      <div className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div>
          <SkeletonPulse style={{ height: 10, width: 40, borderRadius: 4, marginBottom: 8 }} />
          <SkeletonPulse style={{ height: 28, width: 110, borderRadius: 8 }} />
        </div>
        <SkeletonPulse style={{ height: 44, width: 110, borderRadius: 12 }} />
      </div>
    </div>
  );
}

export default function ProductDetailSheet({ product, onClose, onBuy }: Props) {
  const { t } = useLang();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [g1, g2] = palette(product.id);

  // Slide-up animation
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  useEffect(() => {
    Promise.all([
      getProduct(product.id),
      getReviews(product.id),
    ]).then(([d, r]) => {
      setDetail(d);
      setReviews(r);
      setLoading(false);
    });
  }, [product.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.72)",
          backdropFilter: visible ? "blur(4px)" : "blur(0px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full rounded-t-3xl flex flex-col"
        style={{
          maxHeight: "90dvh",
          background: "var(--bg-raised)",
          border: "1px solid var(--border-card)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.40)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          willChange: "transform",
        }}
      >
        {/* Drag handle */}
        <div className="w-9 h-1 rounded-full mx-auto mt-3 flex-shrink-0"
          style={{ background: "var(--border-card)" }} />

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center active:opacity-70 transition-opacity"
          style={{ background: "var(--bg-surface)" }}
        >
          <X className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 pb-6 overscroll-contain">
          {/* Hero image / gradient */}
          <div
            className="h-48 mx-4 mt-3 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={(!detail?.photo_id || imgErr)
              ? { background: `linear-gradient(145deg,${g1},${g2})` }
              : undefined}
          >
            {detail?.photo_id && !imgErr ? (
              <img
                src={detail.photo_id}
                className="w-full h-full object-cover"
                alt={detail.name}
                onError={() => setImgErr(true)}
              />
            ) : (
              <span className="text-5xl font-black text-white/80">{initials(product.name)}</span>
            )}
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : detail ? (
            <div className="px-4 mt-4 flex flex-col gap-5 s-fade-in">
              {/* Title + game */}
              <div>
                {product.gameName && (
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1"
                    style={{ color: "var(--text-muted)" }}>
                    {product.gameName}
                  </p>
                )}
                <p className="font-black leading-tight" style={{ fontSize: "1.375rem", color: "var(--text)" }}>
                  {detail.name}
                </p>
                {detail.avg_rating !== null && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Stars rating={detail.avg_rating} />
                    <span className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                      {detail.avg_rating.toFixed(1)} · {detail.reviews_count} reviews
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {detail.description && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1.5"
                    style={{ color: "var(--text-muted)" }}>{t.description}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>{detail.description}</p>
                </div>
              )}

              {/* Variant selector */}
              {detail.variants.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em]"
                    style={{ color: "var(--text-muted)" }}>{t.selectVariant}</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.variants.map((v) => (
                      <button
                        key={v.label}
                        onClick={() => setSelectedVariant(v)}
                        className="px-3.5 py-2 rounded-xl text-sm font-bold transition-colors"
                        style={selectedVariant?.label === v.label
                          ? { background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.12)", color: "#EC4899" }
                          : { background: "var(--bg-surface)", border: "1px solid var(--border-card)", color: "var(--text-dim)" }
                        }
                      >
                        {v.label}
                        <span className="ml-2 text-[11px]"
                          style={{ color: selectedVariant?.label === v.label ? "rgba(236,72,153,0.12)" : "var(--text-muted)" }}>
                          {v.price.toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price + buy */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-card)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-0.5"
                      style={{ color: "var(--text-muted)" }}>{t.price}</p>
                    <p className="font-black" style={{ fontSize: "1.5rem", color: "#EC4899" }}>
                      {(selectedVariant ? selectedVariant.price : detail.price).toLocaleString()}
                      <span className="text-base ml-1.5" style={{ color: "rgba(251,191,36,0.45)" }}>sum</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onBuy({
                        ...product,
                        variants: detail.variants,
                        purchase_fields: detail.purchase_fields,
                        variant_label: selectedVariant?.label,
                        price: selectedVariant ? selectedVariant.price : detail.price,
                      });
                      onClose();
                    }}
                    disabled={detail.variants.length > 0 && !selectedVariant}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm text-white active:opacity-70 disabled:opacity-40"
                    style={{
                      background: "#EC4899",
                      boxShadow: "0 4px 24px rgba(236,72,153,0.12)",
                    }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {detail.variants.length > 0 && !selectedVariant ? t.pickVariant : t.buy}
                  </button>
                </div>
              </div>

              {/* Reviews */}
              {reviews.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-black" style={{ color: "var(--text)" }}>
                    {t.reviews} <span className="font-bold" style={{ color: "var(--text-muted)" }}>({reviews.length})</span>
                  </p>
                  {reviews.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-4 flex flex-col gap-2 s-slide-up"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        animationDelay: `${i * 40}ms`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <Stars rating={r.rating} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      {r.db_user_id && <p>
                        @{r.db_user_id.username}
                      </p>}

                      {r.text && (
                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>{r.text}</p>
                      )}

                      <button onClick={() => alert(r)}>debug</button>
                      {r.photo_url && (
                        <div className="mt-1 rounded-xl overflow-hidden h-40"
                          style={{ background: "var(--border)" }}>
                          <img
                            src={r.photo_url}
                            className="w-full h-full object-cover"
                            alt="review"
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement).innerHTML =
                                '<div class="flex items-center justify-center h-full" style="color:var(--text-muted)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {reviews.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6" style={{ color: "var(--text-muted)" }}>
                  <Star className="w-8 h-8" />
                  <p className="text-sm">{t.noReviews}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
