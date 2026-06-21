import { useEffect, useState } from "react";
import { User, CheckCircle } from "lucide-react";
import { getMe, getOrders, getMyTopups, saveEmail } from "../api";

interface UserT { user_id: number; first_name: string; username: string; balance: number; email?: string }
interface Order { id: string; amount: number; status: string; created_at: string }
interface Topup { id: string; amount: number; method: string; status: string; created_at: string }

interface Props { onTopup: () => void }

export default function ProfilePage({ onTopup }: Props) {
  const [user, setUser] = useState<UserT | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [tab, setTab] = useState<"orders" | "topups" | "settings">("orders");
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  useEffect(() => {
    getMe().then((u: UserT) => { setUser(u); setEmail(u.email ?? ""); });
    getOrders().then(setOrders).catch(() => {});
    getMyTopups().then(setTopups).catch(() => {});
  }, []);

  const handleSaveEmail = async () => {
    if (!email.trim() || emailSaving) return;
    setEmailSaving(true);
    try {
      await saveEmail(email.trim());
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2500);
    } catch {
      window.Telegram?.WebApp?.showAlert("Failed to save email");
    } finally {
      setEmailSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 pt-5 pb-2">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black"
          style={{ background: "linear-gradient(135deg,#3b82f6,#7c3aed)" }}
        >
          <span className="text-white">{user.first_name[0]}</span>
        </div>
        <div className="text-center">
          <p className="font-black text-xl text-white">{user.first_name}</p>
          {user.username && <p className="text-white/40 text-sm mt-0.5">@{user.username}</p>}
        </div>
      </div>

      {/* Balance card */}
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{
          background: "linear-gradient(135deg,rgba(59,130,246,0.12),rgba(124,58,237,0.08))",
          border: "1px solid rgba(59,130,246,0.18)",
        }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Balance</p>
          <p className="text-3xl font-black text-white">
            {user.balance.toLocaleString()}{" "}
            <span className="text-lg font-bold text-white/30">sum</span>
          </p>
        </div>
        <button
          onClick={onTopup}
          className="w-full py-3.5 rounded-xl font-black text-sm text-white active:opacity-70"
          style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
        >
          + Top Up Balance
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/[0.04] rounded-xl p-1 gap-1">
        {(["orders", "topups", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "text-white/40"
            }`}
          >
            {t === "orders" ? "Orders" : t === "topups" ? "Payments" : "Settings"}
          </button>
        ))}
      </div>

      {/* Orders */}
      {tab === "orders" && (
        <div className="flex flex-col gap-2">
          {orders.length === 0 ? (
            <p className="text-center text-white/25 text-sm py-10">No orders yet</p>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl px-4 py-3 flex justify-between items-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>
                  <p className="text-sm font-bold text-white">Order</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-black text-blue-400">{o.amount.toLocaleString()} sum</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      o.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-yellow-500/15 text-yellow-400"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Topups */}
      {tab === "topups" && (
        <div className="flex flex-col gap-2">
          {topups.length === 0 ? (
            <p className="text-center text-white/25 text-sm py-10">No payments yet</p>
          ) : (
            topups.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl px-4 py-3 flex justify-between items-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>
                  <p className="text-sm font-bold text-white capitalize">{t.method}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-black text-blue-400">+{t.amount.toLocaleString()} sum</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      t.status === "confirmed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : t.status === "rejected"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-yellow-500/15 text-yellow-400"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settings */}
      {tab === "settings" && (
        <div className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Email address</p>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                type="email"
                className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/40 transition-colors"
              />
              <button
                onClick={handleSaveEmail}
                disabled={!email.trim() || emailSaving}
                className="px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-30 active:opacity-70 transition-opacity"
                style={{ background: emailSaved ? "#10b981" : "#3b82f6", color: "#fff" }}
              >
                {emailSaved ? "Saved!" : "Save"}
              </button>
            </div>
            {emailSaved && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle className="w-3.5 h-3.5" /> Email saved successfully
              </div>
            )}
            <p className="text-[11px] text-white/20">Receive order updates to your email</p>
          </div>

          {/* Telegram account */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-0.5">
                Telegram Account
              </p>
              <p className="text-sm font-bold text-white truncate">
                {user.first_name}
                {user.username ? ` (@${user.username})` : ""}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
