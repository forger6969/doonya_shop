import { useEffect, useState, useCallback, useRef } from "react";
import {
  LayoutDashboard, CreditCard, ShoppingBag, Gamepad2,
  BarChart2, Tag, Check, X, ChevronLeft, Plus, Trash2,
  RefreshCw, Eye, ChevronRight, TrendingUp, Users,
  Upload, AlertCircle, ToggleLeft, ToggleRight, Package, Camera,
  MessageCircle, Send, ArrowLeft, Search,
} from "lucide-react";
import {
  adminGetStats, adminUpload, getMe, uploadAvatar,
  adminGetTopups, adminGetOrders, adminConfirmTopup, adminRejectTopup, adminCompleteOrder,
  adminGetGames, adminGetProducts, adminCreateGame, adminPatchGame, adminDeleteGame,
  adminGetCategories, adminCreateCategory, adminDeleteCategory,
  adminCreateProduct, adminPatchProduct, adminDeleteProduct, adminSetDiscount,
  adminSalesStats, adminProductStats, adminUserStats,
  adminGetPromos, adminCreatePromo, adminDeletePromo, adminTogglePromo,
  adminGetBanners, adminCreateBanner, adminDeleteBanner, adminToggleBanner, type Banner,
  adminGetPaymentMethods, adminCreatePaymentMethod, adminUpdatePaymentMethod,
  adminTogglePaymentMethod, adminDeletePaymentMethod, type PaymentMethod,
  getSupportWsUrl, agentGetAllUsers,
  getOrderChatWsUrl, adminGetOrderChats, type AdminOrderChat,
} from "../api";
import { useLang, type Lang } from "../i18n";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Stats { pending_topups: number; pending_orders: number; total_games: number; total_products: number; total_revenue: number }
interface Topup { id: string; user_id: number; amount: number; unique_amount: number; method: string; receipt_url: string; status: string; created_at: string }
interface Order { id: string; user_id: number; username: string; first_name: string; amount: number; status: string; promo_code: string; variant_label?: string; field_answers?: Record<string, string>; product_id?: string; created_at: string }
interface Game { id: string; name: string; description: string; icon_url: string; banner_url?: string }
interface Category { id: string; game_id: string; name: string }
interface PurchaseField { label: string; required: boolean }
interface Product { id: string; category_id?: string; category_name?: string; name: string; description: string; price: number; icon_url: string; sales_count: number; revenue: number; purchase_fields: PurchaseField[]; redirect_to_chat?: boolean; chat_message?: string; badge_emoji?: string; discount_percent?: number; discount_enabled?: boolean; discount_until?: string | null }
interface Promo { id: string; code: string; discount_pct: number; min_order_amount: number; max_uses: number; uses: number; is_active: boolean; created_at: string }

type Section = "dashboard" | "payments" | "orders" | "catalog" | "analytics" | "promos" | "banners" | "payment_methods" | "chat" | "order_chats";

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("ru-RU") + " sum";
const fmtShort = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(0) + "K" : String(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const METHOD: Record<string, string> = { card: "Card", payme: "Payme", atm: "ATM" };

// ─── Micro-components ─────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const { t } = useLang();
  const STATUS: Record<string, { label: string; cls: string }> = {
    pending:   { label: t.badgePending,   cls: "text-amber-400 bg-amber-400/10" },
    confirmed: { label: t.badgeDone,      cls: "text-emerald-400 bg-emerald-400/10" },
    rejected:  { label: t.badgeRejected,  cls: "text-red-400 bg-red-400/10" },
    completed: { label: t.badgeCompleted, cls: "text-emerald-400 bg-emerald-400/10" },
  };
  const s = STATUS[status] ?? { label: status, cls: "text-zinc-400 bg-zinc-400/10" };
  return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>{s.label}</span>;
}
function Spin() { return <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />; }
function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return <div className="flex flex-col items-center gap-2 py-14 text-zinc-700"><Icon className="w-9 h-9" /><p className="text-sm">{text}</p></div>;
}
function Divider() { return <div className="h-px bg-[#1e2030] mx-0" />; }

