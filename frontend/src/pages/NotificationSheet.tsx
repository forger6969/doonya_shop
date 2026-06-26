import { useEffect, useRef, useState } from "react";
import { X, CheckCircle, XCircle, Clock, ShoppingBag, Bell } from "lucide-react";
import { getNotifyWsUrl } from "../api";
import { useLang } from "../i18n";

function getLang() { return (localStorage.getItem("lang") || "ru") as "ru" | "uz"; }
const NOTIF_STRINGS = {
  ru: {
    orderReady: "Заказ выполнен ✅", orderReadyBody: "Ваш заказ готов! Оцените покупку.",
    topupOk: "Баланс пополнен 💰", topupOkBody: "Пополнение успешно подтверждено.",
    topupFail: "Пополнение отклонено ❌", topupFailBody: "Ваше пополнение не было подтверждено. Обратитесь в поддержку.",
    expired: "Время истекло ⏱", expiredBody: "Срок ожидания пополнения истёк. Чек не был загружен вовремя.",
    orderReadyNamed: (n: string) => `Ваш заказ «${n}» готов! Оцените покупку.`,
    topupOkNamed: (a: number) => `На ваш счёт зачислено ${a.toLocaleString()} сум.`,
  },
  uz: {
    orderReady: "Buyurtma bajarildi ✅", orderReadyBody: "Buyurtmangiz tayyor! Iltimos, baholang.",
    topupOk: "Balans to'ldirildi 💰", topupOkBody: "To'ldirishingiz tasdiqlandi.",
    topupFail: "To'ldirish rad etildi ❌", topupFailBody: "To'ldirishingiz tasdiqlanmadi. Yordam bilan bog'laning.",
    expired: "Vaqt tugadi ⏱", expiredBody: "To'ldirish muddati tugadi. Chek o'z vaqtida yuklanmadi.",
    orderReadyNamed: (n: string) => `Buyurtmangiz «${n}» tayyor! Iltimos, baholang.`,
    topupOkNamed: (a: number) => `Hisobingizga ${a.toLocaleString()} so'm tushdi.`,
  },
};

export type NotifType = "order_ready" | "topup_confirmed" | "topup_rejected" | "topup_expired";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  order_id?: string;
  read: boolean;
  ts: number;
}

const STORAGE_KEY = "doonya_notifications";
const MAX_NOTIFS = 50;
const REVIEWED_KEY = "doonya_reviewed_orders";

function loadReviewedOrders(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(REVIEWED_KEY) || "[]")); }
  catch { return new Set(); }
}

export function markOrderReviewed(orderId: string) {
  try {
    const s = loadReviewedOrders();
    s.add(orderId);
    localStorage.setItem(REVIEWED_KEY, JSON.stringify([...s].slice(0, 200)));
  } catch {}
}

export function loadNotifications(): AppNotification[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

export function saveNotifications(notifs: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, MAX_NOTIFS)));
}

