import { useState } from "react";
import { buyProduct } from "../api";


interface Product { id: string; name: string; price: number }
interface Props {
  product: Product;
  balance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BuyModal({ product, balance, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const canAfford = balance >= product.price;

  const handleBuy = async () => {
    if (!canAfford) return;
    setLoading(true);
    try {
      await buyProduct(product.id);
      window.Telegram?.WebApp?.showAlert(`✅ Заказ оформлен! Ожидайте доставки.`);
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Ошибка покупки";
      window.Telegram?.WebApp?.showAlert(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div
        className="w-full card rounded-b-none rounded-t-3xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
        <h3 className="text-lg font-bold">{product.name}</h3>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Цена</span>
          <span className="font-bold text-purple-400">{product.price.toLocaleString()} сум</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Ваш баланс</span>
          <span className={`font-bold ${canAfford ? "text-green-400" : "text-red-400"}`}>
            {balance.toLocaleString()} сум
          </span>
        </div>
        {!canAfford && (
          <p className="text-red-400 text-sm text-center">
            Недостаточно средств. Пополните баланс.
          </p>
        )}
        <button
          className="btn-primary"
          disabled={!canAfford || loading}
          onClick={handleBuy}
        >
          {loading ? "Оформление..." : canAfford ? "Подтвердить покупку" : "Пополнить баланс"}
        </button>
        <button className="btn-outline" onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}
