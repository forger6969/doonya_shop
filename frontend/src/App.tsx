import { useEffect, useState } from "react";
import { Grid2x2, Wallet, User } from "lucide-react";
import { getMe } from "./api";
import CatalogPage from "./pages/CatalogPage";
import ProfilePage from "./pages/ProfilePage";
import TopupPage from "./pages/TopupPage";
import AdminPage from "./pages/AdminPage";
import BuyModal from "./pages/BuyModal";

type Tab = "catalog" | "profile";
interface UserT { user_id: number; balance: number; first_name: string }
interface Product { id: string; name: string; price: number; gameName?: string }

const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_ID || "6299152655");

export default function App() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [showTopup, setShowTopup] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<UserT | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const refreshUser = () => getMe().then(setUser).catch(() => {});
  const isAdmin = user?.user_id === ADMIN_ID;

  // Loading splash
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Admin → always show admin panel, no user UI
  if (isAdmin) return <AdminPage />;

  // Topup screen
  if (showTopup) {
    return (
      <div className="min-h-dvh p-4 pb-8">
        <TopupPage onBack={() => { setShowTopup(false); refreshUser(); }} />
      </div>
    );
  }

  const NAV = [
    { id: "catalog" as Tab, Icon: Grid2x2, label: "Shop" },
    { id: "profile" as Tab, Icon: User, label: "Profile" },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Grid2x2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-[15px] tracking-tight text-white">Nyx Shop</span>
        </div>
        {user && (
          <button onClick={() => setShowTopup(true)}
            className="flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/20 rounded-full px-3 py-1.5 active:opacity-70">
            <Wallet className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-black text-violet-300">{user.balance.toLocaleString()} sum</span>
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {tab === "catalog" && (
          <CatalogPage onBuy={setBuyProduct} onTopup={() => setShowTopup(true)} />
        )}
        {tab === "profile" && (
          <ProfilePage onTopup={() => setShowTopup(true)} />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 pb-safe border-t border-white/[0.06]"
        style={{ background: "rgba(10,10,12,0.96)", backdropFilter: "blur(24px)" }}>
        <div className="flex">
          {NAV.map(({ id, Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors">
              <div className={`w-8 h-6 flex items-center justify-center rounded-lg transition-colors ${tab === id ? "bg-violet-600/90" : ""}`}>
                <Icon className={`w-4 h-4 ${tab === id ? "text-white" : "text-white/25"}`} />
              </div>
              <span className={`text-[10px] font-bold tracking-wide ${tab === id ? "text-violet-400" : "text-white/20"}`}>{label}</span>
            </button>
          ))}
        </div>
      </nav>

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
