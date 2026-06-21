import { useEffect, useRef, useState } from "react";
import { User, CheckCircle, Camera, Loader } from "lucide-react";
import { getMe, getOrders, getMyTopups, saveEmail, uploadAvatar } from "../api";
import { useLang, type Lang } from "../i18n";

interface UserT { user_id: number; first_name: string; username: string; balance: number; email?: string; avatar_url?: string }
interface Order { id: string; amount: number; status: string; created_at: string }
interface Topup { id: string; amount: number; method: string; status: string; created_at: string }

interface Props { onTopup: () => void }

export default function ProfilePage({ onTopup }: Props) {
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<UserT | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [tab, setTab] = useState<"orders" | "topups" | "settings">("orders");
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

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

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const { url } = await uploadAvatar(file);
      setUser((u) => u ? { ...u, avatar_url: url } : u);
    } catch {
      window.Telegram?.WebApp?.showAlert("Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
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
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black overflow-hidden"
            style={{ background: "linear-gradient(135deg,#3b82f6,#7c3aed)" }}
          >
            {user.avatar_url
              ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="avatar" />
              : <span className="text-white">{user.first_name[0]}</span>
            }
            {avatarUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={() => avatarRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center border-2 border-[#0a0a0e] active:opacity-70"
          >
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">{t.balance}</p>
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
          + {t.topUpBalance}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/[0.04] rounded-xl p-1 gap-1">
        {(["orders", "topups", "settings"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              tab === tb ? "bg-blue-600 text-white" : "text-white/40"
            }`}
          >
            {tb === "orders" ? t.orders : tb === "topups" ? t.payments : t.settings}
          </button>
        ))}
      </div>

      {/* Orders */}
      {tab === "orders" && (
        <div className="flex flex-col gap-2">
          {orders.length === 0 ? (
            <p className="text-center text-white/25 text-sm py-10">{t.noOrders}</p>
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
                    {new Date(o.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: "short", day: "numeric" })}
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
            <p className="text-center text-white/25 text-sm py-10">{t.noPayments}</p>
          ) : (
            topups.map((tp) => (
              <div
                key={tp.id}
                className="rounded-2xl px-4 py-3 flex justify-between items-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>
                  <p className="text-sm font-bold text-white capitalize">{tp.method}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {new Date(tp.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-black text-blue-400">+{tp.amount.toLocaleString()} sum</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tp.status === "confirmed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : tp.status === "rejected"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-yellow-500/15 text-yellow-400"
                    }`}
                  >
                    {tp.status}
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
          {/* Language switcher */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t.language}</p>
            <div className="flex bg-white/[0.04] rounded-xl p-1 gap-1">
              {(["ru", "uz"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${
                    lang === l ? "bg-blue-600 text-white" : "text-white/30"
                  }`}
                >
                  {l === "ru" ? "🇷🇺 Русский" : "🇺🇿 O'zbekcha"}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t.emailAddress}</p>
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
                {emailSaved ? t.saved : t.save}
              </button>
            </div>
            {emailSaved && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle className="w-3.5 h-3.5" /> {t.emailHint}
              </div>
            )}
            <p className="text-[11px] text-white/20">{t.emailHint}</p>
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
                {t.telegramAccount}
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
