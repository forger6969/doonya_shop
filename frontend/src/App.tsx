import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { getMe } from "./api";
import CatalogPage from "./pages/CatalogPage";
import ProfilePage from "./pages/ProfilePage";
import TopupPage from "./pages/TopupPage";
import BuyModal from "./pages/BuyModal";

type Tab = "catalog" | "profile";

interface User { balance: number; first_name: string }
interface Product { id: string; name: string; price: number }

export default function App() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [showTopup, setShowTopup] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    getMe().then(setUser).catch(() => {});
  }, []);

  const refreshUser = () => getMe().then(setUser).catch(() => {});

  if (showTopup) {
    return (
      <div className="p-4 pb-8 min-h-dvh">
        <TopupPage onBack={() => { setShowTopup(false); refreshUser(); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">🎮 Nyx Shop</h1>
        {user && (
          <span className="text-sm text-purple-400 font-semibold">
            {user.balance.toLocaleString()} сум
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24 overflow-y-auto">
        {tab === "catalog" ? (
          <CatalogPage onBuy={(p) => setBuyProduct(p)} />
        ) : (
          <ProfilePage onTopup={() => setShowTopup(true)} />
        )}
      </div>

      {/* Bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 flex border-t border-white/10 pb-safe"
        style={{ background: "var(--tg-secondary)" }}
      >
        {([
          { id: "catalog", icon: "🎮", label: "Каталог" },
          { id: "profile", icon: "👤", label: "Профиль" },
        ] as { id: Tab; icon: string; label: string }[]).map((t) => (
          <button
            key={t.id}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
              tab === t.id ? "text-purple-400" : "text-white/40"
            }`}
            onClick={() => setTab(t.id)}
          >
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Buy modal */}
      {buyProduct && user && (
        <BuyModal
          product={buyProduct}
          balance={user.balance}
          onClose={() => setBuyProduct(null)}
          onSuccess={() => { setBuyProduct(null); refreshUser(); }}
        />
      )}
    </div>
  );
}
