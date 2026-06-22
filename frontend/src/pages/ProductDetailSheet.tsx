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
interface Review { rating: number; text: string; photo_url: string; created_at: string }

interface Props {
  product: Product;
  onClose: () => void;
  onBuy: (p: Product) => void;
}

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
  return name.split(/\s+/).slice(0,2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          className={`${sz} ${i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-white/15"}`}
        />
      ))}
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

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div
        className="relative w-full rounded-t-3xl flex flex-col max-h-[90dvh]"
        style={{ background: "#0D1020", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Drag handle */}
        <div className="w-9 h-1 rounded-full mx-auto mt-3 flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.12)" }} />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center active:opacity-70"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <X className="w-4 h-4" style={{ color: "rgba(240,242,250,0.5)" }} />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 pb-6">
          {/* Hero image / gradient */}
          <div
            className="h-48 mx-4 mt-3 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={(!detail?.photo_id || imgErr) ? { background: `linear-gradient(145deg,${g1},${g2})` } : undefined}
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
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#F97316", borderTopColor: "transparent" }} />
            </div>
          ) : detail ? (
            <div className="px-4 mt-4 flex flex-col gap-5">
              {/* Title + game */}
              <div>
                {product.gameName && (
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1"
                    style={{ color: "rgba(240,242,250,0.25)" }}>
                    {product.gameName}
                  </p>
                )}
                <p className="font-black text-white leading-tight" style={{ fontSize: "1.375rem" }}>{detail.name}</p>
                {detail.avg_rating !== null && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Stars rating={detail.avg_rating} />
                    <span className="text-xs font-semibold" style={{ color: "rgba(240,242,250,0.35)" }}>
                      {detail.avg_rating.toFixed(1)} · {detail.reviews_count} reviews
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {detail.description && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1.5"
                    style={{ color: "rgba(240,242,250,0.2)" }}>{t.description}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(240,242,250,0.65)" }}>{detail.description}</p>
                </div>
              )}

              {/* Variant selector */}
              {detail.variants.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em]"
                    style={{ color: "rgba(240,242,250,0.25)" }}>{t.selectVariant}</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.variants.map((v) => (
                      <button
                        key={v.label}
                        onClick={() => setSelectedVariant(v)}
                        className="px-3.5 py-2 rounded-xl text-sm font-bold transition-colors"
                        style={selectedVariant?.label === v.label
                          ? { background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.30)", color: "#F97316" }
                          : { background: "#121526", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(240,242,250,0.55)" }
                        }
                      >
                        {v.label}
                        <span className={`ml-2 text-[11px]`}
                          style={{ color: selectedVariant?.label === v.label ? "rgba(249,115,22,0.65)" : "rgba(240,242,250,0.25)" }}>
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
                style={{ background: "#0D1020", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-0.5"
                      style={{ color: "rgba(240,242,250,0.2)" }}>{t.price}</p>
                    <p className="font-black" style={{ fontSize: "1.5rem", color: "#22D3EE" }}>
                      {(selectedVariant ? selectedVariant.price : detail.price).toLocaleString()}
                      <span className="text-base ml-1.5" style={{ color: "rgba(34,211,238,0.45)" }}>sum</span>
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
                      background: "linear-gradient(135deg,#F97316,#EA580C)",
                      boxShadow: "0 4px 20px rgba(249,115,22,0.25)",
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
                  <p className="text-sm font-black text-white">
                    {t.reviews} <span className="font-bold" style={{ color: "rgba(240,242,250,0.25)" }}>({reviews.length})</span>
                  </p>
                  {reviews.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-4 flex flex-col gap-2"
                      style={{ background: "#0D1020", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="flex items-center justify-between">
                        <Stars rating={r.rating} />
                        <span className="text-[10px]" style={{ color: "rgba(240,242,250,0.25)" }}>
                          {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {r.text && (
                        <p className="text-sm leading-relaxed" style={{ color: "rgba(240,242,250,0.65)" }}>{r.text}</p>
                      )}
                      {r.photo_url && (
                        <div className="mt-1 rounded-xl overflow-hidden h-40"
                          style={{ background: "rgba(255,255,255,0.04)" }}>
                          <img
                            src={r.photo_url}
                            className="w-full h-full object-cover"
                            alt="review"
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement).innerHTML =
                                '<div class="flex items-center justify-center h-full text-white/20"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {reviews.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6" style={{ color: "rgba(240,242,250,0.18)" }}>
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
