import { useEffect, useState, useRef } from "react";
import { Grid2x2, MessageCircle, User } from "lucide-react";
import { getMe } from "./api";
import { useLang } from "./i18n";
import CatalogPage from "./pages/CatalogPage";
import ProfilePage from "./pages/ProfilePage";
import SupportPage from "./pages/SupportPage";
import SupportAgentPage from "./pages/SupportAgentPage";
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

const ADMIN_IDS = new Set([
  Number(import.meta.env.VITE_ADMIN_ID || "6299152655"),
  7004667100,
]);

const SUPPORT_AGENT_IDS = new Set([1771984046, 8235243143]);

const TOPUP_SESSION_KEY = "topup_pending";
const TOPUP_SESSION_VERSION = 2;

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function readPendingSession(): { expiresAt: number } | null {
  try {
    const raw = localStorage.getItem(TOPUP_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.v || s.v < TOPUP_SESSION_VERSION) { localStorage.removeItem(TOPUP_SESSION_KEY); return null; }
    if (s.expiresAt <= Date.now()) { localStorage.removeItem(TOPUP_SESSION_KEY); return null; }
    return { expiresAt: s.expiresAt };
  } catch {
    return null;
  }
}

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
  const [pendingTimeLeft, setPendingTimeLeft] = useState(0);
  const pendingTimerRef = useRef<number>(0);

  const [reviewOrderId, setReviewOrderId] = useState<string | null>(() => {
    const param = new URLSearchParams(window.location.search).get("review");
    if (param) window.history.replaceState({}, "", window.location.pathname);
    return param;
  });

  useEffect(() => {
    getMe().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Pending topup indicator timer — only active on main screen
  useEffect(() => {
    if (showTopup) {
      // TopupPage owns the timer; stop ours
      window.clearInterval(pendingTimerRef.current);
      setPendingTimeLeft(0);
      return;
    }

    const session = readPendingSession();
    if (!session) { setPendingTimeLeft(0); return; }

    const tick = () => {
      const left = Math.floor((session.expiresAt - Date.now()) / 1000);
      if (left <= 0) {
        window.clearInterval(pendingTimerRef.current);
        localStorage.removeItem(TOPUP_SESSION_KEY);
        setPendingTimeLeft(0);
      } else {
        setPendingTimeLeft(left);
      }
    };

    tick(); // immediate first update
    pendingTimerRef.current = window.setInterval(tick, 1000);
    return () => window.clearInterval(pendingTimerRef.current);
  }, [showTopup]);

  const refreshUser = () => getMe().then(setUser).catch(() => {});
  const isAdmin = user?.user_id != null && ADMIN_IDS.has(user.user_id);
  const isSupportAgent = user?.user_id != null && SUPPORT_AGENT_IDS.has(user.user_id);

  const openPendingTopup = () => setShowTopup(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin) return <AdminPage />;
  if (isSupportAgent) return <SupportAgentPage />;

  if (showTopup) {
    return (
      <div className="min-h-dvh p-4 pb-8">
        <TopupPage onBack={() => { setShowTopup(false); refreshUser(); }} />
      </div>
    );
  }

  const hasPending = pendingTimeLeft > 0;
  const timerUrgent = pendingTimeLeft < 120;
  const timerWarn   = pendingTimeLeft < 300;

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

      {/* Pending topup indicator */}
      {hasPending && (
        <button
          onClick={openPendingTopup}
          className="mx-4 mb-2 flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-75 relative overflow-hidden"
          style={{
            background: timerUrgent
              ? "rgba(239,68,68,0.10)"
              : timerWarn
              ? "rgba(234,179,8,0.10)"
              : "rgba(251,146,60,0.10)",
            border: `1px solid ${timerUrgent ? "rgba(239,68,68,0.30)" : timerWarn ? "rgba(234,179,8,0.30)" : "rgba(251,146,60,0.30)"}`,
          }}
        >
          {/* Pulsing circle */}
          <div className="relative flex-shrink-0 w-9 h-9">
            {/* Ping ring */}
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                background: timerUrgent ? "rgba(239,68,68,0.25)" : timerWarn ? "rgba(234,179,8,0.25)" : "rgba(251,146,60,0.25)",
              }}
            />
            {/* Solid circle */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{
                background: timerUrgent ? "rgba(239,68,68,0.20)" : timerWarn ? "rgba(234,179,8,0.20)" : "rgba(251,146,60,0.20)",
              }}
            >
              <span className="text-base">⏳</span>
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 text-left min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: timerUrgent ? "#f87171" : timerWarn ? "#facc15" : "#fb923c" }}>
              Незавершённое пополнение
            </p>
            <p className="font-black text-white text-sm mt-0.5">
              {fmtTime(pendingTimeLeft)}{" "}
              <span className="font-normal text-white/40 text-xs">осталось</span>
            </p>
          </div>

          {/* Arrow */}
          <span className="text-lg font-bold flex-shrink-0"
            style={{ color: timerUrgent ? "#f87171" : timerWarn ? "#facc15" : "#fb923c" }}>
            ›
          </span>
        </button>
      )}

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
