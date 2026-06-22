import { useEffect, useState, useRef } from "react";
import { Grid2x2, MessageCircle, User, Bell } from "lucide-react";
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
import NotificationSheet, { useNotifications } from "./pages/NotificationSheet";

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

  const [showNotifications, setShowNotifications] = useState(false);
  const { notifs, unreadCount, markAllRead, addTopupExpired } = useNotifications(
    (orderId) => setReviewOrderId(orderId),
  );

  useEffect(() => {
    getMe().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Pending topup indicator timer — only active on main screen
  useEffect(() => {
    if (showTopup) {
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
        addTopupExpired();
      } else {
        setPendingTimeLeft(left);
      }
    };

    tick();
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
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid rgba(249,115,22,0.15)", borderTopColor: "#F97316" }} />
      </div>
    );
  }

  if (isAdmin) return <AdminPage />;
  if (isSupportAgent) return <SupportAgentPage />;

  if (showTopup) {
    return (
      <div className="min-h-dvh p-4 pb-8" style={{ background: "var(--bg, #07080F)" }}>
        <TopupPage onBack={() => { setShowTopup(false); refreshUser(); }} />
      </div>
    );
  }

  const hasPending = pendingTimeLeft > 0;
  const timerUrgent = pendingTimeLeft < 120;
  const timerWarn   = pendingTimeLeft < 300;

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--bg, #07080F)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
        style={{
          background: "var(--bg-raised, #0D1020)",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg,#F97316,#EA580C)",
              boxShadow: "0 0 16px rgba(249,115,22,0.4)",
            }}
          >
            <Grid2x2 className="w-4 h-4 text-white" />
          </div>
          <span
            className="font-black text-[16px] tracking-tight"
            style={{
              background: "linear-gradient(135deg,#F97316,#FB923C)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Doonya Shop
          </span>
        </div>
        {user && (
          <button
            onClick={() => setShowTopup(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
            style={{
              background: "rgba(34,211,238,0.10)",
              border: "1px solid rgba(34,211,238,0.20)",
            }}
          >
            <span className="text-xs font-black" style={{ color: "#22D3EE" }}>
              {user.balance.toLocaleString()} sum
            </span>
          </button>
        )}
      </header>

      {/* Pending topup indicator */}
      {hasPending && (
        <button
          onClick={openPendingTopup}
          className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-75 relative overflow-hidden"
          style={{
            background: timerUrgent
              ? "rgba(239,68,68,0.10)"
              : timerWarn
              ? "rgba(234,179,8,0.10)"
              : "rgba(249,115,22,0.10)",
            border: `1px solid ${timerUrgent ? "rgba(239,68,68,0.30)" : timerWarn ? "rgba(234,179,8,0.30)" : "rgba(249,115,22,0.30)"}`,
          }}
        >
          <div className="relative flex-shrink-0 w-9 h-9">
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                background: timerUrgent ? "rgba(239,68,68,0.25)" : timerWarn ? "rgba(234,179,8,0.25)" : "rgba(249,115,22,0.25)",
              }}
            />
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{
                background: timerUrgent ? "rgba(239,68,68,0.20)" : timerWarn ? "rgba(234,179,8,0.20)" : "rgba(249,115,22,0.20)",
              }}
            >
              <span className="text-base">⏳</span>
            </div>
          </div>
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
        className="fixed bottom-0 left-0 right-0 pb-safe"
        style={{
          background: "rgba(7,8,15,0.96)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex">
          {NAV.map(({ id, Icon, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
              >
                <div
                  className="flex items-center justify-center transition-all"
                  style={active ? {
                    background: "rgba(249,115,22,0.15)",
                    borderRadius: 20,
                    padding: "4px 14px",
                  } : { padding: "4px 14px" }}
                >
                  <Icon className="w-4 h-4" style={{ color: active ? "#F97316" : "rgba(240,242,250,0.25)" }} />
                </div>
                <span className="text-[10px] font-bold tracking-wide" style={{ color: active ? "#F97316" : "rgba(240,242,250,0.20)" }}>
                  {label}
                </span>
              </button>
            );
          })}

          {/* Notifications bell */}
          <button
            onClick={() => { setShowNotifications(true); markAllRead(); }}
            className="flex-1 flex flex-col items-center gap-1 py-3 relative"
          >
            <div className="relative flex items-center justify-center" style={{ padding: "4px 14px" }}>
              <Bell className="w-4 h-4" style={{ color: "rgba(240,242,250,0.25)" }} />
              {unreadCount > 0 && (
                <div
                  className="absolute -top-1 -right-0 min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5"
                  style={{ background: "#EF4444" }}
                >
                  <span className="text-[8px] font-black text-white leading-none">{unreadCount > 9 ? "9+" : unreadCount}</span>
                </div>
              )}
            </div>
            <span className="text-[10px] font-bold tracking-wide" style={{ color: "rgba(240,242,250,0.20)" }}>Уведомления</span>
          </button>
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

      {/* Review sheet */}
      {reviewOrderId && !isAdmin && (
        <ReviewSheet
          orderId={reviewOrderId}
          onClose={() => setReviewOrderId(null)}
        />
      )}

      {/* Notification sheet */}
      <NotificationSheet
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifs={notifs}
        onReviewOrder={(orderId) => { setReviewOrderId(orderId); }}
      />
    </div>
  );
}
