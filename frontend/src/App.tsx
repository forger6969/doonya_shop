import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { getMe } from "./api";
import CatalogPage from "./pages/CatalogPage";
import ProfilePage from "./pages/ProfilePage";
import TopupPage from "./pages/TopupPage";
import AdminPage from "./pages/AdminPage";
import BuyModal from "./pages/BuyModal";

type Tab = "catalog" | "profile" | "admin";

interface User { user_id: number; balance: number; first_name: string }
interface Product { id: string; name: string; price: number }

const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_ID || "6299152655");

export default function App() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [showTopup, setShowTopup] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
  }, []);

  const refreshUser = () => getMe().then(setUser).catch(() => {});
  const isAdmin = user?.user_id === ADMIN_ID;

  // Admin panel takes over the full screen — no header/nav from main app
  if (tab === "admin" && isAdmin) {
    return (
      <div className="min-h-dvh">
        <AdminPage />
        <button
          onClick={() => setTab("catalog")}
          className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center active:opacity-70 z-50"
        >
          <Settings className="w-4 h-4 text-amber-400 rotate-45" />
        </button>
      </div>
    );
  }

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
        <h1 className="text-xl font-bold">Nyx Shop</h1>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm text-purple-400 font-semibold">
              {user.balance.toLocaleString()} sum
            </span>
          )}
          {isAdmin && (
            <button onClick={() => setTab("admin")}
              className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center active:opacity-70">
              <Settings className="w-4 h-4 text-amber-400" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24 overflow-y-auto">
        {tab === "catalog" && <CatalogPage onBuy={(p) => setBuyProduct(p)} />}
        {tab === "profile" && <ProfilePage onTopup={() => setShowTopup(true)} />}
      </div>

      {/* Bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 flex border-t border-white/10 pb-safe"
        style={{ background: "var(--tg-secondary)" }}
      >
        {([
          { id: "catalog", label: "Catalogue" },
          { id: "profile", label: "Profile" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
              tab === t.id ? "text-purple-400" : "text-white/40"
            }`}
            onClick={() => setTab(t.id)}
          >
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
