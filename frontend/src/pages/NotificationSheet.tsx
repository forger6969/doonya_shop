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
          const notif = makeNotification(msg.type, {
            order_id: msg.order_id,
            amount: msg.amount,
            product_name: msg.product_name,
          });
          addNotif(notif);
          if (msg.type === "order_ready" && msg.order_id) {
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
  if (type === "order_ready") return <ShoppingBag className="w-5 h-5 text-blue-400" />;
  if (type === "topup_confirmed") return <CheckCircle className="w-5 h-5 text-green-400" />;
  if (type === "topup_rejected") return <XCircle className="w-5 h-5 text-red-400" />;
  return <Clock className="w-5 h-5 text-orange-400" />;
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
          background: "rgba(13,14,26,0.98)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px 20px 0 0",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-white/50" />
            <p className="text-[15px] font-black text-white">Уведомления</p>
            {notifs.filter((n) => !n.read).length > 0 && (
              <div className="bg-blue-600 rounded-full px-2 py-0.5">
                <span className="text-[10px] font-black text-white">{notifs.filter((n) => !n.read).length}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center active:opacity-70">
            <X className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-white/25">
              <Bell className="w-10 h-10" />
              <p className="text-sm">Уведомлений пока нет</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-white/[0.04]">
              {notifs.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-4 ${!n.read ? "bg-white/[0.03]" : ""}`}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-bold text-white leading-tight">{n.title}</p>
                      <span className="text-[10px] text-white/30 flex-shrink-0 mt-0.5">{fmtTs(n.ts)}</span>
                    </div>
                    <p className="text-[12px] text-white/50 mt-0.5 leading-snug">{n.body}</p>
                    {n.type === "order_ready" && n.order_id && (
                      <button
                        onClick={() => { onReviewOrder(n.order_id!); onClose(); }}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-[11px] font-bold text-blue-400 active:opacity-70"
                      >
                        Оставить отзыв →
                      </button>
                    )}
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
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
