import { useEffect, useRef, useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { getOrderChatWsUrl } from "../api";
import { useLang } from "../i18n";

interface ChatMsg { id: string; from: string; text: string; ts: string }

interface Props {
  orderId: string;
  productName?: string;
  onClose: () => void;
}

export default function OrderChatSheet({ orderId, productName, onClose }: Props) {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData || "";

    const connect = () => {
      if (!mountedRef.current) return;
      const url = `${getOrderChatWsUrl(orderId)}&initData=${encodeURIComponent(initData)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { if (mountedRef.current) setConnected(true); };
      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        reconnectRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => setConnected(false);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "history") {
            setMessages(data.messages || []);
          } else if (data.type === "message") {
            setMessages((prev) =>
              prev.find((m) => m.id === data.id) ? prev : [...prev, { id: data.id, from: data.from, text: data.text, ts: data.ts }]
            );
          }
        } catch { /* ignore */ }
      };
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [orderId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const send = () => {
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", text: text.trim() }));
    setText("");
  };

  const fmt = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.72)",
          backdropFilter: visible ? "blur(4px)" : "blur(0px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full rounded-t-3xl flex flex-col"
        style={{
          height: "80dvh",
          background: "var(--bg-raised)",
          border: "1px solid var(--border-card)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.40)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          willChange: "transform",
        }}
      >
        {/* Drag handle */}
        <div className="w-9 h-1 rounded-full mx-auto mt-3 flex-shrink-0"
          style={{ background: "var(--border-card)" }} />

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.12)" }}>
            <MessageCircle className="w-4 h-4" style={{ color: "#22c55e" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: "var(--text)" }}>
              {productName || t.order}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {connected ? t.connectedStatus : t.connectingStatus}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-70"
            style={{ background: "var(--bg-surface)" }}
          >
            <X className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 overscroll-contain">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16" style={{ color: "var(--text-muted)" }}>
              <MessageCircle className="w-10 h-10" style={{ opacity: 0.3 }} />
              <p className="text-sm text-center">
                {t.chatEmptyLine1}<br />{t.chatEmptyLine2}
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const isUser = msg.from === "user";
            return (
              <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={isUser
                    ? { background: "#22c55e", borderBottomRightRadius: 4 }
                    : { background: "var(--bg-surface)", border: "1px solid var(--border)", borderBottomLeftRadius: 4 }
                  }
                >
                  {!isUser && (
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "#22c55e" }}>
                      {t.support}
                    </p>
                  )}
                  <p className="break-words" style={{ color: "var(--text)" }}>{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${isUser ? "text-white/50 text-right" : ""}`}
                    style={!isUser ? { color: "var(--text-muted)" } : undefined}>
                    {fmt(msg.ts)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 flex items-end gap-2 flex-shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={t.writeMsgPlaceholder}
            rows={1}
            className="flex-1 s-input resize-none outline-none"
            style={{ maxHeight: 120, minHeight: 44 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || !connected}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-70 disabled:opacity-30"
            style={{ background: "#22c55e" }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
