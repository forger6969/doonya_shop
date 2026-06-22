import { useEffect, useState, useCallback, useRef } from "react";
import {
  LayoutDashboard, CreditCard, ShoppingBag, Gamepad2,
  BarChart2, Tag, Check, X, ChevronLeft, Plus, Trash2,
  RefreshCw, Eye, ChevronRight, TrendingUp, Users,
  Upload, AlertCircle, ToggleLeft, ToggleRight, Package, Camera,
} from "lucide-react";
import {
  adminGetStats, adminUpload, getMe, uploadAvatar,
  adminGetTopups, adminGetOrders, adminConfirmTopup, adminRejectTopup, adminCompleteOrder,
  adminGetGames, adminGetProducts, adminCreateGame, adminPatchGame, adminDeleteGame,
  adminGetCategories, adminCreateCategory, adminDeleteCategory,
  adminCreateProduct, adminPatchProduct, adminDeleteProduct, adminSetDiscount,
  adminSalesStats, adminProductStats, adminUserStats,
  adminGetPromos, adminCreatePromo, adminDeletePromo, adminTogglePromo,
} from "../api";
import { useLang, type Lang } from "../i18n";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Stats { pending_topups: number; pending_orders: number; total_games: number; total_products: number; total_revenue: number }
interface Topup { id: string; user_id: number; amount: number; unique_amount: number; method: string; receipt_url: string; status: string; created_at: string }
interface Order { id: string; user_id: number; amount: number; status: string; promo_code: string; created_at: string }
interface Game { id: string; name: string; description: string; icon_url: string }
interface Category { id: string; game_id: string; name: string }
interface PurchaseField { label: string; required: boolean }
interface Product { id: string; category_id?: string; category_name?: string; name: string; description: string; price: number; icon_url: string; sales_count: number; revenue: number; purchase_fields: PurchaseField[]; discount_percent?: number; discount_enabled?: boolean; discount_until?: string | null }
interface Promo { id: string; code: string; discount_pct: number; min_order_amount: number; max_uses: number; uses: number; is_active: boolean; created_at: string }

type Section = "dashboard" | "payments" | "orders" | "catalog" | "analytics" | "promos";

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
function Orders() {
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
          : orders.map((o, i) => (
            <div key={o.id}>
              {i > 0 && <Divider />}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-violet-400/10 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white">{fmt(o.amount)}</p>
                  <p className="text-[11px] text-zinc-600">
                    User {o.user_id}{o.promo_code ? ` · ${o.promo_code}` : ""} · {fmtDate(o.created_at)}
                  </p>
                </div>
                {o.status === "pending"
                  ? <button onClick={() => done(o.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-400 border border-emerald-400/20 active:opacity-70">
                      <Check className="w-3 h-3" /> {t.doneBtn}
                    </button>
                  : <Badge status={o.status} />
                }
              </div>
            </div>
          ))}
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
  const [saving, setSaving] = useState(false);

  const addField = () => {
    if (!newField.label.trim()) return;
    setFields([...fields, { label: newField.label.trim(), required: newField.required }]);
    setNewField({ label: "", required: false });
  };

  const save = async () => {
    if (!name.trim() || !price) return;
    setSaving(true);
    await adminPatchProduct(product.id, { name: name.trim(), price: Number(price), purchase_fields: fields });
    await adminSetDiscount(product.id, {
      discount_percent: Number(discountPct) || 0,
      discount_enabled: discountEnabled,
      discount_until: discountUntil ? new Date(discountUntil).toISOString() : null,
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
    });
    if (formFields.length > 0 && result?.product_id) {
      await adminPatchProduct(result.product_id, { purchase_fields: formFields });
    }
    setForm({ name: "", price: "", icon_url: "" });
    setFormFields([]); setNewField({ label: "", required: false });
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
  const { t } = useLang();
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
          <button onClick={save} disabled={saving || !newCatName.trim()} className="a-btn px-4 py-2 text-sm">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { t, lang, setLang } = useLang();
  const [section, setSection] = useState<Section>(() => {
    const param = new URLSearchParams(window.location.search).get("section") as Section | null;
    if (param && (["dashboard","payments","orders","catalog","analytics","promos"] as string[]).includes(param)) {
      window.history.replaceState({}, "", window.location.pathname);
      return param;
    }
    return "dashboard";
  });
  const [adminAvatarUrl, setAdminAvatarUrl] = useState("");
  const [adminName, setAdminName] = useState("A");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

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

  const NAV: { id: Section; label: string; Icon: React.ElementType }[] = [
    { id: "dashboard", label: t.adHome,    Icon: LayoutDashboard },
    { id: "payments",  label: t.adPay,     Icon: CreditCard },
    { id: "orders",    label: t.adOrders,  Icon: ShoppingBag },
    { id: "catalog",   label: t.adCatalog, Icon: Gamepad2 },
    { id: "analytics", label: t.adStats,   Icon: BarChart2 },
    { id: "promos",    label: t.adPromos,  Icon: Tag },
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
      <div className="flex-1 overflow-y-auto">
        {section === "dashboard" && <Dashboard onNav={setSection} />}
        {section === "payments"  && <Payments />}
        {section === "orders"    && <Orders />}
        {section === "catalog"   && <Catalog />}
        {section === "analytics" && <Analytics />}
        {section === "promos"    && <Promos />}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-[#1a1c27]" style={{ background: "#0d0e14" }}>
        <div className="flex">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setSection(id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors">
              <Icon className={`w-4 h-4 transition-colors ${section === id ? "text-amber-400" : "text-zinc-700"}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wide ${section === id ? "text-amber-400" : "text-zinc-700"}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
