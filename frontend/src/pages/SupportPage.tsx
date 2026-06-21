import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { getSupportWsUrl, getSupportHistory } from "../api";

interface Msg {
  id: string;
  from: "user" | "agent";
  text: string;
  ts: string;
}

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    getSupportHistory()
      .then((data) => setMessages(data.messages || []))
      .catch(() => {});

    const initData = window.Telegram?.WebApp?.initData || "";
    const ws = new WebSocket(`${getSupportWsUrl()}?initData=${encodeURIComponent(initData)}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "history") {
          setMessages(data.messages || []);
        } else if (data.type === "message") {
          setMessages((prev) => {
            if (prev.find((m) => m.id === data.id)) return prev;
            return [...prev, { id: data.id, from: data.from, text: data.text, ts: data.ts }];
          });
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, []);

  const send = useCallback(() => {
    const t = text.trim();
    if (!t || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setSending(true);
    wsRef.current.send(JSON.stringify({ type: "message", text: t }));
    setText("");
    setSending(false);
  }, [text]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const fmt = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 80px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-white">Поддержка</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${connected ? "bg-emerald-400" : "bg-white/20"}`} />
            <p className="text-[11px] text-white/40">{connected ? "Онлайн" : "Подключение..."}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-white/20">
            <MessageCircle className="w-10 h-10" />
            <p className="text-sm text-center leading-relaxed">
              Напишите нам — обычно отвечаем в течение нескольких минут
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.from === "user";
          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={
                  isUser
                    ? { background: "linear-gradient(135deg,#3b82f6,#2563eb)", borderBottomRightRadius: 4 }
                    : { background: "rgba(255,255,255,0.08)", borderBottomLeftRadius: 4 }
                }
              >
                {!isUser && (
                  <p className="text-[10px] font-bold text-blue-400 mb-1 uppercase tracking-wider">
                    Поддержка
                  </p>
                )}
                <p className="text-white/90 break-words">{msg.text}</p>
                <p className={`text-[10px] mt-1 ${isUser ? "text-white/40 text-right" : "text-white/30"}`}>
                  {fmt(msg.ts)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 flex items-end gap-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          onKeyDown={handleKey}
          placeholder="Напишите сообщение..."
          rows={1}
          className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none resize-none focus:border-blue-500/40 transition-colors"
          style={{ maxHeight: 120, minHeight: 44 }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || !connected || sending}
          className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 active:opacity-70 disabled:opacity-30 transition-opacity"
        >
          {sending
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : <Send className="w-4 h-4 text-white" />
          }
        </button>
      </div>
    </div>
  );
}
