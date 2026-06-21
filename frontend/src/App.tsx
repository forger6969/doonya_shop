import { useEffect, useState } from "react";
import { Grid2x2, MessageCircle, User } from "lucide-react";
import { getMe } from "./api";
import { useLang } from "./i18n";
import CatalogPage from "./pages/CatalogPage";
import ProfilePage from "./pages/ProfilePage";
import SupportPage from "./pages/SupportPage";
import TopupPage from "./pages/TopupPage";
import AdminPage from "./pages/AdminPage";
import BuyModal from "./pages/BuyModal";
import ReviewSheet from "./pages/ReviewSheet";

type Tab = "catalog" | "support" | "profile";
interface UserT { user_id: number; balance: number; first_name: string }
interface Product {
  id: string; name: string; price: number; gameName?: string;
  variant_label?: string;
  variants?: { label: string; price: number }[];
  purchase_fields?: { label: string; required: boolean }[];
}

const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_ID || "6299152655");

export default function App() {
  const { t } = useLang();
  const NAV: { id: Tab; Icon: React.ElementType; label: string }[] = [
    { id: "catalog", Icon: Grid2x2, label: t.shop },
    { id: "support", Icon: MessageCircle, label: t.support },
    { id: "profile", Icon: User, label: t.profile },
  ];

  const [tab, setTab] = useState<Tab>("catalog");
  const [showTopup, setShowTopup] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<UserT | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(() => {
    const param = new URLSearchParams(window.location.search).get("review");
    if (param) window.history.replaceState({}, "", window.location.pathname);
    return param;
  });

  useEffect(() => {
    getMe().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const refreshUser = () => getMe().then(setUser).catch(() => {});
  const isAdmin = user?.user_id === ADMIN_ID;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin) return <AdminPage />;

  if (showTopup) {
    return (
      <div className="min-h-dvh p-4 pb-8">
        <TopupPage onBack={() => { setShowTopup(false); refreshUser(); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Grid2x2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-[15px] tracking-tight text-white">Doonya Shop</span>
        </div>
        {user && (
          <button
            onClick={() => setShowTopup(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
            style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}
          >
            <span className="text-xs font-black" style={{ color: "#93c5fd" }}>
              {user.balance.toLocaleString()} sum
            </span>
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {tab === "catalog" && (
          <CatalogPage onBuy={setBuyProduct} onTopup={() => setShowTopup(true)} />
        )}
        {tab === "support" && <SupportPage />}
        {tab === "profile" && <ProfilePage onTopup={() => setShowTopup(true)} />}
      </div>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 pb-safe border-t border-white/[0.06]"
        style={{ background: "rgba(10,10,14,0.96)", backdropFilter: "blur(24px)" }}
      >
        <div className="flex">
          {NAV.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
            >
              <div
                className={`w-8 h-6 flex items-center justify-center rounded-lg transition-colors ${
                  tab === id ? "bg-blue-600" : ""
                }`}
              >
                <Icon className={`w-4 h-4 ${tab === id ? "text-white" : "text-white/25"}`} />
              </div>
              <span
                className={`text-[10px] font-bold tracking-wide ${
                  tab === id ? "text-blue-400" : "text-white/20"
                }`}
              >
                {label}
              </span>
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

      {/* Review sheet (opened via bot notification deep link) */}
      {reviewOrderId && !isAdmin && (
        <ReviewSheet
          orderId={reviewOrderId}
          onClose={() => setReviewOrderId(null)}
        />
      )}
    </div>
  );
}
