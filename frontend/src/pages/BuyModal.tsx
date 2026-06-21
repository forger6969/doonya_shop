import { useState } from "react";
import { ShoppingCart, Wallet, Check, Tag, X, AlertCircle } from "lucide-react";
import { buyProduct, validatePromo } from "../api";

interface Product { id: string; name: string; price: number; gameName?: string }
interface Props { product: Product; balance: number; onClose: () => void; onSuccess: () => void }

export default function BuyModal({ product, balance, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoErr, setPromoErr] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const finalPrice = Math.max(0, product.price - discount);
  const canAfford = balance >= finalPrice;

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
    } finally {
      setPromoLoading(false);
    }
  };

  const clearPromo = () => { setPromoCode(""); setPromoInput(""); setDiscount(0); setPromoErr(""); };

  const handleBuy = async () => {
    if (!canAfford || loading) return;
    setLoading(true);
    try {
      await buyProduct(product.id, promoCode);
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
      <div className="relative w-full rounded-t-3xl flex flex-col gap-4 p-5"
        style={{ background: "#161720", border: "1px solid rgba(255,255,255,0.07)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="w-9 h-1 rounded-full bg-white/10 mx-auto -mt-1" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="w-9 h-9 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-white">Order placed!</p>
              <p className="text-white/40 text-sm mt-1">Processing shortly</p>
            </div>
          </div>
        ) : (
          <>
            {/* Product */}
            <div>
              {product.gameName && <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">{product.gameName}</p>}
              <p className="text-xl font-black text-white">{product.name}</p>
            </div>

            {/* Price block */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 text-white/40 text-sm"><ShoppingCart className="w-4 h-4" /> Price</div>
                <div className="flex items-center gap-2">
                  {discount > 0 && <span className="text-[12px] line-through text-white/25">{product.price.toLocaleString()}</span>}
                  <span className="font-black text-violet-400">{finalPrice.toLocaleString()} sum</span>
                </div>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm"><Tag className="w-4 h-4" /> Promo {promoCode}</div>
                  <span className="text-emerald-400 font-bold text-sm">-{discount.toLocaleString()} sum</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 text-white/40 text-sm"><Wallet className="w-4 h-4" /> Balance</div>
                <span className={`font-bold text-sm ${canAfford ? "text-emerald-400" : "text-red-400"}`}>{balance.toLocaleString()} sum</span>
              </div>
            </div>

            {/* Promo input */}
            {promoCode ? (
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
                  placeholder="Promo code"
                  className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none font-mono uppercase tracking-widest focus:border-violet-500/40 transition-colors"
                />
                <button onClick={applyPromo} disabled={!promoInput.trim() || promoLoading}
                  className="px-3 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/20 text-violet-400 text-sm font-bold active:opacity-70 disabled:opacity-30">
                  Apply
                </button>
              </div>
            )}
            {promoErr && (
              <div className="flex items-center gap-2 text-red-400 text-[12px]">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {promoErr}
              </div>
            )}

            {!canAfford && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/15">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">Insufficient balance. Top up to continue.</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col gap-2">
              <button onClick={handleBuy} disabled={!canAfford || loading}
                className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-opacity active:opacity-70 disabled:opacity-30"
                style={{ background: canAfford ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "#1f1f2a" }}>
                {loading ? "Processing..." : `Confirm · ${finalPrice.toLocaleString()} sum`}
              </button>
              <button onClick={onClose} className="w-full py-2.5 text-sm text-white/25 font-semibold active:text-white/50">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
