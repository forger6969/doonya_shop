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
        <div
          className="w-7 h-7 rounded-full animate-spin"
          style={{ border: "2px solid rgba(236,72,153,0.15)", borderTopColor: "#EC4899" }}
        />
      </div>
    );
  }

  const orderStatusBadge = (status: string) => {
    if (status === "completed") return <span className="s-badge-success">{status}</span>;
    if (status === "pending") return <span className="s-badge-pending">{status}</span>;
    return <span className="s-badge-error">{status}</span>;
  };

  const topupStatusBadge = (status: string) => {
    if (status === "confirmed") return <span className="s-badge-success">{status}</span>;
    if (status === "rejected") return <span className="s-badge-error">{status}</span>;
    return <span className="s-badge-pending">{status}</span>;
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 pt-5 pb-2">
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black overflow-hidden relative"
            style={{ background: "linear-gradient(135deg,#EC4899,#A855F7)" }}
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
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center active:opacity-70"
            style={{
              background: "linear-gradient(135deg,#EC4899,#A855F7)",
              border: "2px solid var(--bg, #080510)",
            }}
          >
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
        </div>
        <div className="text-center">
          <p className="font-black text-xl text-white">{user.first_name}</p>
          {user.username && <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>@{user.username}</p>}
        </div>
      </div>

      {/* Balance card */}
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{
          background: "linear-gradient(135deg,#2d0a4e 0%,#1a0535 50%,#080510 100%)",
          border: "1px solid rgba(168,85,247,0.20)",
        }}
      >
        <div>
          <p className="s-label mb-1">{t.balance}</p>
          <p className="text-3xl font-black" style={{ color: "#FBBF24" }}>
            {user.balance.toLocaleString()}{" "}
            <span className="text-lg font-bold" style={{ color: "rgba(251,191,36,0.45)" }}>sum</span>
          </p>
        </div>
        <button
          onClick={onTopup}
          className="w-full py-3.5 rounded-2xl font-black text-sm text-white active:opacity-70"
          style={{
            background: "linear-gradient(135deg,#EC4899,#A855F7)",
            boxShadow: "0 4px 20px rgba(236,72,153,0.35)",
          }}
        >
          + {t.topUpBalance}
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex p-1 gap-1 rounded-2xl"
        style={{ background: "var(--bg-surface, #121526)" }}
      >
        {(["orders", "topups", "settings"] as const).map((tb) => {
          const active = tab === tb;
          return (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
              style={active ? {
                background: "rgba(236,72,153,0.15)",
                borderRadius: 10,
                color: "#EC4899",
              } : {
                color: "rgba(240,242,250,0.35)",
              }}
            >
              {tb === "orders" ? t.orders : tb === "topups" ? t.payments : t.settings}
            </button>
          );
        })}
      </div>

      {/* Orders */}
      {tab === "orders" && (
        <div className="flex flex-col gap-2">
          {orders.length === 0 ? (
            <p className="text-center text-sm py-10" style={{ color: "var(--text-muted)" }}>{t.noOrders}</p>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl px-4 py-3 flex justify-between items-center"
                style={{
                  background: "var(--bg-raised, #0D1020)",
                  border: "1px solid var(--border, rgba(255,255,255,0.07))",
                }}
              >
                <div>
                  <p className="text-sm font-bold text-white">Order</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {new Date(o.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-black s-price">{o.amount.toLocaleString()} sum</span>
                  {orderStatusBadge(o.status)}
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
            <p className="text-center text-sm py-10" style={{ color: "var(--text-muted)" }}>{t.noPayments}</p>
          ) : (
            topups.map((tp) => (
              <div
                key={tp.id}
                className="rounded-2xl px-4 py-3 flex justify-between items-center"
                style={{
                  background: "var(--bg-raised, #0D1020)",
                  border: "1px solid var(--border, rgba(255,255,255,0.07))",
                }}
              >
                <div>
                  <p className="text-sm font-bold text-white capitalize">{tp.method}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {new Date(tp.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-black s-price">+{tp.amount.toLocaleString()} sum</span>
                  {topupStatusBadge(tp.status)}
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
            <p className="s-label">{t.language}</p>
            <div
              className="flex p-1 gap-1 rounded-xl"
              style={{ background: "var(--bg-surface, #121526)" }}
            >
              {(["ru", "uz"] as Lang[]).map((l) => {
                const active = lang === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className="flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
                    style={active ? {
                      background: "rgba(236,72,153,0.15)",
                      borderRadius: 10,
                      color: "#EC4899",
                    } : {
                      color: "rgba(240,242,250,0.30)",
                    }}
                  >
                    {l === "ru" ? "🇷🇺 Русский" : "🇺🇿 O'zbekcha"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-2.5">
            <p className="s-label">{t.emailAddress}</p>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                type="email"
                className="s-input flex-1"
              />
              <button
                onClick={handleSaveEmail}
                disabled={!email.trim() || emailSaving}
                className="px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-30 active:opacity-70 transition-opacity flex-shrink-0"
                style={{ background: emailSaved ? "#10B981" : "linear-gradient(135deg,#EC4899,#A855F7)", color: "#fff" }}
              >
                {emailSaved ? t.saved : t.save}
              </button>
            </div>
            {emailSaved && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle className="w-3.5 h-3.5" /> {t.emailHint}
              </div>
            )}
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t.emailHint}</p>
          </div>

          {/* Telegram account */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              background: "var(--bg-raised, #0D1020)",
              border: "1px solid var(--border, rgba(255,255,255,0.07))",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(236,72,153,0.12)" }}
            >
              <User className="w-5 h-5" style={{ color: "#F97316" }} />
            </div>
            <div className="min-w-0">
              <p className="s-label mb-0.5">{t.telegramAccount}</p>
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
