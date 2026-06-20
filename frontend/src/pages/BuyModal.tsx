import { useState } from "react";
import { ShoppingCart, Wallet, AlertCircle, Check } from "lucide-react";
import { buyProduct } from "../api";

interface Product { id: string; name: string; price: number; gameName?: string }
interface Props {
  product: Product;
  balance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BuyModal({ product, balance, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const canAfford = balance >= product.price;

  const handleBuy = async () => {
    if (!canAfford || loading) return;
    setLoading(true);
    try {
      await buyProduct(product.id);
      setDone(true);
      setTimeout(() => { onSuccess(); }, 1400);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Purchase failed";
      window.Telegram?.WebApp?.showAlert(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full rounded-t-3xl p-6 flex flex-col gap-5"
        style={{ background: "#1a1b1f", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-white/10 mx-auto -mt-2" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-white">Order placed!</p>
              <p className="text-white/50 text-sm mt-1">We'll process it shortly</p>
            </div>
          </div>
        ) : (
          <>
            {/* Product info */}
            <div>
              {product.gameName && (
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-1">
                  {product.gameName}
                </p>
              )}
              <p className="text-xl font-black text-white">{product.name}</p>
            </div>

            {/* Price rows */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <ShoppingCart className="w-4 h-4" />
                  Price
                </div>
                <span className="font-black text-violet-400 text-base">
                  {product.price.toLocaleString()} sum
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Wallet className="w-4 h-4" />
                  Your balance
                </div>
                <span className={`font-bold text-sm ${canAfford ? "text-emerald-400" : "text-red-400"}`}>
                  {balance.toLocaleString()} sum
                </span>
              </div>
            </div>

            {!canAfford && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/15">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">Insufficient balance. Top up to continue.</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleBuy}
                disabled={!canAfford || loading}
                className="w-full py-3.5 rounded-xl font-black text-sm transition-opacity active:opacity-70 disabled:opacity-30"
                style={{ background: canAfford ? "linear-gradient(135deg, #7C3AED, #4F46E5)" : "#2a2a2a", color: "white" }}
              >
                {loading ? "Processing..." : "Confirm Purchase"}
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white/40 active:text-white/70"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