// ─── Image upload button ──────────────────────────────────────────────────────
function UploadBtn({ current, onDone }: { current: string; onDone: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { url } = await adminUpload(file);
      onDone(url);
    } finally {
      setLoading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-dashed border-zinc-700 flex items-center justify-center active:opacity-70"
      style={current ? { backgroundImage: `url(${current})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
    >
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handle} />
      {loading
        ? <RefreshCw className="w-5 h-5 text-white animate-spin" />
        : <Upload className={`w-4 h-4 ${current ? "text-white/0 hover:text-white" : "text-zinc-500"}`} />
      }
    </button>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ onNav }: { onNav: (s: Section) => void }) {
  const { t } = useLang();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { adminGetStats().then(setStats); }, []);

  const cards = stats ? [
    { label: t.pendingTopups,  value: stats.pending_topups,  icon: CreditCard, color: "text-amber-400", bg: "bg-amber-400/10", to: "payments" as Section },
    { label: t.pendingOrders,  value: stats.pending_orders,  icon: ShoppingBag, color: "text-violet-400", bg: "bg-violet-400/10", to: "orders" as Section },
    { label: t.totalGames,     value: stats.total_games,     icon: Gamepad2, color: "text-sky-400", bg: "bg-sky-400/10", to: "catalog" as Section },
    { label: t.totalProducts,  value: stats.total_products,  icon: Package, color: "text-emerald-400", bg: "bg-emerald-400/10", to: "catalog" as Section },
  ] : [];

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">{t.overview}</p>
        <h2 className="text-xl font-black text-white mt-0.5">{t.adHome}</h2>
      </div>

      {!stats ? <div className="flex justify-center py-10"><Spin /></div> : <>
        {/* Revenue hero */}
        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #1a0533, #0d1a3a)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t.totalRevenue}</p>
          <p className="text-3xl font-black text-white mt-1">{fmtShort(stats.total_revenue)} sum</p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-semibold">{t.allTime}</span>
          </div>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {cards.map(({ label, value, icon: Icon, color, bg, to }) => (
            <button key={label} onClick={() => onNav(to)}
              className="a-card p-4 text-left flex flex-col gap-3 active:scale-[.97] transition-transform">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">{label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Quick links */}
        {[
          { label: t.viewAnalytics, icon: BarChart2, to: "analytics" as Section, color: "text-sky-400" },
          { label: t.promoCodes,    icon: Tag,       to: "promos" as Section,    color: "text-violet-400" },
        ].map(({ label, icon: Icon, to, color }) => (
          <button key={to} onClick={() => onNav(to)}
            className="a-card px-4 py-3 flex items-center gap-3 active:opacity-70">
            <Icon className={`w-5 h-5 ${color}`} />
            <span className="flex-1 text-sm font-semibold text-white">{label}</span>
            <ChevronRight className="w-4 h-4 text-zinc-700" />
          </button>
        ))}
      </>}
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function TopupDetail({ topup, onBack, onDone }: { topup: Topup; onBack: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const handle = async (action: "confirm" | "reject") => {
    setLoading(true);
    action === "confirm" ? await adminConfirmTopup(topup.id) : await adminRejectTopup(topup.id);
    setLoading(false);
    onDone();
  };
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030]">
        <button onClick={onBack} className="a-card w-8 h-8 flex items-center justify-center active:opacity-70">
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <span className="flex-1 text-sm font-bold text-white">{t.paymentDetail}</span>
        <Badge status={topup.status} />
      </div>
      <div className="flex flex-col gap-0 mx-4 mt-4 a-card overflow-hidden">
        {[
          ["User ID", String(topup.user_id)],
          ["Amount", fmt(topup.amount)],
          ["Unique Amount", fmt(topup.unique_amount)],
          ["Method", METHOD[topup.method] ?? topup.method],
          ["Date", fmtDate(topup.created_at)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3 border-b border-[#1e2030] last:border-0">
            <span className="text-[12px] text-zinc-500">{k}</span>
            <span className="text-[12px] font-semibold text-white">{v}</span>
          </div>
        ))}
      </div>
      {topup.receipt_url && (
        <div className="mx-4 mt-3 rounded-2xl overflow-hidden border border-[#1e2030]">
          <img src={topup.receipt_url} alt="receipt" className="w-full object-contain max-h-72" />
        </div>
      )}
      {topup.status === "pending" && (
        <div className="flex gap-3 px-4 mt-4">
          <button onClick={() => handle("reject")} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-red-400 border border-red-400/20 active:opacity-70 disabled:opacity-40">
            <X className="w-4 h-4" /> {t.reject}
          </button>
          <button onClick={() => handle("confirm")} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-emerald-400 border border-emerald-400/20 active:opacity-70 disabled:opacity-40">
            <Check className="w-4 h-4" /> {t.approve}
          </button>
        </div>
      )}
    </div>
  );
}

function Payments() {
  const { t } = useLang();
  const [topups, setTopups] = useState<Topup[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Topup | null>(null);
  const load = useCallback(async () => { setLoading(true); setTopups(await adminGetTopups(filter)); setLoading(false); }, [filter]);
  useEffect(() => { load(); }, [load]);

  const filterLabels: Record<string, string> = { pending: t.filterPending, confirmed: t.filterConfirmed, rejected: t.filterRejected };

  if (selected) return <TopupDetail topup={selected} onBack={() => setSelected(null)} onDone={() => { setSelected(null); load(); }} />;

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">{t.finance}</p>
        <h2 className="text-xl font-black text-white mt-0.5">{t.paymentsTitle}</h2>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        {["pending", "confirmed", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filter === s ? "bg-white/10 text-white" : "text-zinc-600"}`}>
            {filterLabels[s] ?? s}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 text-zinc-600 active:text-white"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="a-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : topups.length === 0 ? <Empty icon={CreditCard} text={t.noPaymentsFilter} />
          : topups.map((t, i) => (
            <div key={t.id}>
              {i > 0 && <Divider />}
              <button onClick={() => setSelected(t)} className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/[0.02]">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[13px] font-bold text-white">{fmt(t.amount)}</p>
                  <p className="text-[11px] text-zinc-600">{METHOD[t.method]} · {fmtDate(t.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.receipt_url && <Eye className="w-3.5 h-3.5 text-zinc-700" />}
                  <Badge status={t.status} />
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                </div>
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────
function Orders({ onChat }: { onChat: (order_id: string) => void }) {
  const { t } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setOrders(await adminGetOrders(filter)); setLoading(false); }, [filter]);
  useEffect(() => { load(); }, [load]);
  const done = async (id: string) => { await adminCompleteOrder(id); load(); };

  const filterLabels: Record<string, string> = { pending: t.filterPending, completed: t.filterCompleted };

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">{t.commerce}</p>
        <h2 className="text-xl font-black text-white mt-0.5">{t.ordersTitle}</h2>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        {["pending", "completed"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filter === s ? "bg-white/10 text-white" : "text-zinc-600"}`}>
            {filterLabels[s] ?? s}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 text-zinc-600 active:text-white"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="a-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : orders.length === 0 ? <Empty icon={ShoppingBag} text={t.noOrdersFilter} />
          : orders.map((o, i) => {
            const userName = o.first_name || (o.username ? `@${o.username}` : `User ${o.user_id}`);
            return (
              <div key={o.id}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-400/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-bold text-white">{fmt(o.amount)}</p>
                      {o.variant_label && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(34,197,94,0.10)", color: "#22c55e" }}>
                          {o.variant_label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-zinc-400 font-semibold truncate max-w-[120px]">{userName}</span>
                      {o.username && (
                        <span className="text-[10px] text-zinc-600">@{o.username}</span>
                      )}
                      <span className="text-[10px] text-zinc-700">· {fmtDate(o.created_at)}</span>
                      {o.promo_code && (
                        <span className="text-[10px] text-violet-400 font-bold">{o.promo_code}</span>
                      )}
                    </div>
                    {o.field_answers && Object.keys(o.field_answers).length > 0 && (
                      <div className="flex flex-col gap-0.5 mt-1.5">
                        {Object.entries(o.field_answers).map(([k, v]) => (
                          <p key={k} className="text-[10px]" style={{ color: "var(--text-muted, #6b7280)" }}>
                            <span className="text-zinc-600">{k}:</span>{" "}
                            <span className="text-zinc-300 font-mono">{v}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Chat button */}
                  <button
                    onClick={() => onChat(o.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 active:opacity-70"
                    style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.18)" }}
                    title="Написать клиенту"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                  {o.status === "pending"
                    ? <button onClick={() => done(o.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-400 border border-emerald-400/20 active:opacity-70">
                        <Check className="w-3 h-3" /> {t.doneBtn}
                      </button>
                    : <Badge status={o.status} />
                  }
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

function AdminCardEditor({ product, gameId: _gameId, onSaved }: { product: Product; gameId: string; onSaved: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [fields, setFields] = useState<PurchaseField[]>(product.purchase_fields ?? []);
  const [newField, setNewField] = useState({ label: "", required: false });
  const [discountEnabled, setDiscountEnabled] = useState(product.discount_enabled ?? false);
  const [discountPct, setDiscountPct] = useState(String(product.discount_percent || ""));
  const [discountUntil, setDiscountUntil] = useState(
    product.discount_until ? product.discount_until.slice(0, 16) : ""
  );
  const [broadcastDiscount, setBroadcastDiscount] = useState(false);
  const [redirectToChat, setRedirectToChat] = useState(product.redirect_to_chat ?? false);
  const [chatMessage, setChatMessage] = useState(product.chat_message ?? "");
  const [saving, setSaving] = useState(false);

  const addField = () => {
    if (!newField.label.trim()) return;
    setFields([...fields, { label: newField.label.trim(), required: newField.required }]);
    setNewField({ label: "", required: false });
  };

  const save = async () => {
    if (!name.trim() || !price) return;
    setSaving(true);
    await adminPatchProduct(product.id, { name: name.trim(), price: Number(price), purchase_fields: fields, redirect_to_chat: redirectToChat, chat_message: chatMessage });
    await adminSetDiscount(product.id, {
      discount_percent: Number(discountPct) || 0,
      discount_enabled: discountEnabled,
      discount_until: discountUntil ? new Date(discountUntil).toISOString() : null,
      broadcast: broadcastDiscount,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="border-t border-[#1e2030] px-4 pt-3 pb-4 flex flex-col gap-3">
      {/* Name + price */}
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t.productNamePlaceholder} className="a-input flex-1 text-sm" />
        <input value={price} onChange={(e) => setPrice(e.target.value)}
          type="number" placeholder={t.pricePlaceholder} className="a-input w-28 text-sm" />
      </div>

      {/* Redirect to order chat after purchase */}
      <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
        <button onClick={() => setRedirectToChat(!redirectToChat)} className="flex items-center justify-between active:opacity-70">
          <span className="text-[11px] font-bold text-blue-400/90">Перекидывать в чат после покупки</span>
          {redirectToChat ? <ToggleRight className="w-5 h-5 text-blue-400" /> : <ToggleLeft className="w-5 h-5 text-zinc-600" />}
        </button>
        {redirectToChat && (
          <textarea value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} rows={2}
            placeholder="Автосообщение в чат после покупки (напр. «Заказ принят. Проверьте почту, пришлите код»)"
            className="a-input text-xs resize-none" />
        )}
      </div>

      {/* Discount */}
      <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400/80">Скидка</p>
          <button
            onClick={() => setDiscountEnabled(!discountEnabled)}
            className="flex items-center gap-1.5 active:opacity-70"
          >
            {discountEnabled
              ? <ToggleRight className="w-5 h-5 text-red-400" />
              : <ToggleLeft className="w-5 h-5 text-zinc-600" />
            }
            <span className={`text-[11px] font-bold ${discountEnabled ? "text-red-400" : "text-zinc-600"}`}>
              {discountEnabled ? "Вкл" : "Выкл"}
            </span>
          </button>
        </div>
        {discountEnabled && (
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[9px] text-zinc-600 mb-1 uppercase tracking-wider">% скидки</p>
              <input
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                type="number" min="1" max="99"
                placeholder="напр. 20"
                className="a-input w-full text-sm"
              />
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-zinc-600 mb-1 uppercase tracking-wider">До (необязательно)</p>
              <input
                value={discountUntil}
                onChange={(e) => setDiscountUntil(e.target.value)}
                type="datetime-local"
                className="a-input w-full text-sm"
              />
            </div>
          </div>
        )}
        {discountEnabled && discountPct && (
          <p className="text-[10px] text-red-400/60">
            Цена со скидкой: {Math.max(1, Math.floor(Number(price) * (100 - Number(discountPct)) / 100)).toLocaleString()} sum
          </p>
        )}
        {discountEnabled && discountPct && (
          <button
            onClick={() => setBroadcastDiscount(!broadcastDiscount)}
            className="flex items-center gap-1.5 active:opacity-70 mt-1"
          >
            {broadcastDiscount
              ? <ToggleRight className="w-5 h-5 text-orange-400" />
              : <ToggleLeft className="w-5 h-5 text-zinc-600" />
            }
            <span className={`text-[11px] font-bold ${broadcastDiscount ? "text-orange-400" : "text-zinc-600"}`}>
              📣 Уведомить всех пользователей о скидке
            </span>
          </button>
        )}
      </div>

      {/* Purchase fields */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">{t.purchaseFieldsCheckout}</p>
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="flex-1 text-white/80">{f.label}</span>
            <span className="text-[10px] text-zinc-600">{f.required ? t.requiredLabel : t.optionalLabel}</span>
            <button onClick={() => setFields(fields.filter((_, j) => j !== i))}
              className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <X className="w-3 h-3 text-red-400" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 items-center">
          <input value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addField()}
            placeholder={t.fieldLabelPlaceholder} className="a-input flex-1 text-xs" />
          <label className="flex items-center gap-1 text-[11px] text-zinc-500 flex-shrink-0 cursor-pointer select-none">
            <input type="checkbox" checked={newField.required}
              onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              className="w-3.5 h-3.5 accent-amber-500" />
            {t.reqLabel}
          </label>
          <button onClick={addField} disabled={!newField.label.trim()}
            className="w-8 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 disabled:opacity-30">
            <Plus className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      <button onClick={save} disabled={saving || !name.trim() || !price} className="a-btn text-xs py-2">
        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> {t.saveVariantsBtn}</>}
      </button>
    </div>
  );
}

// ── ProductList — products within a category ──────────────────────────────────
function ProductList({ game, category, onBack }: { game: Game; category: Category; onBack: () => void }) {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", icon_url: "" });
  const [formFields, setFormFields] = useState<PurchaseField[]>([]);
  const [formRedirectChat, setFormRedirectChat] = useState(false);
  const [formChatMsg, setFormChatMsg] = useState("");
  const [formBadge, setFormBadge] = useState("");
  const [newField, setNewField] = useState({ label: "", required: false });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setProducts(await adminGetProducts(game.id, category.id));
    setLoading(false);
  };
  useEffect(() => { load(); }, [category.id]);

  const addField = () => {
    if (!newField.label.trim()) return;
    setFormFields([...formFields, { label: newField.label.trim(), required: newField.required }]);
    setNewField({ label: "", required: false });
  };

  const save = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    const result = await adminCreateProduct({
      game_id: game.id, category_id: category.id,
      name: form.name.trim(), description: "", price: Number(form.price), icon_url: form.icon_url,
      redirect_to_chat: formRedirectChat, chat_message: formChatMsg, badge_emoji: formBadge.trim(),
    });
    if (formFields.length > 0 && result?.product_id) {
      await adminPatchProduct(result.product_id, { purchase_fields: formFields });
    }
    setForm({ name: "", price: "", icon_url: "" });
    setFormFields([]); setNewField({ label: "", required: false });
    setFormRedirectChat(false); setFormChatMsg(""); setFormBadge("");
    setShowForm(false); setSaving(false); load();
  };

  const updateIcon = async (product: Product, url: string) => {
    await adminPatchProduct(product.id, { icon_url: url });
    load();
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030]">
        <button onClick={onBack} className="a-card w-8 h-8 flex items-center justify-center active:opacity-70">
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider truncate">{game.name}</p>
          <p className="text-sm font-black text-white truncate">{category.name}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-500"}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mt-4 a-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{t.newProduct}</p>
          <div className="flex gap-3 items-center">
            <UploadBtn current={form.icon_url} onDone={(url) => setForm({ ...form, icon_url: url })} />
            <div className="flex-1 flex flex-col gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.productNamePlaceholder} className="a-input" />
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder={t.basePricePlaceholder} type="number" className="a-input" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input value={formBadge} onChange={(e) => setFormBadge(e.target.value)}
              placeholder="🎁" maxLength={4} className="a-input w-16 text-center text-xl" />
            <span className="text-[11px] text-zinc-500">Эмодзи-значок рядом с товаром (необязательно)</span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
            <button onClick={() => setFormRedirectChat(!formRedirectChat)} className="flex items-center justify-between active:opacity-70">
              <span className="text-[11px] font-bold text-blue-400/90">Перекидывать в чат после покупки</span>
              {formRedirectChat ? <ToggleRight className="w-5 h-5 text-blue-400" /> : <ToggleLeft className="w-5 h-5 text-zinc-600" />}
            </button>
            {formRedirectChat && (
              <textarea value={formChatMsg} onChange={(e) => setFormChatMsg(e.target.value)} rows={2}
                placeholder="Автосообщение в чат после покупки (напр. «Заказ принят. Проверьте почту, пришлите код»)"
                className="a-input text-xs resize-none" />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">{t.purchaseFieldsCheckout}</p>
            {formFields.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                <span className="flex-1 text-white/70">{f.label}</span>
                <span className="text-[10px] text-zinc-600">{f.required ? t.requiredLabel : t.optionalLabel}</span>
                <button onClick={() => setFormFields(formFields.filter((_, j) => j !== i))}
                  className="w-5 h-5 rounded bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <X className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 items-center">
              <input value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addField()}
                placeholder={t.fieldLabelPlaceholder} className="a-input flex-1 text-xs" />
              <label className="flex items-center gap-1 text-[11px] text-zinc-500 flex-shrink-0 cursor-pointer select-none">
                <input type="checkbox" checked={newField.required}
                  onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                  className="w-3.5 h-3.5 accent-amber-500" />
                {t.reqLabel}
              </label>
              <button onClick={addField} disabled={!newField.label.trim()}
                className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 disabled:opacity-30">
                <Plus className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
          <button onClick={save} disabled={saving || !form.name.trim() || !form.price} className="a-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> {t.createProductBtn}</>}
          </button>
        </div>
      )}

      <div className="a-card mx-4 mt-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : products.length === 0 ? <Empty icon={Package} text={t.noProductsYet} />
          : products.map((product, i) => (
            <div key={product.id}>
              {i > 0 && <Divider />}
              <div className="flex items-center gap-3 px-4 py-3 active:bg-white/[0.02] cursor-pointer"
                onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}>
                <UploadBtn current={product.icon_url} onDone={(url) => updateIcon(product, url)} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">{product.name}</p>
                  <p className="text-[11px] text-zinc-600">{fmt(product.price)}</p>
                  <p className="text-[10px] text-zinc-700 mt-0.5">{product.sales_count} {t.sold} · {fmtShort(product.revenue)} sum</p>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-zinc-700 transition-transform ${expandedId === product.id ? "rotate-90" : ""}`} />
                  <button onClick={(e) => { e.stopPropagation(); adminDeleteProduct(product.id).then(load); }}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:opacity-70 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              {expandedId === product.id && (
                <AdminCardEditor product={product} gameId={game.id} onSaved={() => { load(); setExpandedId(null); }} />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

// ── CategoryList — categories within a game ───────────────────────────────────
function CategoryList({ game, onBack }: { game: Game; onBack: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);

  const load = async () => { setLoading(true); setCategories(await adminGetCategories(game.id)); setLoading(false); };
  useEffect(() => { load(); }, [game.id]);

  const save = async () => {
    if (!newCatName.trim()) return;
    setSaving(true);
    await adminCreateCategory(game.id, newCatName.trim());
    setNewCatName(""); setShowForm(false); setSaving(false); load();
  };

  if (selected) return <ProductList game={game} category={selected} onBack={() => { setSelected(null); load(); }} />;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030]">
        <button onClick={onBack} className="a-card w-8 h-8 flex items-center justify-center active:opacity-70">
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Категории</p>
          <p className="text-sm font-black text-white truncate">{game.name}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-500"}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mt-4 a-card p-4 flex gap-2">
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Название категории (напр. Гемы)" className="a-input flex-1 text-sm" />
          <button onClick={save} disabled={saving || !newCatName.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center disabled:opacity-30 active:opacity-70">
            {saving ? <RefreshCw className="w-4 h-4 text-white animate-spin" /> : <Check className="w-4 h-4 text-white" />}
          </button>
        </div>
      )}

      <div className="a-card mx-4 mt-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : categories.length === 0 ? <Empty icon={Tag} text="Категорий пока нет" />
          : categories.map((cat, i) => (
            <div key={cat.id}>
              {i > 0 && <Divider />}
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setSelected(cat)} className="flex-1 text-left active:opacity-70">
                  <p className="text-[13px] font-bold text-white">{cat.name}</p>
                  <p className="text-[11px] text-zinc-600">Нажмите для товаров</p>
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => adminDeleteCategory(cat.id).then(load)}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:opacity-70">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-zinc-700" />
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Catalog() {
  const { t } = useLang();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", desc: "", icon_url: "" });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Game | null>(null);

  const load = async () => { setLoading(true); setGames(await adminGetGames()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await adminCreateGame(form.name.trim(), form.desc.trim(), form.icon_url);
    setForm({ name: "", desc: "", icon_url: "" });
    setShowForm(false); setSaving(false); load();
  };

  const updateIcon = async (id: string, url: string) => {
    await adminPatchGame(id, { icon_url: url });
    load();
  };

  const updateBanner = async (id: string, url: string) => {
    await adminPatchGame(id, { banner_url: url });
    load();
  };

  if (selected) return <CategoryList game={selected} onBack={() => { setSelected(null); load(); }} />;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">{t.catalogTitle}</p>
          <h2 className="text-xl font-black text-white mt-0.5">{t.gamesTitle}</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-400"}`}>
          <Plus className="w-3.5 h-3.5" /> {t.addBtn}
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mb-3 a-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{t.newGame}</p>
          <div className="flex gap-3 items-start">
            <UploadBtn current={form.icon_url} onDone={(url) => setForm({ ...form, icon_url: url })} />
            <div className="flex-1 flex flex-col gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.gameNamePlaceholder} className="a-input" />
              <input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder={t.descOptional} className="a-input" />
            </div>
          </div>
          <button onClick={save} disabled={saving || !form.name.trim()} className="a-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> {t.createGameBtn}</>}
          </button>
        </div>
      )}

      <div className="a-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : games.length === 0 ? <Empty icon={Gamepad2} text={t.noGamesYet} />
          : games.map((g, i) => (
            <div key={g.id}>
              {i > 0 && <Divider />}
              <div className="flex flex-col gap-0">
                {/* Banner preview / upload */}
                <div className="relative w-full h-14 overflow-hidden rounded-t-xl"
                  style={{ background: g.banner_url ? "transparent" : "rgba(255,255,255,0.03)" }}>
                  {g.banner_url
                    ? <img src={g.banner_url} className="w-full h-full object-cover" alt="banner" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <p className="text-[10px] text-zinc-700">Баннер не загружен</p>
                      </div>
                  }
                  <label className="absolute inset-0 flex items-center justify-center cursor-pointer active:opacity-70"
                    style={{ background: "rgba(0,0,0,0.45)" }}>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}>
                      <Upload className="w-3 h-3 text-white" />
                      <span className="text-[10px] font-bold text-white">Баннер</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const { url } = await adminUpload(file); updateBanner(g.id, url);
                    }} />
                  </label>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <UploadBtn current={g.icon_url} onDone={(url) => updateIcon(g.id, url)} />
                  <button onClick={() => setSelected(g)} className="flex-1 text-left min-w-0 active:opacity-70">
                    <p className="text-[13px] font-bold text-white">{g.name}</p>
                    <p className="text-[11px] text-zinc-600">Категории и товары</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => adminDeleteGame(g.id).then(load)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:opacity-70">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-zinc-700" />
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function Analytics() {
  const { t } = useLang();
  const [period, setPeriod] = useState(7);
  const [view, setView] = useState<"sales" | "products" | "users">("sales");
  const [salesData, setSalesData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (view === "sales") setSalesData(await adminSalesStats(period));
    else if (view === "products") setProductsData(await adminProductStats());
    else setUsersData(await adminUserStats());
    setLoading(false);
  }, [view, period]);

  useEffect(() => { load(); }, [load]);

  const maxRev = salesData.reduce((a, b) => Math.max(a, b.revenue), 0);

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">{t.insights}</p>
        <h2 className="text-xl font-black text-white mt-0.5">{t.analyticsTitle}</h2>
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 px-4 pb-3 no-scrollbar overflow-x-auto">
        {([["sales", t.salesTab], ["products", t.productsTab], ["users", t.usersTab]] as [string, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setView(v as typeof view)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${view === v ? "bg-white/10 text-white" : "text-zinc-600"}`}>
            {l}
          </button>
        ))}
        {view === "sales" && [7, 14, 30].map((d) => (
          <button key={d} onClick={() => setPeriod(d)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${period === d ? "bg-sky-500/20 text-sky-400" : "text-zinc-600"}`}>
            {d}d
          </button>
        ))}
        <button onClick={load} className="ml-auto flex-shrink-0 p-1.5 text-zinc-600 active:text-white"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spin /></div> : (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Sales chart */}
          {view === "sales" && (
            salesData.length === 0 ? <Empty icon={BarChart2} text={t.noSalesData} /> : (
              <div className="a-card p-4 flex flex-col gap-4">
                <p className="text-xs font-bold text-zinc-500">{t.revenueByDay}</p>
                <div className="flex items-end gap-1 h-28">
                  {salesData.map((d) => (
                    <div key={d._id} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-sm"
                        style={{ height: maxRev > 0 ? `${Math.max(4, (d.revenue / maxRev) * 96)}px` : "4px", background: "linear-gradient(to top, #7c3aed, #a78bfa)" }} />
                      <p className="text-[8px] text-zinc-700">{d._id.slice(5)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[11px]">
                  <div><p className="text-zinc-600">{t.ordersLabel}</p><p className="text-white font-bold">{salesData.reduce((a, b) => a + b.count, 0)}</p></div>
                  <div className="text-right"><p className="text-zinc-600">{t.revenueLabel}</p><p className="text-violet-400 font-bold">{fmtShort(salesData.reduce((a, b) => a + b.revenue, 0))} sum</p></div>
                </div>
              </div>
            )
          )}

          {/* Top products */}
          {view === "products" && (
            productsData.length === 0 ? <Empty icon={Package} text={t.noSalesYet} /> : (
              <div className="a-card overflow-hidden">
                {productsData.map((p, i) => (
                  <div key={p._id}>
                    {i > 0 && <Divider />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-[11px] font-black text-zinc-700 w-5 text-center">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-white truncate">{p.name}</p>
                        <p className="text-[11px] text-zinc-600">{p.count} {t.salesCount}</p>
                      </div>
                      <span className="text-[12px] font-black text-violet-400">{fmtShort(p.revenue)} sum</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Top users */}
          {view === "users" && (
            usersData.length === 0 ? <Empty icon={Users} text={t.noUsersYet} /> : (
              <div className="a-card overflow-hidden">
                {usersData.map((u, i) => (
                  <div key={u._id}>
                    {i > 0 && <Divider />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className={`text-[11px] font-black w-5 text-center ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-400" : i === 2 ? "text-orange-700" : "text-zinc-700"}`}>#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-white">{u.first_name}{u.username ? ` @${u.username}` : ""}</p>
                        <p className="text-[11px] text-zinc-600">{u.order_count} {t.ordersCount}</p>
                      </div>
                      <span className="text-[12px] font-black text-violet-400">{fmtShort(u.total_spent)} sum</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Promos ───────────────────────────────────────────────────────────────────
function Promos() {
  const { t } = useLang();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", discount_pct: "", min_order_amount: "", max_uses: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => { setLoading(true); setPromos(await adminGetPromos()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.code.trim() || !form.discount_pct) return;
    setSaving(true); setErr("");
    try {
      await adminCreatePromo({
        code: form.code.toUpperCase().trim(),
        discount_pct: Number(form.discount_pct),
        min_order_amount: Number(form.min_order_amount) || 0,
        max_uses: Number(form.max_uses) || 0,
      });
      setForm({ code: "", discount_pct: "", min_order_amount: "", max_uses: "" });
      setShowForm(false);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">{t.discounts}</p>
          <h2 className="text-xl font-black text-white mt-0.5">{t.promoCodesTitle}</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-400"}`}>
          <Plus className="w-3.5 h-3.5" /> {t.createBtn}
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mb-3 a-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{t.newPromo}</p>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="PROMO CODE *" className="a-input font-mono tracking-widest uppercase" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-zinc-600 mb-1">{t.discountPct}</p>
              <input value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
                placeholder="e.g. 20" type="number" min="1" max="100" className="a-input" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 mb-1">{t.minOrder}</p>
              <input value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                placeholder="e.g. 100000" type="number" className="a-input" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 mb-1">{t.maxUses}</p>
            <input value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              placeholder="e.g. 100" type="number" className="a-input" />
          </div>
          {err && <div className="flex items-center gap-2 text-red-400 text-[11px]"><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
          <button onClick={save} disabled={saving || !form.code.trim() || !form.discount_pct} className="a-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Tag className="w-4 h-4" /> {t.createPromoBtn}</>}
          </button>
        </div>
      )}

      <div className="a-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : promos.length === 0 ? <Empty icon={Tag} text={t.noPromoCodesYet} />
          : promos.map((p, i) => (
            <div key={p.id}>
              {i > 0 && <Divider />}
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-white tracking-widest">{p.code}</span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-violet-400/10 text-violet-400">-{p.discount_pct}%</span>
                    {!p.is_active && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-400/10 text-red-400">OFF</span>}
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    {p.min_order_amount > 0 ? `Min ${fmtShort(p.min_order_amount)} sum · ` : "No minimum · "}
                    {p.uses}/{p.max_uses > 0 ? p.max_uses : "∞"} used
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => adminTogglePromo(p.id).then(load)} className="active:opacity-70">
                    {p.is_active
                      ? <ToggleRight className="w-6 h-6 text-emerald-400" />
                      : <ToggleLeft className="w-6 h-6 text-zinc-600" />
                    }
                  </button>
                  <button onClick={() => adminDeletePromo(p.id).then(load)}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:opacity-70">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Admin Chat ───────────────────────────────────────────────────────────────
interface ChatMsg { id: string; from: string; text: string; ts: string }
interface ChatUser { user_id: number; user_name: string; first_name: string; unread: number; last_ts: string; last_message: string }
interface AllUser { user_id: number; username: string; first_name: string; balance: number }

type ChatTab = "active" | "all";

function AdminChat({ initialTarget }: { initialTarget?: { user_id: number; name: string; username: string } | null }) {
  const [chats, setChats] = useState<ChatUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [tab, setTab] = useState<ChatTab>("active");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ user_id: number; name: string; username: string } | null>(initialTarget ?? null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load all users when tab switches to "all"
  useEffect(() => {
    if (tab !== "all") return;
    setAllLoading(true);
    agentGetAllUsers(search).then(setAllUsers).catch(() => {}).finally(() => setAllLoading(false));
  }, [tab, search]);

  // Auto-open initialTarget chat once WS connects
  useEffect(() => {
    if (!initialTarget || !connected) return;
    openChat(initialTarget.user_id, initialTarget.name, initialTarget.username);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, initialTarget]);

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
          const uid = data.user_id;
          setChats((prev) => {
            const idx = prev.findIndex((c) => c.user_id === uid);
            const base = idx >= 0 ? prev[idx] : {
              user_id: uid, user_name: data.user_name || "", first_name: data.first_name || "",
              unread: 0, last_ts: data.ts, last_message: data.text,
            };
            const updated = {
              ...base, last_message: data.text, last_ts: data.ts,
              unread: data.from === "user" ? (base.unread || 0) + 1 : base.unread,
            };
            if (idx >= 0) { const next = [...prev]; next.splice(idx, 1); return [updated, ...next]; }
            return [updated, ...prev];
          });
          setSelected((sel) => {
            if (sel?.user_id === uid) {
              setMessages((prev) => prev.find((m) => m.id === data.id) ? prev
                : [...prev, { id: data.id, from: data.from, text: data.text, ts: data.ts }]);
            }
            return sel;
          });
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, []);

  const openChat = useCallback((user_id: number, name: string, username: string, user_name = "") => {
    setSelected({ user_id, name, username });
    setMessages([]);
    setChats((prev) => prev.map((c) => c.user_id === user_id ? { ...c, unread: 0 } : c));
    const payload = JSON.stringify({ type: "select_chat", user_id, user_name: username || user_name, first_name: name });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
    } else {
      // WS not ready yet — send after open
      const ws = wsRef.current;
      if (ws) { const prev = ws.onopen; ws.onopen = (e) => { if (prev) (prev as (e: Event) => void)(e); ws.send(payload); }; }
    }
  }, []);

  const send = useCallback(() => {
    if (!selected || !text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", to_user_id: selected.user_id, text: text.trim() }));
    setText("");
  }, [selected, text]);

  const fmt = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };
  const fmtDate = (ts: string) => {
    try {
      const d = new Date(ts), now = new Date();
      return d.toDateString() === now.toDateString()
        ? d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("ru", { day: "numeric", month: "short" });
    } catch { return ""; }
  };

  const avatar = (name: string) => (name || "U")[0].toUpperCase();

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="flex flex-col" style={{ height: "calc(100dvh - 115px)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-[#1e2030]">
          <button onClick={() => setSelected(null)}
            className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center active:opacity-70">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            {avatar(selected.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">{selected.name || `User ${selected.user_id}`}</p>
            {selected.username && <p className="text-[11px] text-white/40">@{selected.username}</p>}
          </div>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400" : "bg-white/20"}`} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 overscroll-contain">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-zinc-700">
              <MessageCircle className="w-9 h-9" />
              <p className="text-sm text-center">Начните диалог — напишите первым</p>
            </div>
          )}
          {messages.map((msg) => {
            const isAgent = msg.from === "agent";
            return (
              <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={isAgent
                    ? { background: "linear-gradient(135deg,#f59e0b,#d97706)", borderBottomRightRadius: 4 }
                    : { background: "rgba(255,255,255,0.07)", borderBottomLeftRadius: 4 }
                  }>
                  <p className="text-white break-words">{msg.text}</p>
                  <p className={`text-[10px] mt-1 text-white/40 ${isAgent ? "text-right" : ""}`}>{fmt(msg.ts)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 flex items-end gap-2 flex-shrink-0 border-t border-[#1e2030]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Написать клиенту..."
            rows={1}
            className="flex-1 a-input resize-none outline-none"
            style={{ maxHeight: 120, minHeight: 44 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button onClick={send} disabled={!text.trim() || !connected}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-70 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  const totalUnread = chats.reduce((s, c) => s + (c.unread || 0), 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ height: "calc(100dvh - 115px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 flex-shrink-0">
        <MessageCircle className="w-5 h-5 text-amber-400" />
        <div className="flex-1">
          <h2 className="text-xl font-black text-white">Чаты</h2>
        </div>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400" : "bg-white/20"}`} />
      </div>

      {/* Tabs */}
      <div className="flex px-4 pb-2 gap-2 flex-shrink-0">
        <button onClick={() => setTab("active")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${tab === "active" ? "bg-amber-500/20 text-amber-400" : "text-zinc-600"}`}>
          Активные
          {totalUnread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black text-black" style={{ background: "#f59e0b" }}>
              {totalUnread}
            </span>
          )}
        </button>
        <button onClick={() => setTab("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${tab === "all" ? "bg-amber-500/20 text-amber-400" : "text-zinc-600"}`}>
          <Users className="w-3.5 h-3.5" />
          Все клиенты
        </button>
      </div>

      {/* Search (only on "all" tab) */}
      {tab === "all" && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08]">
            <Search className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или @username..."
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder-zinc-700"
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 pb-4 overscroll-contain">

        {/* Active chats tab */}
        {tab === "active" && (
          chats.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-zinc-700">
              <MessageCircle className="w-10 h-10" />
              <p className="text-sm">Нет активных чатов</p>
              <button onClick={() => setTab("all")} className="text-xs text-amber-500 font-bold">
                Написать первым →
              </button>
            </div>
          ) : (
            chats.map((chat) => (
              <button key={chat.user_id}
                onClick={() => openChat(chat.user_id, chat.first_name || chat.user_name, chat.user_name, chat.user_name)}
                className="a-card flex items-center gap-3 p-3.5 active:opacity-70 text-left w-full">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                  {avatar(chat.first_name || chat.user_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-white truncate">
                      {chat.first_name || chat.user_name || `User ${chat.user_id}`}
                    </p>
                    <p className="text-[10px] text-zinc-700 flex-shrink-0">{fmtDate(chat.last_ts)}</p>
                  </div>
                  <p className="text-[12px] text-zinc-600 truncate mt-0.5">{chat.last_message || "..."}</p>
                </div>
                {chat.unread > 0 && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "#f59e0b" }}>
                    <span className="text-[10px] font-bold text-black">{chat.unread}</span>
                  </div>
                )}
              </button>
            ))
          )
        )}

        {/* All users tab */}
        {tab === "all" && (
          allLoading ? (
            <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" /></div>
          ) : allUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-zinc-700">
              <Users className="w-10 h-10" />
              <p className="text-sm">{search ? "Не найдено" : "Нет пользователей"}</p>
            </div>
          ) : (
            allUsers.map((u) => {
              const hasChat = chats.some((c) => c.user_id === u.user_id);
              return (
                <button key={u.user_id}
                  onClick={() => openChat(u.user_id, u.first_name || u.username, u.username)}
                  className="a-card flex items-center gap-3 p-3.5 active:opacity-70 text-left w-full">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: hasChat ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.07)" }}>
                    {avatar(u.first_name || u.username)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-white truncate">
                        {u.first_name || u.username || `User ${u.user_id}`}
                      </p>
                      {hasChat && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 flex-shrink-0">
                          чат
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {u.username ? `@${u.username} · ` : ""}{u.balance.toLocaleString()} sum
                    </p>
                  </div>
                  <MessageCircle className="w-4 h-4 text-zinc-700 flex-shrink-0" />
                </button>
              );
            })
          )
        )}
      </div>
    </div>
  );
}

// ─── Admin Order Chats ────────────────────────────────────────────────────────
interface OrderChatMsg { id: string; from: string; text: string; ts: string }

function AdminOrderChats({ initialOrderId }: { initialOrderId?: string | null }) {
  const [chats, setChats] = useState<AdminOrderChat[]>([]);
  const [selected, setSelected] = useState<AdminOrderChat | null>(null);
  const [messages, setMessages] = useState<OrderChatMsg[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [filterGame, setFilterGame] = useState("");
  const [games, setGames] = useState<{ id: string; name: string }[]>([]);
  const [confirming, setConfirming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialHandledRef = useRef(false);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load REST chats + games
  useEffect(() => {
    adminGetOrderChats().then(setChats).catch(() => {});
    adminGetGames().then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData || "";

    const connect = () => {
      if (!mountedRef.current) return;
      const url = `${getOrderChatWsUrl()}?initData=${encodeURIComponent(initData)}`;
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
          if (data.type === "order_chats") {
            setChats(data.chats || []);
          } else if (data.type === "order_history") {
            setMessages(data.messages || []);
          } else if (data.type === "message") {
            const oid = data.order_id;
            setChats((prev) => {
              const idx = prev.findIndex((c) => c.order_id === oid);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], last_message: data.text, last_ts: data.ts,
                  unread_by_admin: data.from === "user" ? (next[idx].unread_by_admin || 0) + 1 : next[idx].unread_by_admin };
                return next;
              }
              return prev;
            });
            setSelected((sel) => {
              if (sel?.order_id === oid) {
                setMessages((prev) =>
                  prev.find((m) => m.id === data.id) ? prev : [...prev, { id: data.id, from: data.from, text: data.text, ts: data.ts }]
                );
              }
              return sel;
            });
          }
        } catch { /* ignore */ }
      };
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  const openChat = (chat: AdminOrderChat) => {
    setSelected(chat);
    setMessages([]);
    setChats((prev) => prev.map((c) => c.order_id === chat.order_id ? { ...c, unread_by_admin: 0 } : c));
    const payload = JSON.stringify({ type: "select_order", order_id: chat.order_id });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload);
    }
  };

  // Auto-open a specific order chat when navigated from Orders section
  useEffect(() => {
    if (!initialOrderId || initialHandledRef.current || chats.length === 0) return;
    const target = chats.find((c) => c.order_id === initialOrderId);
    if (target) {
      initialHandledRef.current = true;
      openChat(target);
    }
  }, [initialOrderId, chats, connected]);

  const send = () => {
    if (!selected || !text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", order_id: selected.order_id, text: text.trim() }));
    setText("");
  };

  const fmtTs = (ts: string) => {
    try {
      const d = new Date(ts), now = new Date();
      return d.toDateString() === now.toDateString()
        ? d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("ru", { day: "numeric", month: "short" });
    } catch { return ""; }
  };
  const fmtTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  const filtered = filterGame ? chats.filter((c) => c.game_id === filterGame) : chats;
  const totalUnread = chats.reduce((s, c) => s + (c.unread_by_admin || 0), 0);

  const confirmOrder = async () => {
    if (!selected || confirming) return;
    setConfirming(true);
    try {
      await adminCompleteOrder(selected.order_id);
      setSelected(null);
      adminGetOrderChats().then(setChats).catch(() => {});
    } finally { setConfirming(false); }
  };

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="flex flex-col" style={{ height: "calc(100dvh - 115px)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-[#1e2030]">
          <button onClick={() => setSelected(null)}
            className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center active:opacity-70">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">
              {selected.first_name || selected.username
                ? `${selected.first_name || ""}${selected.username ? ` @${selected.username}` : ""}`
                : `user ${selected.user_id}`}
            </p>
            <p className="text-[10px] text-white/40 truncate">
              {selected.product_name || "Заказ"}{selected.game_name ? ` · ${selected.game_name}` : ""}
            </p>
          </div>
          <button
            onClick={confirmOrder}
            disabled={confirming}
            className="px-3 h-8 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold flex items-center gap-1 active:opacity-70 disabled:opacity-40 flex-shrink-0"
          >
            <Check className="w-3.5 h-3.5" /> Подтвердить
          </button>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400" : "bg-white/20"}`} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 overscroll-contain">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-zinc-700">
              <MessageCircle className="w-9 h-9" />
              <p className="text-sm text-center">Начните диалог — напишите первым</p>
            </div>
          )}
          {messages.map((msg) => {
            const isAdmin = msg.from === "admin";
            return (
              <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={isAdmin
                    ? { background: "linear-gradient(135deg,#f59e0b,#d97706)", borderBottomRightRadius: 4 }
                    : { background: "rgba(255,255,255,0.07)", borderBottomLeftRadius: 4 }
                  }>
                  <p className="text-white break-words">{msg.text}</p>
                  <p className={`text-[10px] mt-1 text-white/40 ${isAdmin ? "text-right" : ""}`}>{fmtTime(msg.ts)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 flex items-end gap-2 flex-shrink-0 border-t border-[#1e2030]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Написать клиенту..."
            rows={1}
            className="flex-1 a-input resize-none outline-none"
            style={{ maxHeight: 120, minHeight: 44 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button onClick={send} disabled={!text.trim() || !connected}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-70 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ height: "calc(100dvh - 115px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 flex-shrink-0">
        <MessageCircle className="w-5 h-5 text-amber-400" />
        <div className="flex-1">
          <h2 className="text-xl font-black text-white">
            Заказы чаты
            {totalUnread > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-black text-black" style={{ background: "#f59e0b" }}>
                {totalUnread}
              </span>
            )}
          </h2>
        </div>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400" : "bg-white/20"}`} />
      </div>

      {/* Game filter */}
      <div className="flex items-center gap-2 px-4 pb-2 flex-shrink-0 overflow-x-auto">
        <button onClick={() => setFilterGame("")}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex-shrink-0 transition-all ${!filterGame ? "bg-amber-500/20 text-amber-400" : "text-zinc-600"}`}>
          Все
        </button>
        {games.map((g) => (
          <button key={g.id} onClick={() => setFilterGame(filterGame === g.id ? "" : g.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex-shrink-0 transition-all ${filterGame === g.id ? "bg-amber-500/20 text-amber-400" : "text-zinc-600"}`}>
            {g.name}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 pb-4 overscroll-contain">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-zinc-700">
            <MessageCircle className="w-10 h-10" />
            <p className="text-sm">Нет чатов по заказам</p>
          </div>
        ) : (
          filtered.map((chat) => {
            const displayName = chat.first_name || chat.username || `user ${chat.user_id}`;
            const initial = displayName[0].toUpperCase();
            return (
              <button key={chat.order_id} onClick={() => openChat(chat)}
                className="a-card flex items-center gap-3 p-3.5 active:opacity-70 text-left w-full">
                {/* User avatar */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 relative"
                  style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                  {initial}
                  {chat.unread_by_admin > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center px-0.5 border border-[#0d0e14]"
                      style={{ background: "#ef4444" }}>
                      <span className="text-[9px] font-black text-white leading-none">{chat.unread_by_admin > 9 ? "9+" : chat.unread_by_admin}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + time */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-white truncate">
                      {chat.first_name || chat.username || `user ${chat.user_id}`}
                      {chat.username && chat.first_name && (
                        <span className="text-zinc-600 font-normal text-[11px]"> @{chat.username}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-zinc-700 flex-shrink-0">{fmtTs(chat.last_ts)}</p>
                  </div>
                  {/* Product + game */}
                  <p className="text-[11px] text-amber-400/70 truncate mt-0.5">
                    {chat.product_name || "Заказ"}{chat.game_name ? ` · ${chat.game_name}` : ""}
                  </p>
                  {/* Last message */}
                  <p className="text-[12px] text-zinc-600 truncate mt-0.5">{chat.last_message || "—"}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Banners ──────────────────────────────────────────────────────────────────
const GRADIENT_OPTIONS = [
  { id: "pink",   label: "Green",  style: "#22c55e" },
  { id: "gold",   label: "Gold",   style: "linear-gradient(135deg,#F59E0B,#EF4444)" },
  { id: "blue",   label: "Blue",   style: "linear-gradient(135deg,#3B82F6,#06B6D4)" },
  { id: "green",  label: "Green",  style: "linear-gradient(135deg,#10B981,#3B82F6)" },
  { id: "orange", label: "Orange", style: "linear-gradient(135deg,#F97316,#EAB308)" },
];

function Banners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", subtitle: "", gradient: "pink", emoji: "🎉" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => { setLoading(true); setBanners(await adminGetBanners()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true); setErr("");
    try {
      await adminCreateBanner(form);
      setForm({ title: "", subtitle: "", gradient: "pink", emoji: "🎉" });
      setShowForm(false);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  const gradientStyle = (id: string) => GRADIENT_OPTIONS.find(g => g.id === id)?.style ?? GRADIENT_OPTIONS[0].style;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Каталог</p>
          <h2 className="text-xl font-black text-white mt-0.5">Баннеры</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-400"}`}>
          <Plus className="w-3.5 h-3.5" /> Создать
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mb-3 a-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Новый баннер</p>

          {/* Preview */}
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: gradientStyle(form.gradient), boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <span className="text-3xl">{form.emoji || "🎉"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm truncate">{form.title || "Заголовок"}</p>
              {form.subtitle && <p className="text-white/70 text-[11px] truncate mt-0.5">{form.subtitle}</p>}
            </div>
          </div>

          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Заголовок *" className="a-input" />
          <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            placeholder="Подзаголовок (необязательно)" className="a-input" />

          <div className="flex gap-2 items-center">
            <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              placeholder="Эмодзи" className="a-input w-20 text-center text-xl" maxLength={4} />
            <div className="flex gap-1.5 flex-1">
              {GRADIENT_OPTIONS.map(g => (
                <button key={g.id} onClick={() => setForm({ ...form, gradient: g.id })}
                  className="flex-1 h-8 rounded-xl transition-all"
                  style={{
                    background: g.style,
                    border: form.gradient === g.id ? "2px solid white" : "2px solid transparent",
                    opacity: form.gradient === g.id ? 1 : 0.5,
                  }} />
              ))}
            </div>
          </div>

          {err && <div className="flex items-center gap-2 text-red-400 text-[11px]"><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
          <button onClick={save} disabled={saving || !form.title.trim()} className="a-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Создать баннер</>}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 mx-4 mb-4">
        {loading ? <div className="a-card flex justify-center py-10"><Spin /></div>
          : banners.length === 0
          ? <div className="a-card flex flex-col items-center gap-2 py-10">
              <Package className="w-8 h-8 text-zinc-700" />
              <p className="text-zinc-600 text-sm">Баннеров пока нет</p>
            </div>
          : banners.map((b) => (
            <div key={b.id} className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${b.active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)"}`, opacity: b.active ? 1 : 0.5 }}>
              {/* Banner preview */}
              <div className="p-3 flex items-center gap-3"
                style={{ background: b.active ? gradientStyle(b.gradient) : "#1a1c27" }}>
                <span className="text-2xl">{b.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm truncate">{b.title}</p>
                  {b.subtitle && <p className="text-white/70 text-[11px] truncate">{b.subtitle}</p>}
                </div>
              </div>
              {/* Controls */}
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#13141f" }}>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.active ? "bg-emerald-400/10 text-emerald-400" : "bg-zinc-700/40 text-zinc-500"}`}>
                  {b.active ? "Активен" : "Скрыт"}
                </span>
                <div className="flex-1" />
                <button onClick={async () => { await adminToggleBanner(b.id); load(); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:opacity-70"
                  style={{ background: "rgba(255,255,255,0.05)", color: b.active ? "#facc15" : "#10b981" }}>
                  {b.active ? <><ToggleLeft className="w-3.5 h-3.5" /> Скрыть</> : <><ToggleRight className="w-3.5 h-3.5" /> Показать</>}
                </button>
                <button onClick={async () => { if (confirm("Удалить баннер?")) { await adminDeleteBanner(b.id); load(); } }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-70"
                  style={{ background: "rgba(239,68,68,0.10)", color: "#f87171" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── Payment methods ──────────────────────────────────────────────────────────
function PaymentMethodsSection() {
  const empty = { label: "", icon: "💳", requisites: "", holder: "", note: "" };
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => { setLoading(true); setMethods(await adminGetPaymentMethods()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm(empty); setErr(""); setShowForm(true); };
  const openEdit = (m: PaymentMethod) => {
    setEditingId(m.id);
    setForm({ label: m.label, icon: m.icon || "💳", requisites: m.requisites, holder: m.holder, note: m.note });
    setErr(""); setShowForm(true);
  };

  const save = async () => {
    if (!form.label.trim() || !form.requisites.trim()) return;
    setSaving(true); setErr("");
    try {
      if (editingId) await adminUpdatePaymentMethod(editingId, form);
      else await adminCreatePaymentMethod(form);
      setForm(empty); setEditingId(null); setShowForm(false);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Оплата</p>
          <h2 className="text-xl font-black text-white mt-0.5">Способы оплаты</h2>
        </div>
        <button onClick={showForm ? () => setShowForm(false) : openCreate}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-400"}`}>
          <Plus className="w-3.5 h-3.5" /> {showForm ? "Отмена" : "Добавить"}
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mb-3 a-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{editingId ? "Редактировать способ" : "Новый способ"}</p>
          <div className="flex gap-2 items-center">
            <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="💳" maxLength={4} className="a-input w-16 text-center text-xl" />
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Название (Humo, Uzcard) *" className="a-input flex-1" />
          </div>
          <input value={form.requisites} onChange={(e) => setForm({ ...form, requisites: e.target.value })}
            placeholder="Номер карты / реквизиты *" className="a-input" />
          <input value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })}
            placeholder="Владелец карты (необязательно)" className="a-input" />
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2}
            placeholder="Своя подсказка покупателю (необязательно)" className="a-input resize-none" />
          {err && <div className="flex items-center gap-2 text-red-400 text-[11px]"><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
          <button onClick={save} disabled={saving || !form.label.trim() || !form.requisites.trim()} className="a-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> {editingId ? "Сохранить" : "Добавить способ"}</>}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 mx-4 mb-4">
        {loading ? <div className="a-card flex justify-center py-10"><Spin /></div>
          : methods.length === 0
          ? <div className="a-card flex flex-col items-center gap-2 py-10">
              <CreditCard className="w-8 h-8 text-zinc-700" />
              <p className="text-zinc-600 text-sm">Способов оплаты пока нет</p>
            </div>
          : methods.map((m) => (
            <div key={m.id} className="a-card p-3 flex flex-col gap-2"
              style={{ opacity: m.is_active ? 1 : 0.5 }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm truncate">{m.label}</p>
                  <p className="text-zinc-500 text-[11px] truncate">{m.requisites}{m.holder ? ` · ${m.holder}` : ""}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.is_active ? "bg-emerald-400/10 text-emerald-400" : "bg-zinc-700/40 text-zinc-500"}`}>
                  {m.is_active ? "Активен" : "Скрыт"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(m)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:opacity-70"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa" }}>
                  Изменить
                </button>
                <div className="flex-1" />
                <button onClick={async () => { await adminTogglePaymentMethod(m.id); load(); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:opacity-70"
                  style={{ background: "rgba(255,255,255,0.05)", color: m.is_active ? "#facc15" : "#10b981" }}>
                  {m.is_active ? <><ToggleLeft className="w-3.5 h-3.5" /> Скрыть</> : <><ToggleRight className="w-3.5 h-3.5" /> Показать</>}
                </button>
                <button onClick={async () => { if (confirm("Удалить способ оплаты?")) { await adminDeletePaymentMethod(m.id); load(); } }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-70"
                  style={{ background: "rgba(239,68,68,0.10)", color: "#f87171" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { t, lang, setLang } = useLang();
  const [section, setSection] = useState<Section>(() => {
    const param = new URLSearchParams(window.location.search).get("section") as Section | null;
    if (param && (["dashboard","payments","orders","catalog","analytics","promos","banners","payment_methods","chat","order_chats"] as string[]).includes(param)) {
      window.history.replaceState({}, "", window.location.pathname);
      return param;
    }
    return "dashboard";
  });
  const [adminAvatarUrl, setAdminAvatarUrl] = useState("");
  const [adminName, setAdminName] = useState("A");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [orderChatTarget, setOrderChatTarget] = useState<string | null>(null);

  const handleOpenChat = useCallback((order_id: string) => {
    setOrderChatTarget(order_id);
    setSection("order_chats");
  }, []);

  useEffect(() => {
    getMe().then((u: { first_name: string; avatar_url?: string }) => {
      setAdminName(u.first_name?.[0] ?? "A");
      setAdminAvatarUrl(u.avatar_url ?? "");
    }).catch(() => {});
  }, []);

  const handleAdminAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const { url } = await uploadAvatar(file);
      setAdminAvatarUrl(url);
    } catch {
      window.Telegram?.WebApp?.showAlert("Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  };

  const [showMoreNav, setShowMoreNav] = useState(false);

  const NAV_PRIMARY: { id: Section; label: string; Icon: React.ElementType }[] = [
    { id: "dashboard",   label: t.adHome,   Icon: LayoutDashboard },
    { id: "payments",    label: t.adPay,    Icon: CreditCard },
    { id: "orders",      label: t.adOrders, Icon: ShoppingBag },
    { id: "order_chats", label: "Чаты",     Icon: MessageCircle },
  ];

  const NAV_MORE: { id: Section; label: string; Icon: React.ElementType }[] = [
    { id: "catalog",   label: t.adCatalog, Icon: Gamepad2 },
    { id: "analytics", label: t.adStats,   Icon: BarChart2 },
    { id: "promos",    label: t.adPromos,  Icon: Tag },
    { id: "banners",   label: "Баннеры",   Icon: Package },
    { id: "payment_methods", label: "Оплата", Icon: CreditCard },
  ];

  return (
    <div className="a-shell flex flex-col min-h-dvh">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1a1c27]" style={{ background: "#0d0e14" }}>
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div
            onClick={() => avatarRef.current?.click()}
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center cursor-pointer active:opacity-70"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
          >
            {adminAvatarUrl
              ? <img src={adminAvatarUrl} className="w-full h-full object-cover" alt="admin avatar" />
              : <span className="text-white text-xs font-black">{adminName}</span>
            }
            {avatarUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center border border-[#0d0e14]">
            <Camera className="w-2 h-2 text-white" />
          </div>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAdminAvatar} />
        </div>

        <span className="text-[13px] font-black tracking-wider text-white flex-1">ADMIN</span>

        {/* Language toggle */}
        <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
          {(["ru", "uz"] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${
                lang === l ? "bg-amber-500 text-white" : "text-zinc-600"
              }`}>
              {l}
            </button>
          ))}
        </div>

        <span className="px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 text-[10px] font-black uppercase tracking-widest">Superuser</span>
      </div>

      {/* Content */}
      <div className={`flex-1 ${section === "chat" || section === "order_chats" ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
        {section === "dashboard"   && <Dashboard onNav={setSection} />}
        {section === "payments"    && <Payments />}
        {section === "orders"      && <Orders onChat={handleOpenChat} />}
        {section === "catalog"     && <Catalog />}
        {section === "analytics"   && <Analytics />}
        {section === "promos"      && <Promos />}
        {section === "banners"     && <Banners />}
        {section === "payment_methods" && <PaymentMethodsSection />}
        {section === "chat"        && <AdminChat initialTarget={null} />}
        {section === "order_chats" && <AdminOrderChats initialOrderId={orderChatTarget} />}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-[#1a1c27] relative" style={{ background: "#0d0e14" }}>
        {/* Overflow popup */}
        {showMoreNav && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMoreNav(false)} />
            <div className="absolute bottom-full right-0 mb-1 mr-1 z-50 rounded-2xl overflow-hidden"
              style={{ background: "#13141f", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 -8px 32px rgba(0,0,0,0.6)", minWidth: 160 }}>
              {NAV_MORE.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => { setSection(id); setShowMoreNav(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 active:opacity-70 transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <Icon className={`w-4 h-4 ${section === id ? "text-amber-400" : "text-zinc-500"}`} />
                  <span className={`text-[12px] font-bold ${section === id ? "text-amber-400" : "text-zinc-400"}`}>{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex">
          {NAV_PRIMARY.map(({ id, label, Icon }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative">
                <Icon className={`w-4 h-4 transition-colors ${active ? "text-amber-400" : "text-zinc-700"}`} />
                <span className={`text-[9px] font-bold uppercase tracking-wide ${active ? "text-amber-400" : "text-zinc-700"}`}>{label}</span>
              </button>
            );
          })}
          {/* "..." more button */}
          <button onClick={() => setShowMoreNav((v) => !v)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative">
            <div className={`flex items-center gap-[3px] h-4 ${NAV_MORE.some(n => n.id === section) ? "text-amber-400" : "text-zinc-700"}`}>
              {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-current" />)}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wide ${NAV_MORE.some(n => n.id === section) ? "text-amber-400" : "text-zinc-700"}`}>
              {NAV_MORE.some(n => n.id === section) ? NAV_MORE.find(n => n.id === section)?.label : "Ещё"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
