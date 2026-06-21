import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageCircle, Users, ArrowLeft } from "lucide-react";
import { getSupportWsUrl } from "../api";

interface Msg { id: string; from: string; text: string; ts: string; agent_id?: number }
interface Chat {
  user_id: number;
  user_name: string;
  first_name: string;
  unread: number;
  last_ts: string;
  last_message: string;
}

export default function SupportAgentPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selected, setSelected] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData || "";
    const ws = new WebSocket(`${getSupportWsUrl()}?initData=${encodeURIComponent(initData)}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "chats") {
          setChats(data.chats || []);
        } else if (data.type === "chat_history") {
          setMessages(data.messages || []);
        } else if (data.type === "message") {
          // New message came in — update chat list and active chat
          const userId = data.user_id;
          setChats((prev) => {
            const idx = prev.findIndex((c) => c.user_id === userId);
            const chat = idx >= 0 ? prev[idx] : {
              user_id: userId,
              user_name: data.user_name || "",
              first_name: data.first_name || "",
              unread: 0,
              last_ts: data.ts,
              last_message: data.text,
            };
            const updated = {
              ...chat,
              last_message: data.text,
              last_ts: data.ts,
              unread: data.from === "user" ? (chat.unread || 0) + 1 : chat.unread,
            };
            if (idx >= 0) {
              const next = [...prev];
              next.splice(idx, 1);
              return [updated, ...next];
            }
            return [updated, ...prev];
          });

          setSelected((sel) => {
            if (sel?.user_id === userId) {
              setMessages((prev) => {
                if (prev.find((m) => m.id === data.id)) return prev;
                return [...prev, { id: data.id, from: data.from, text: data.text, ts: data.ts }];
              });
            }
            return sel;
          });
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, []);

  const openChat = (chat: Chat) => {
    setSelected(chat);
    setMessages([]);
    // Mark as read locally
    setChats((prev) => prev.map((c) => c.user_id === chat.user_id ? { ...c, unread: 0 } : c));
    // Request history
    wsRef.current?.send(JSON.stringify({ type: "select_chat", user_id: chat.user_id }));
  };

  const send = useCallback(() => {
    if (!selected || !text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", to_user_id: selected.user_id, text: text.trim() }));
    setText("");
  }, [selected, text]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const fmt = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  const fmtDate = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
      return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
    } catch { return ""; }
  };

  // ── Chat detail view ──────────────────────────────────────────────────────

  if (selected) {
    return (
      <div className="flex flex-col" style={{ height: "100dvh" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center active:opacity-70">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {(selected.first_name || selected.user_name || "U")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">
              {selected.first_name || selected.user_name || `User ${selected.user_id}`}
            </p>
            {selected.user_name && (
              <p className="text-[11px] text-white/40">@{selected.user_name}</p>
            )}
          </div>
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-white/20"}`} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
          {messages.length === 0 && (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-white/20">Загрузка...</p>
            </div>
          )}
          {messages.map((msg) => {
            const isAgent = msg.from === "agent";
            return (
              <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={
                    isAgent
                      ? { background: "linear-gradient(135deg,#3b82f6,#2563eb)", borderBottomRightRadius: 4 }
                      : { background: "rgba(255,255,255,0.08)", borderBottomLeftRadius: 4 }
                  }
                >
                  <p className="text-white/90 break-words">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${isAgent ? "text-white/40 text-right" : "text-white/30"}`}>
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
            placeholder="Ответить клиенту..."
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
            disabled={!text.trim() || !connected}
            className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 active:opacity-70 disabled:opacity-30"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // ── Chat list view ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0">
        <Users className="w-5 h-5 text-blue-400" />
        <div className="flex-1">
          <h1 className="text-base font-black text-white">Поддержка</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-white/20"}`} />
            <p className="text-[11px] text-white/40">{chats.length} чат{chats.length !== 1 ? "а" : ""}</p>
          </div>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 pb-6">
        {chats.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-white/20">
            <MessageCircle className="w-10 h-10" />
            <p className="text-sm">Нет активных чатов</p>
          </div>
        )}
        {chats.map((chat) => (
          <button
            key={chat.user_id}
            onClick={() => openChat(chat)}
            className="flex items-center gap-3 p-3.5 rounded-2xl active:opacity-70 text-left w-full"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-10 h-10 rounded-full bg-blue-600/70 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {(chat.first_name || chat.user_name || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white truncate">
                  {chat.first_name || chat.user_name || `User ${chat.user_id}`}
                </p>
                <p className="text-[10px] text-white/30 flex-shrink-0 ml-2">{fmtDate(chat.last_ts)}</p>
              </div>
              <p className="text-[12px] text-white/40 truncate mt-0.5">{chat.last_message || "..."}</p>
            </div>
            {chat.unread > 0 && (
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white">{chat.unread}</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
