import { useEffect, useRef, useState } from "react";
import { User, CheckCircle, Camera, Loader, MessageCircle } from "lucide-react";
import { getMe, getOrders, getMyTopups, saveEmail, uploadAvatar, getMyOrderChats, type AdminOrderChat } from "../api";
import { useLang, type Lang } from "../i18n";

interface UserT { user_id: number; first_name: string; username: string; balance: number; email?: string; avatar_url?: string }
interface Order { id: string; product_id?: string; amount: number; status: string; created_at: string }
interface Topup { id: string; amount: number; method: string; status: string; created_at: string }

interface Props { onTopup: () => void; onOpenOrderChat?: (orderId: string, productName?: string) => void }

export default function ProfilePage({ onTopup, onOpenOrderChat }: Props) {
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<UserT | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [orderChats, setOrderChats] = useState<AdminOrderChat[]>([]);
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
    getMyOrderChats().then(setOrderChats).catch(() => {});
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
            style={{
              background: "#1e1e1e",
              border: "2px solid rgba(236,72,153,0.35)",
            }}
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
              background: "#EC4899",
              border: "2px solid var(--bg, #0d0d0d)",
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
          background: "var(--bg-raised)",
          border: "1px solid rgba(236,72,153,0.15)",
        }}
      >
        <div>
          <p className="s-label mb-1">{t.balance}</p>
          <p className="text-3xl font-black" style={{ color: "#EC4899" }}>
            {user.balance.toLocaleString()}{" "}
            <span className="text-lg font-bold" style={{ color: "rgba(236,72,153,0.45)" }}>sum</span>
          </p>
        </div>
        <button
          onClick={onTopup}
          className="w-full py-3.5 rounded-2xl font-black text-sm text-white active:opacity-70"
          style={{
            background: "#EC4899",
            boxShadow: "0 4px 20px rgba(236,72,153,0.28)",
          }}
        >
          + {t.topUpBalance}
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex p-1 gap-1 rounded-2xl"
        style={{ background: "var(--bg-surface)" }}
      >
        {(["orders", "topups", "settings"] as const).map((tb) => {
          const active = tab === tb;
          return (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors"
              style={active ? {
                background: "rgba(236,72,153,0.12)",
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
            orders.map((o) => {
              const chat = orderChats.find((c) => c.order_id === o.id);
              const unread = chat?.unread_by_user ?? 0;
              return (
                <div
                  key={o.id}
                  className="rounded-2xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: "var(--bg-raised)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                      {chat?.product_name || "Order"}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {new Date(o.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-sm font-black s-price">{o.amount.toLocaleString()} sum</span>
                      {orderStatusBadge(o.status)}
                    </div>
                    {onOpenOrderChat && (
                      <button
                        onClick={() => onOpenOrderChat(o.id, chat?.product_name)}
                        className="relative w-8 h-8 rounded-xl flex items-center justify-center active:opacity-70 flex-shrink-0"
                        style={{
                          background: unread > 0 ? "rgba(236,72,153,0.12)" : "var(--bg-surface)",
                          border: `1px solid ${unread > 0 ? "rgba(236,72,153,0.28)" : "var(--border)"}`,
                        }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" style={{ color: unread > 0 ? "#EC4899" : "var(--text-muted)" }} />
                        {unread > 0 && (
                          <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5"
                            style={{ background: "#EC4899" }}>
                            <span className="text-[8px] font-black text-white leading-none">{unread > 9 ? "9+" : unread}</span>
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
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
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border)",
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
              style={{ background: "var(--bg-surface)" }}
            >
              {(["ru", "uz"] as Lang[]).map((l) => {
                const active = lang === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className="flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
                    style={active ? {
                      background: "rgba(236,72,153,0.12)",
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
                style={{ background: emailSaved ? "#10B981" : "#EC4899", color: "#fff" }}
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
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(236,72,153,0.10)" }}
            >
              <User className="w-5 h-5" style={{ color: "#EC4899" }} />
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
