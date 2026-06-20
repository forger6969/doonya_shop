import { useEffect, useState } from "react";
import { Grid2x2, Wallet, User, Settings } from "lucide-react";
import { getMe } from "./api";
import CatalogPage from "./pages/CatalogPage";
import ProfilePage from "./pages/ProfilePage";
import TopupPage from "./pages/TopupPage";
import AdminPage from "./pages/AdminPage";
import BuyModal from "./pages/BuyModal";

type Tab = "catalog" | "profile";

interface User { user_id: number; balance: number; first_name: string }
interface Product { id: string; name: string; price: number; gameName: string }

const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_ID || "6299152655");

export default function App() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [showTopup, setShowTopup] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
  }, []);

  const refreshUser = () => getMe().then(setUser).catch(() => {});
  const isAdmin = user?.user_id === ADMIN_ID;

  // Admin full-screen overlay
  if (showAdmin && isAdmin) {
    return (
      <div className="min-h-dvh">
        <AdminPage />
        <button
          onClick={() => setShowAdmin(false)}
          className="fixed bottom-5 right-4 w-10 h-10 rounded-full bg-amber-400/15 border border-amber-400/25 flex items-center justify-center active:opacity-70 z-50"
          title="Exit admin"
        >
          <X12 />
        </button>
      </div>
    );
  }

  // Topup full-screen overlay
  if (showTopup) {
    return (
      <div className="min-h-dvh p-4 pb-8">
        <TopupPage onBack={() => { setShowTopup(false); refreshUser(); }} />
      </div>
    );
  }

  const NAV = [
    { id: "catalog" as Tab, icon: Grid2x2, label: "Catalogue" },
    { id: "profile" as Tab, icon: User,    label: "Profile" },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Grid2x2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-base tracking-tight text-white">Nyx Shop</span>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={() => setShowTopup(true)}
              className="flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/25 rounded-full px-3 py-1.5 active:opacity-70"
            >
              <Wallet className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-bold text-violet-300">
                {user.balance.toLocaleString()} sum
              </span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              className="w-8 h-8 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center active:opacity-70"
            >
              <Settings className="w-4 h-4 text-amber-400" />
            </button>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {tab === "catalog" && (
          <CatalogPage
            onBuy={(p) => setBuyProduct(p)}
            onTopup={() => setShowTopup(true)}
          />
        )}
        {tab === "profile" && (
          <ProfilePage onTopup={() => setShowTopup(true)} />
        )}
      </div>

      {/* ── Bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 pb-safe border-t border-white/[0.06]"
        style={{ background: "rgba(17,17,19,0.95)", backdropFilter: "blur(20px)" }}>
        <div className="flex">
          {NAV.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors"
            >
              <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
                tab === id ? "bg-violet-600" : ""
              }`}>
                <Icon className={`w-4 h-4 transition-colors ${tab === id ? "text-white" : "text-white/30"}`} />
              </div>
              <span className={`text-[10px] font-semibold transition-colors ${tab === id ? "text-violet-400" : "text-white/25"}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Buy modal ── */}
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

// tiny X icon for admin exit button
function X12() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 1l10 10M11 1L1 11" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