export function makeNotification(
  type: NotifType,
  extra?: { order_id?: string; amount?: number; product_name?: string },
): AppNotification {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ts = Date.now();
  const s = NOTIF_STRINGS[getLang()];
  if (type === "order_ready") {
    return { id, type, ts, read: false, title: s.orderReady,
      body: extra?.product_name ? s.orderReadyNamed(extra.product_name) : s.orderReadyBody,
      order_id: extra?.order_id };
  }
  if (type === "topup_confirmed") {
    return { id, type, ts, read: false, title: s.topupOk,
      body: extra?.amount ? s.topupOkNamed(extra.amount) : s.topupOkBody };
  }
  if (type === "topup_rejected") {
    return { id, type, ts, read: false, title: s.topupFail, body: s.topupFailBody };
  }
  return { id, type, ts, read: false, title: s.expired, body: s.expiredBody };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(onOrderReady: (orderId: string) => void) {
  const [notifs, setNotifs] = useState<AppNotification[]>(loadNotifications);
  const wsRef = useRef<WebSocket | null>(null);
  const reviewedRef = useRef<Set<string>>(loadReviewedOrders());

  const unreadCount = notifs.filter((n) => !n.read).length;

  const addNotif = (n: AppNotification) => {
    setNotifs((prev) => {
      const next = [n, ...prev].slice(0, MAX_NOTIFS);
      saveNotifications(next);
      return next;
    });
  };

  const markAllRead = () => {
    setNotifs((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(next);
      return next;
    });
  };

  const addTopupExpired = () => addNotif(makeNotification("topup_expired"));

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData ?? "";
    if (!initData) return;

    let ws: WebSocket;
    let reconnectTimer: number;

    const connect = () => {
      ws = new WebSocket(`${getNotifyWsUrl()}?initData=${encodeURIComponent(initData)}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const notif = makeNotification(msg.type as NotifType, {
            order_id: msg.order_id, amount: msg.amount, product_name: msg.product_name,
          });
          setNotifs((prev) => {
            if (msg.type === "order_ready" && msg.order_id &&
              prev.some((n) => n.type === "order_ready" && n.order_id === msg.order_id)) return prev;
            const next = [notif, ...prev].slice(0, MAX_NOTIFS);
            saveNotifications(next);
            return next;
          });
          if (msg.type === "order_ready" && msg.order_id && !reviewedRef.current.has(msg.order_id)) {
            onOrderReady(msg.order_id);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => { reconnectTimer = window.setTimeout(connect, 5000); };
      ws.onerror = () => { ws.close(); };
    };

    connect();
    return () => { clearTimeout(reconnectTimer); wsRef.current?.close(); };
  }, []);

  return { notifs, unreadCount, markAllRead, addTopupExpired };
}

// ── UI ────────────────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: NotifType }) {
  if (type === "order_ready")     return <ShoppingBag className="w-5 h-5 text-pink-400" />;
  if (type === "topup_confirmed") return <CheckCircle  className="w-5 h-5 text-emerald-400" />;
  if (type === "topup_rejected")  return <XCircle      className="w-5 h-5 text-red-400" />;
  return <Clock className="w-5 h-5 text-amber-400" />;
}

function notifAccent(type: NotifType) {
  if (type === "order_ready")     return { bg: "rgba(236,72,153,0.10)",  border: "rgba(236,72,153,0.10)" };
  if (type === "topup_confirmed") return { bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.18)" };
  if (type === "topup_rejected")  return { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.18)" };
  return                                 { bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.18)" };
}

function fmtTs(ts: number, t: ReturnType<typeof useLang>["t"]) {
  const diff = Date.now() - ts;
  if (diff < 60_000)     return t.justNow;
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} ${t.minAgo}`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ${t.hrAgo}`;
  const locale = getLang() === "uz" ? "uz-UZ" : "ru-RU";
  return new Date(ts).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

interface Props {
  open: boolean;
  onClose: () => void;
  notifs: AppNotification[];
  onReviewOrder: (orderId: string) => void;
}

export default function NotificationSheet({ open, onClose, notifs, onReviewOrder }: Props) {
  const { t } = useLang();
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setRender(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!render) return null;

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: visible ? "blur(4px)" : "blur(0px)",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        style={{
          maxHeight: "82dvh",
          background: "var(--bg-raised)",
          borderTop: "1px solid var(--border-card)",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.35)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          willChange: "transform",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--border-card)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <p className="text-[15px] font-black" style={{ color: "var(--text)" }}>{t.notifications}</p>
            {unread > 0 && (
              <div className="rounded-full px-2 py-0.5"
                style={{ background: "#EC4899" }}>
                <span className="text-[10px] font-black text-white">{unread}</span>
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center active:opacity-70 transition-opacity"
            style={{ background: "var(--bg-surface)" }}>
            <X className="w-3.5 h-3.5" style={{ color: "var(--text-dim)" }} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 s-fade-in"
              style={{ color: "var(--text-muted)" }}>
              <Bell className="w-10 h-10" />
              <p className="text-sm">{t.noNotifications}</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifs.map((n, i) => {
                const accent = notifAccent(n.type);
                return (
                  <div
                    key={n.id}
                    className="s-slide-up flex items-start gap-3 px-4 py-4"
                    style={{
                      animationDelay: `${Math.min(i * 35, 200)}ms`,
                      borderBottom: "1px solid var(--border)",
                      background: !n.read ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "transparent",
                    }}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: accent.bg, border: `1px solid ${accent.border}` }}>
                      <NotifIcon type={n.type} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-black leading-tight" style={{ color: "var(--text)" }}>{n.title}</p>
                        <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {fmtTs(n.ts, t)}
                        </span>
                      </div>
                      <p className="text-[12px] mt-1 leading-snug" style={{ color: "var(--text-dim)" }}>{n.body}</p>
                      {n.type === "order_ready" && n.order_id && (
                        <button
                          onClick={() => { onReviewOrder(n.order_id!); onClose(); }}
                          className="mt-2.5 px-3 py-1.5 rounded-lg text-[11px] font-bold active:opacity-70 transition-opacity"
                          style={{ background: "rgba(236,72,153,0.10)", border: "1px solid rgba(236,72,153,0.10)", color: "#EC4899" }}
                        >
                          {t.leaveReviewBtn}
                        </button>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: "#EC4899" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pb-safe flex-shrink-0 h-4" />
      </div>
    </>
  );
}
