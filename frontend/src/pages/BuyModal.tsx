import { useState } from "react";
import { ShoppingCart, Wallet, Check, Tag, X, AlertCircle } from "lucide-react";
import { buyProduct, validatePromo } from "../api";
import { useLang } from "../i18n";

interface Variant { label: string; price: number }
interface PurchaseField { label: string; required: boolean }
interface Product {
  id: string; name: string; price: number; gameName?: string;
  variant_label?: string;
  variants?: Variant[];
  purchase_fields?: PurchaseField[];
}
interface Props { product: Product; balance: number; onClose: () => void; onSuccess: () => void }

export default function BuyModal({ product, balance, onClose, onSuccess }: Props) {
  const { t } = useLang();
  const hasVariants = (product.variants?.length ?? 0) > 0;
  const hasFields = (product.purchase_fields?.length ?? 0) > 0;

  // Variant state — if product already has variant_label set (from detail sheet), pre-select it
  const preSelected = product.variant_label
    ? product.variants?.find((v) => v.label === product.variant_label) ?? null
    : null;
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    preSelected ?? (hasVariants ? null : null)
  );

  // Field answers
  const [fieldAnswers, setFieldAnswers] = useState<Record<string, string>>({});

  // Promo
  const [promoCode, setPromoCode] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoErr, setPromoErr] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const basePrice = selectedVariant ? selectedVariant.price : product.price;
  const finalPrice = Math.max(0, basePrice - discount);
  const canAfford = balance >= finalPrice;
  const fieldsValid = !hasFields || (product.purchase_fields ?? []).every(
    (f) => !f.required || fieldAnswers[f.label]?.trim()
  );
  const canBuy = (!hasVariants || selectedVariant) && fieldsValid && canAfford;

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true); setPromoErr("");
    try {
      const res = await validatePromo(product.id, promoInput.trim());
      setDiscount(res.discount);
      setPromoCode(promoInput.trim().toUpperCase());
    } catch (e: any) {
      setPromoErr(e?.response?.data?.detail || "Invalid promo code");
      setDiscount(0); setPromoCode("");
    } finally { setPromoLoading(false); }
  };

  const clearPromo = () => { setPromoCode(""); setPromoInput(""); setDiscount(0); setPromoErr(""); };

  const handleBuy = async () => {
    if (!canBuy || loading) return;
    setLoading(true);
    try {
      await buyProduct(product.id, promoCode, selectedVariant?.label ?? "", fieldAnswers);
      setDone(true);
      setTimeout(onSuccess, 1400);
    } catch (e: any) {
      window.Telegram?.WebApp?.showAlert(e?.response?.data?.detail || "Purchase failed");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full rounded-t-3xl flex flex-col gap-4 p-5 max-h-[90dvh] overflow-y-auto"
        style={{ background: "#161720", border: "1px solid rgba(255,255,255,0.07)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 rounded-full bg-white/10 mx-auto -mt-1 flex-shrink-0" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="w-9 h-9 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-white">{t.orderPlaced}</p>
              <p className="text-white/40 text-sm mt-1">{t.processingShortly}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Product name */}
            <div>
              {product.gameName && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">{product.gameName}</p>
              )}
              <p className="text-xl font-black text-white">{product.name}</p>
            </div>

            {/* Variant selector */}
            {hasVariants && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t.selectVariant}</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants!.map((v) => (
                    <button
                      key={v.label}
                      onClick={() => { setSelectedVariant(v); setDiscount(0); setPromoCode(""); setPromoInput(""); }}
                      className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-colors ${
                        selectedVariant?.label === v.label
                          ? "bg-blue-600 text-white"
                          : "bg-white/[0.05] text-white/60 border border-white/[0.08]"
                      }`}
                    >
                      {v.label}
                      <span className={`ml-2 text-[11px] ${selectedVariant?.label === v.label ? "text-blue-200" : "text-white/30"}`}>
                        {v.price.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Purchase fields */}
            {hasFields && (
              <div className="flex flex-col gap-3">
                {product.purchase_fields!.map((f) => (
                  <div key={f.label} className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                      {f.label}{f.required && <span className="text-red-400 ml-1">*</span>}
                    </p>
                    <input
                      value={fieldAnswers[f.label] ?? ""}
                      onChange={(e) => setFieldAnswers({ ...fieldAnswers, [f.label]: e.target.value })}
                      placeholder={f.label}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/40 transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Price block — only show when variant is selected or no variants */}
            {(!hasVariants || selectedVariant) && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2 text-white/40 text-sm"><ShoppingCart className="w-4 h-4" /> {t.price}</div>
                  <div className="flex items-center gap-2">
                    {discount > 0 && <span className="text-[12px] line-through text-white/25">{basePrice.toLocaleString()}</span>}
                    <span className="font-black text-blue-400">{finalPrice.toLocaleString()} sum</span>
                  </div>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm"><Tag className="w-4 h-4" /> {promoCode}</div>
                    <span className="text-emerald-400 font-bold text-sm">-{discount.toLocaleString()} sum</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2 text-white/40 text-sm"><Wallet className="w-4 h-4" /> {t.balance}</div>
                  <span className={`font-bold text-sm ${canAfford ? "text-emerald-400" : "text-red-400"}`}>{balance.toLocaleString()} sum</span>
                </div>
              </div>
            )}

            {/* Promo */}
            {(!hasVariants || selectedVariant) && (
              promoCode ? (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/5">
                  <Tag className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="flex-1 text-sm font-mono font-bold text-emerald-400 tracking-widest">{promoCode}</span>
                  <button onClick={clearPromo}><X className="w-4 h-4 text-emerald-400/60" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoErr(""); }}
                    onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                    placeholder={t.promoCode}
                    className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none font-mono uppercase tracking-widest focus:border-blue-500/40 transition-colors"
                  />
                  <button onClick={applyPromo} disabled={!promoInput.trim() || promoLoading}
                    className="px-3 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/20 text-blue-400 text-sm font-bold active:opacity-70 disabled:opacity-30">
                    {t.apply}
                  </button>
                </div>
              )
            )}
            {promoErr && (
              <div className="flex items-center gap-2 text-red-400 text-[12px]">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {promoErr}
              </div>
            )}

            {!canAfford && (!hasVariants || selectedVariant) && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/15">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{t.insufficientBalance}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleBuy}
                disabled={!canBuy || loading}
                className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-opacity active:opacity-70 disabled:opacity-30"
                style={{ background: canBuy ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "#1f1f2a" }}
              >
                {loading ? t.processingShortly : canBuy ? `${t.confirm} · ${finalPrice.toLocaleString()} sum` : hasVariants && !selectedVariant ? t.pickVariant : t.confirm}
              </button>
              <button onClick={onClose} className="w-full py-2.5 text-sm text-white/25 font-semibold active:text-white/50">{t.cancel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
