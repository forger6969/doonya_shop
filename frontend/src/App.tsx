import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Grid2x2, MessageCircle, User, Bell, Moon, Sun } from "lucide-react";
import { getMe, getMyOrderChats } from "./api";
import { useLang } from "./i18n";
// Critical path — loaded immediately
import CatalogPage from "./pages/CatalogPage";
import ProfilePage from "./pages/ProfilePage";
import BuyModal from "./pages/BuyModal";
import NotificationSheet, { useNotifications } from "./pages/NotificationSheet";
import OrderChatSheet from "./pages/OrderChatSheet";
// Non-critical — lazy loaded
const SupportAgentPage  = lazy(() => import("./pages/SupportAgentPage"));
const OrderChatsPage    = lazy(() => import("./pages/OrderChatsPage"));
const TopupPage         = lazy(() => import("./pages/TopupPage"));
const AdminPage         = lazy(() => import("./pages/AdminPage"));
const ReviewSheet       = lazy(() => import("./pages/ReviewSheet"));

type Tab = "catalog" | "chats" | "profile";
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
const ACTIVE_ORDER_KEY = "doonya_active_order";

interface ActiveOrder { orderId: string; productName: string; amount: number; createdAt: number }

function saveActiveOrder(order: ActiveOrder) {
  localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(order));
}
function clearActiveOrder() {
  localStorage.removeItem(ACTIVE_ORDER_KEY);
}
function readActiveOrder(): ActiveOrder | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

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
    { id: "chats", Icon: MessageCircle, label: t.chats },
    { id: "profile", Icon: User, label: t.profile },
  ];

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("doonya_theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light-theme", !isDark);
    localStorage.setItem("doonya_theme", isDark ? "dark" : "light");
  }, [isDark]);

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

  const [orderChat, setOrderChat] = useState<{ orderId: string; productName?: string } | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(() => readActiveOrder());
  const [showOrderStatus, setShowOrderStatus] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifs, unreadCount, markAllRead, addTopupExpired } = useNotifications(
    (orderId) => setReviewOrderId(orderId),
  );

  useEffect(() => {
    getMe().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const refresh = () =>
      getMyOrderChats()
        .then((chats) =>
          setChatUnread(chats.reduce((s, c) => s + (c.unread_by_user || 0), 0))
        )
        .catch(() => {});
    refresh();
    const id = window.setInterval(refresh, 30000);
    return () => window.clearInterval(id);
  }, [user?.user_id]);

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
        <div className="w-8 h-8 rounded-full animate-spin"
          style={{ border: "2px solid rgba(34,197,94,0.15)", borderTopColor: "#22c55e" }} />
      </div>
    );
  }

  if (isAdmin) return <Suspense fallback={null}><AdminPage /></Suspense>;
  if (isSupportAgent) return <Suspense fallback={null}><SupportAgentPage /></Suspense>;

  if (showTopup) {
    return (
      <div className="min-h-dvh p-4 pb-8" style={{ background: "var(--bg, #0d0d0d)" }}>
        <Suspense fallback={null}>
          <TopupPage onBack={() => { setShowTopup(false); refreshUser(); }} />
        </Suspense>
      </div>
    );
  }

  const hasPending = pendingTimeLeft > 0;
  const timerUrgent = pendingTimeLeft < 120;
  const timerWarn   = pendingTimeLeft < 300;

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--bg, #0d0d0d)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
        style={{
          background: "var(--header-bg)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#22c55e" }}
          >
            <Grid2x2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-[16px] tracking-tight" style={{ color: "var(--text)" }}>
            Doonya Shop
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setIsDark((d) => !d)}
            className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-70 transition-all"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
          >
            {isDark
              ? <Sun className="w-4 h-4" style={{ color: "#f97316" }} />
              : <Moon className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
            }
          </button>

          {user && (
            <button
              onClick={() => setShowTopup(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
              style={{
                background: "rgba(34,197,94,0.10)",
                border: "1px solid rgba(34,197,94,0.22)",
              }}
            >
              <span className="text-xs font-black" style={{ color: "#22c55e" }}>
                {user.balance.toLocaleString()} sum
              </span>
            </button>
          )}
        </div>
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
              ? "rgba(249,115,22,0.10)"
              : "rgba(249,115,22,0.08)",
            border: `1px solid ${timerUrgent ? "rgba(239,68,68,0.28)" : "rgba(249,115,22,0.28)"}`,
          }}
        >
          <div className="relative flex-shrink-0 w-9 h-9">
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: timerUrgent ? "rgba(239,68,68,0.20)" : "rgba(249,115,22,0.20)" }}
            />
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{ background: timerUrgent ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)" }}
            >
              <span className="text-base">⏳</span>
            </div>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: timerUrgent ? "#ef4444" : "#f97316" }}>
              {t.pendingTopup}
            </p>
            <p className="font-black text-white text-sm mt-0.5">
              {fmtTime(pendingTimeLeft)}{" "}
              <span className="font-normal text-white/40 text-xs">{t.timeLeftLabel}</span>
            </p>
          </div>
          <span className="text-lg font-bold flex-shrink-0"
            style={{ color: timerUrgent ? "#ef4444" : "#f97316" }}>
            ›
          </span>
        </button>
      )}

      {/* Active order banner */}
      {activeOrder && (
        <button
          onClick={() => setShowOrderStatus(true)}
          className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-75"
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.20)",
          }}
        >
          <div className="relative flex-shrink-0 w-9 h-9">
            <div className="absolute inset-0 rounded-full animate-ping opacity-40"
              style={{ background: "rgba(34,197,94,0.25)" }} />
            <div className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.15)" }}>
              <span className="text-base">📦</span>
            </div>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#22c55e" }}>
              {t.activeOrder}
            </p>
            <p className="font-black text-white text-sm mt-0.5 truncate">{activeOrder.productName}</p>
          </div>
          <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "rgba(34,197,94,0.6)" }}>
            ›
          </span>
        </button>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {tab === "catalog" && (
          <CatalogPage onBuy={setBuyProduct} onTopup={() => setShowTopup(true)} />
        )}
        {tab === "chats" && (
          <Suspense fallback={null}>
            <OrderChatsPage onOpenChat={(orderId, productName) => setOrderChat({ orderId, productName })} />
          </Suspense>
        )}
        {tab === "profile" && (
          <ProfilePage
            onTopup={() => setShowTopup(true)}
            onOpenOrderChat={(orderId, productName) => setOrderChat({ orderId, productName })}
          />
        )}
      </div>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 pb-safe"
        style={{
          background: "var(--nav-bg)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="flex">
          {NAV.map(({ id, Icon, label }) => {
            const active = tab === id;
            const badge = id === "chats" && chatUnread > 0 ? chatUnread : 0;
            return (
              <button
                key={id}
                onClick={() => { setTab(id); if (id === "chats") setChatUnread(0); }}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
              >
                <div className="relative flex items-center justify-center transition-all"
                  style={active
                    ? { background: "rgba(34,197,94,0.12)", borderRadius: 20, padding: "4px 14px" }
                    : { padding: "4px 14px" }}
                >
                  <Icon className="w-4 h-4" style={{ color: active ? "#22c55e" : "var(--text-muted)" }} />
                  {badge > 0 && (
                    <div className="absolute -top-1 -right-0 min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5"
                      style={{ background: "#22c55e" }}>
                      <span className="text-[8px] font-black text-white leading-none">{badge > 9 ? "9+" : badge}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-bold tracking-wide"
                  style={{ color: active ? "#22c55e" : "var(--text-muted)" }}>
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
              <Bell className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              {unreadCount > 0 && (
                <div
                  className="absolute -top-1 -right-0 min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5"
                  style={{ background: "#22c55e" }}
                >
                  <span className="text-[8px] font-black text-white leading-none">{unreadCount > 9 ? "9+" : unreadCount}</span>
                </div>
              )}
            </div>
            <span className="text-[10px] font-bold tracking-wide" style={{ color: "var(--text-muted)" }}>
              {t.notifications}
            </span>
          </button>
        </div>
      </nav>

      {/* Buy modal */}
      {buyProduct && user && (
        <BuyModal
          product={buyProduct}
          balance={user.balance}
          onClose={() => setBuyProduct(null)}
          onSuccess={(orderId) => {
            if (orderId) {
              const order: ActiveOrder = {
                orderId,
                productName: buyProduct.name,
                amount: buyProduct.price,
                createdAt: Date.now(),
              };
              saveActiveOrder(order);
              setActiveOrder(order);
            }
            setBuyProduct(null);
            refreshUser();
          }}
        />
      )}

      {/* Review sheet */}
      {reviewOrderId && !isAdmin && (
        <Suspense fallback={null}>
          <ReviewSheet
            orderId={reviewOrderId}
            onClose={() => setReviewOrderId(null)}
          />
        </Suspense>
      )}

      {/* Order chat sheet */}
      {orderChat && (
        <OrderChatSheet
          orderId={orderChat.orderId}
          productName={orderChat.productName}
          onClose={() => setOrderChat(null)}
        />
      )}

      {/* Active order status modal */}
      {showOrderStatus && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowOrderStatus(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full rounded-t-3xl flex flex-col gap-4 p-5"
            style={{
              background: "#181818",
              borderTop: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "24px 24px 0 0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-white/10 mx-auto -mt-1" />

            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex-shrink-0">
                <div className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{ background: "rgba(34,197,94,0.35)" }} />
                <div className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.28)" }}>
                  <span className="text-2xl">📦</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#22c55e" }}>
                  {t.activeOrder}
                </p>
                <p className="font-black text-white text-lg leading-tight">{activeOrder.productName}</p>
              </div>
            </div>

            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}>
              <div className="w-8 h-8 rounded-full flex-shrink-0 animate-spin"
                style={{ border: "2px solid rgba(34,197,94,0.18)", borderTopColor: "#22c55e" }} />
              <div>
                <p className="text-sm font-bold text-white">{t.inProgress}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                  {t.orderAccepted}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-center font-mono" style={{ color: "rgba(255,255,255,0.20)" }}>
              ID: {activeOrder.orderId}
            </p>

            <button
              onClick={() => {
                setShowOrderStatus(false);
                setOrderChat({ orderId: activeOrder.orderId, productName: activeOrder.productName });
              }}
              className="w-full font-black text-[15px] text-white active:opacity-70"
              style={{
                padding: 16,
                borderRadius: 14,
                background: "#22c55e",
                boxShadow: "0 4px 20px rgba(34,197,94,0.28)",
              }}
            >
              {t.goToOrderChat}
            </button>

            <button
              onClick={() => {
                clearActiveOrder();
                setActiveOrder(null);
                setShowOrderStatus(false);
              }}
              className="w-full py-2.5 text-[13px] font-semibold active:opacity-50"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              {t.orderReceived}
            </button>
          </div>
        </div>
      )}

      <NotificationSheet
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifs={notifs}
        onReviewOrder={(orderId) => { setReviewOrderId(orderId); }}
      />
    </div>
  );
}
