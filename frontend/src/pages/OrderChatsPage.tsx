import { useEffect, useState } from "react";
import { MessageCircle, ShoppingBag, ChevronRight, RefreshCw } from "lucide-react";
import { getMyOrderChats, type AdminOrderChat } from "../api";

interface Props {
  onOpenChat: (orderId: string, productName?: string) => void;
}

function fmtTime(ts: string) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return "только что";
    if (diff < 3600) return `${Math.floor(diff / 60)} мин`;
    if (diff < 86400) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="w-11 h-11 rounded-xl s-shimmer flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-32 rounded-lg s-shimmer" />
        <div className="h-3 w-48 rounded-lg s-shimmer" />
      </div>
    </div>
  );
}

export default function OrderChatsPage({ onOpenChat }: Props) {
  const [chats, setChats] = useState<AdminOrderChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    getMyOrderChats()
      .then(setChats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-[18px] font-black" style={{ color: "var(--text)" }}>Чаты</h2>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Переписка с поддержкой по заказам
          </p>
        </div>
        {!loading && (
          <button onClick={load} className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60"
            style={{ background: "var(--bg-surface)" }}>
            <RefreshCw className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 s-fade-in">
          <MessageCircle className="w-10 h-10" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Не удалось загрузить чаты</p>
          <button onClick={load} className="text-sm font-bold px-4 py-2 rounded-xl active:opacity-70"
            style={{ background: "rgba(236,72,153,0.12)", color: "#EC4899" }}>
            Повторить
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && chats.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 s-fade-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.12)" }}>
            <MessageCircle className="w-8 h-8" style={{ color: "rgba(236,72,153,0.50)" }} />
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold text-[15px]" style={{ color: "var(--text)" }}>Нет чатов</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Чаты появятся после оформления заказа
            </p>
          </div>
        </div>
      )}

      {/* Chat list */}
      {!loading && !error && chats.length > 0 && (
        <div className="space-y-2.5 s-fade-in">
          {chats.map((chat) => {
            const unread = chat.unread_by_user || 0;
            return (
              <button
                key={chat.order_id}
                onClick={() => onOpenChat(chat.order_id, chat.product_name)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-left active:opacity-75 transition-opacity"
                style={{
                  background: unread > 0 ? "rgba(236,72,153,0.06)" : "var(--bg-surface)",
                  border: `1px solid ${unread > 0 ? "rgba(236,72,153,0.18)" : "var(--border)"}`,
                }}
              >
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(236,72,153,0.10)" }}>
                  <ShoppingBag className="w-5 h-5" style={{ color: "#EC4899" }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-[14px] truncate" style={{ color: "var(--text)" }}>
                      {chat.product_name || "Заказ"}
                    </p>
                    <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {fmtTime(chat.last_ts)}
                    </span>
                  </div>

                  {chat.game_name && (
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {chat.game_name}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[12px] truncate" style={{ color: "var(--text-dim)" }}>
                      {chat.last_message || "Нет сообщений"}
                    </p>
                    {unread > 0 && (
                      <div className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                        style={{ background: "#EC4899" }}>
                        <span className="text-[10px] font-black text-white leading-none">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
