import { useState, useEffect } from "react";
import { MessageCircle, Send, CheckCircle } from "lucide-react";
import { createTicket, getMyTickets } from "../api";

const CATEGORIES = ["Payment", "Order", "Technical", "Other"];

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-yellow-500/15 text-yellow-400" },
  answered: { label: "Answered", cls: "bg-blue-500/15 text-blue-400" },
  closed: { label: "Closed", cls: "bg-white/5 text-white/30" },
};

interface Ticket {
  id: string;
  category: string;
  message: string;
  status: string;
  reply: string;
  created_at: string;
}

export default function SupportPage() {
  const [category, setCategory] = useState("Payment");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [view, setView] = useState<"form" | "history">("form");

  const loadTickets = () => getMyTickets().then(setTickets).catch(() => {});

  useEffect(() => { loadTickets(); }, []);

  const handleSubmit = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await createTicket({ category, message: message.trim() });
      setSent(true);
      setMessage("");
      loadTickets();
      setTimeout(() => setSent(false), 3000);
    } catch {
      window.Telegram?.WebApp?.showAlert("Failed to send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2 pt-2">
        <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h1 className="text-base font-black text-white leading-none">Support</h1>
          <p className="text-[11px] text-white/30 mt-0.5">We reply within a few hours</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex bg-white/[0.04] rounded-xl p-1 gap-1">
        {(["form", "history"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              view === v ? "bg-blue-600 text-white" : "text-white/40"
            }`}
          >
            {v === "form" ? "New Request" : `History (${tickets.length})`}
          </button>
        ))}
      </div>

      {view === "form" && (
        <>
          {/* Category */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Category</p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    category === c
                      ? "bg-blue-600 text-white"
                      : "bg-white/[0.05] text-white/50 border border-white/[0.08]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Message</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              placeholder="Describe your issue in detail..."
              rows={5}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3.5 py-3 text-sm text-white placeholder-white/20 outline-none resize-none focus:border-blue-500/40 transition-colors"
            />
            <p className="text-[10px] text-white/20 text-right">{message.length}/1000</p>
          </div>

          {sent && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-emerald-400 text-sm font-semibold">Ticket submitted! We'll reply soon.</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!message.trim() || sending}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-30 active:opacity-70 transition-opacity"
            style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : "Send Request"}
          </button>
        </>
      )}

      {view === "history" && (
        <div className="flex flex-col gap-3">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-white/20">
              <MessageCircle className="w-10 h-10" />
              <p className="text-sm">No tickets yet</p>
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl p-4 flex flex-col gap-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-400 bg-blue-400/10 px-2.5 py-0.5 rounded-full">
                    {t.category}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[t.status]?.cls ?? "bg-white/5 text-white/30"}`}>
                    {STATUS_STYLE[t.status]?.label ?? t.status}
                  </span>
                </div>
                <p className="text-sm text-white/80 leading-relaxed">{t.message}</p>
                {t.reply && (
                  <div className="pl-3 border-l-2 border-blue-500/30 mt-1">
                    <p className="text-[10px] text-white/40 font-semibold mb-0.5 uppercase tracking-wider">Support Reply</p>
                    <p className="text-sm text-white/70 leading-relaxed">{t.reply}</p>
                  </div>
                )}
                <p className="text-[10px] text-white/20 mt-0.5">
                  {new Date(t.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
