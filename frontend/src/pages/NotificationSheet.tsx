import { useEffect, useRef, useState } from "react";
import { X, CheckCircle, XCircle, Clock, ShoppingBag, Bell } from "lucide-react";
import { getNotifyWsUrl } from "../api";

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
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveNotifications(notifs: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, MAX_NOTIFS)));
}

export function makeNotification(type: NotifType, extra?: { order_id?: string; amount?: number; product_name?: string }): AppNotification {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ts = Date.now();

  if (type === "order_ready") {
    return {
      id, type, ts, read: false,
      title: "Заказ выполнен ✅",
      body: extra?.product_name ? `Ваш заказ «${extra.product_name}» готов! Оцените покупку.` : "Ваш заказ готов! Оцените покупку.",
      order_id: extra?.order_id,
    };
  }
  if (type === "topup_confirmed") {
    return {
      id, type, ts, read: false,
      title: "Баланс пополнен 💰",
      body: extra?.amount ? `На ваш счёт зачислено ${extra.amount.toLocaleString()} сум.` : "Пополнение успешно подтверждено.",
    };
  }
  if (type === "topup_rejected") {
    return {
      id, type, ts, read: false,
      title: "Пополнение отклонено ❌",
      body: "Ваше пополнение не было подтверждено. Обратитесь в поддержку.",
    };
  }
  // topup_expired
  return {
    id, type, ts, read: false,
    title: "Время истекло ⏱",
    body: "Срок ожидания пополнения истёк. Чек не был загружен вовремя.",
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(onOrderReady: (orderId: string) => void) {
  const [notifs, setNotifs] = useState<AppNotification[]>(loadNotifications);
  const wsRef = useRef<WebSocket | null>(null);
  // Tracks order IDs for which ReviewSheet was already opened (persisted across reconnects)
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

  // WS connection — persistent
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
            order_id: msg.order_id,
            amount: msg.amount,
            product_name: msg.product_name,
          });
          setNotifs((prev) => {
            if (
              msg.type === "order_ready" &&
              msg.order_id &&
              prev.some((n) => n.type === "order_ready" && n.order_id === msg.order_id)
            ) {
              return prev;
            }
            const next = [notif, ...prev].slice(0, MAX_NOTIFS);
            saveNotifications(next);
            return next;
          });
          // Only open ReviewSheet if user hasn't reviewed this order yet
          if (msg.type === "order_ready" && msg.order_id && !reviewedRef.current.has(msg.order_id)) {
            onOrderReady(msg.order_id);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        reconnectTimer = window.setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  return { notifs, unreadCount, markAllRead, addTopupExpired };
}

// ── UI ────────────────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: NotifType }) {
  if (type === "order_ready") return <ShoppingBag className="w-5 h-5 text-pink-400" />;
  if (type === "topup_confirmed") return <CheckCircle className="w-5 h-5 text-emerald-400" />;
  if (type === "topup_rejected") return <XCircle className="w-5 h-5 text-red-400" />;
  return <Clock className="w-5 h-5 text-amber-400" />;
}

function notifIconBg(type: NotifType): string {
  if (type === "order_ready") return "rgba(236,72,153,0.12)";
  if (type === "topup_confirmed") return "rgba(16,185,129,0.10)";
  if (type === "topup_rejected") return "rgba(239,68,68,0.10)";
  return "rgba(245,158,11,0.10)";
}

function fmtTs(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "только что";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

interface Props {
  open: boolean;
  onClose: () => void;
  notifs: AppNotification[];
  onReviewOrder: (orderId: string) => void;
}

export default function NotificationSheet({ open, onClose, notifs, onReviewOrder }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col transition-transform duration-300 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}
        style={{
          maxHeight: "80dvh",
          background: "#100D1E",
          borderTop: "1px solid rgba(168,85,247,0.15)",
          borderRadius: "20px 20px 0 0",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" style={{ color: "rgba(240,242,250,0.4)" }} />
            <p className="text-[15px] font-black text-white">Уведомления</p>
            {notifs.filter((n) => !n.read).length > 0 && (
              <div className="rounded-full px-2 py-0.5"
                style={{ background: "linear-gradient(135deg,#EC4899,#A855F7)" }}>
                <span className="text-[10px] font-black text-white">{notifs.filter((n) => !n.read).length}</span>
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center active:opacity-70"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <X className="w-3.5 h-3.5" style={{ color: "rgba(240,242,250,0.45)" }} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16"
              style={{ color: "rgba(240,242,250,0.2)" }}>
              <Bell className="w-10 h-10" />
              <p className="text-sm">Уведомлений пока нет</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-white/[0.04]">
              {notifs.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-4 ${!n.read ? "bg-white/[0.02]" : ""}`}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: notifIconBg(n.type) }}>
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-bold text-white leading-tight">{n.title}</p>
                      <span className="text-[10px] flex-shrink-0 mt-0.5"
                        style={{ color: "rgba(240,242,250,0.25)" }}>{fmtTs(n.ts)}</span>
                    </div>
                    <p className="text-[12px] mt-0.5 leading-snug"
                      style={{ color: "rgba(240,242,250,0.45)" }}>{n.body}</p>
                    {n.type === "order_ready" && n.order_id && (
                      <button
                        onClick={() => { onReviewOrder(n.order_id!); onClose(); }}
                        className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold active:opacity-70"
                        style={{
                          background: "rgba(236,72,153,0.12)",
                          border: "1px solid rgba(236,72,153,0.25)",
                          color: "#F9A8D4",
                        }}
                      >
                        Оставить отзыв →
                      </button>
                    )}
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: "#EC4899" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Safe area bottom */}
        <div className="pb-safe flex-shrink-0 h-4" />
      </div>
    </>
  );
}
