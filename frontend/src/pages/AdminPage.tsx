import { useEffect, useState, useCallback, useRef } from "react";
import {
  LayoutDashboard, CreditCard, ShoppingBag, Gamepad2,
  BarChart2, Tag, Check, X, ChevronLeft, Plus, Trash2,
  RefreshCw, Eye, ChevronRight, TrendingUp, Users,
  Upload, AlertCircle, ToggleLeft, ToggleRight, Package,
} from "lucide-react";
import {
  adminGetStats, adminUpload,
  adminGetTopups, adminGetOrders, adminConfirmTopup, adminRejectTopup, adminCompleteOrder,
  adminGetGames, adminGetProducts, adminCreateGame, adminPatchGame, adminDeleteGame,
  adminCreateProduct, adminPatchProduct, adminDeleteProduct,
  adminSalesStats, adminProductStats, adminUserStats,
  adminGetPromos, adminCreatePromo, adminDeletePromo, adminTogglePromo,
} from "../api";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Stats { pending_topups: number; pending_orders: number; total_games: number; total_products: number; total_revenue: number }
interface Topup { id: string; user_id: number; amount: number; unique_amount: number; method: string; receipt_url: string; status: string; created_at: string }
interface Order { id: string; user_id: number; amount: number; status: string; promo_code: string; created_at: string }
interface Game { id: string; name: string; description: string; icon_url: string }
interface Variant { label: string; price: number }
interface PurchaseField { label: string; required: boolean }
interface Product { id: string; name: string; description: string; price: number; icon_url: string; sales_count: number; revenue: number; variants: Variant[]; purchase_fields: PurchaseField[] }
interface Promo { id: string; code: string; discount_pct: number; min_order_amount: number; max_uses: number; uses: number; is_active: boolean; created_at: string }

type Section = "dashboard" | "payments" | "orders" | "catalog" | "analytics" | "promos";

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("ru-RU") + " sum";
const fmtShort = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(0) + "K" : String(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const METHOD: Record<string, string> = { card: "Card", payme: "Payme", atm: "ATM" };
const STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending",   cls: "text-amber-400 bg-amber-400/10" },
  confirmed: { label: "Done",      cls: "text-emerald-400 bg-emerald-400/10" },
  rejected:  { label: "Rejected",  cls: "text-red-400 bg-red-400/10" },
  completed: { label: "Completed", cls: "text-emerald-400 bg-emerald-400/10" },
};

// ─── Micro-components ─────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
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
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { adminGetStats().then(setStats); }, []);

  const cards = stats ? [
    { label: "Pending Topups",  value: stats.pending_topups,  icon: CreditCard, color: "text-amber-400", bg: "bg-amber-400/10", to: "payments" as Section },
    { label: "Pending Orders",  value: stats.pending_orders,  icon: ShoppingBag, color: "text-violet-400", bg: "bg-violet-400/10", to: "orders" as Section },
    { label: "Total Games",     value: stats.total_games,     icon: Gamepad2, color: "text-sky-400", bg: "bg-sky-400/10", to: "catalog" as Section },
    { label: "Total Products",  value: stats.total_products,  icon: Package, color: "text-emerald-400", bg: "bg-emerald-400/10", to: "catalog" as Section },
  ] : [];

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Overview</p>
        <h2 className="text-xl font-black text-white mt-0.5">Dashboard</h2>
      </div>

      {!stats ? <div className="flex justify-center py-10"><Spin /></div> : <>
        {/* Revenue hero */}
        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #1a0533, #0d1a3a)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Total Revenue</p>
          <p className="text-3xl font-black text-white mt-1">{fmtShort(stats.total_revenue)} sum</p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-semibold">All time</span>
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
          { label: "View Analytics", icon: BarChart2, to: "analytics" as Section, color: "text-sky-400" },
          { label: "Promo Codes",    icon: Tag,       to: "promos" as Section,    color: "text-violet-400" },
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
        <span className="flex-1 text-sm font-bold text-white">Payment Detail</span>
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
            <X className="w-4 h-4" /> Reject
          </button>
          <button onClick={() => handle("confirm")} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-emerald-400 border border-emerald-400/20 active:opacity-70 disabled:opacity-40">
            <Check className="w-4 h-4" /> Approve
          </button>
        </div>
      )}
    </div>
  );
}

function Payments() {
  const [topups, setTopups] = useState<Topup[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Topup | null>(null);
  const load = useCallback(async () => { setLoading(true); setTopups(await adminGetTopups(filter)); setLoading(false); }, [filter]);
  useEffect(() => { load(); }, [load]);

  if (selected) return <TopupDetail topup={selected} onBack={() => setSelected(null)} onDone={() => { setSelected(null); load(); }} />;

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Finance</p>
        <h2 className="text-xl font-black text-white mt-0.5">Payments</h2>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        {["pending", "confirmed", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filter === s ? "bg-white/10 text-white" : "text-zinc-600"}`}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 text-zinc-600 active:text-white"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="a-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : topups.length === 0 ? <Empty icon={CreditCard} text={`No ${filter} payments`} />
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setOrders(await adminGetOrders(filter)); setLoading(false); }, [filter]);
  useEffect(() => { load(); }, [load]);
  const done = async (id: string) => { await adminCompleteOrder(id); load(); };

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Commerce</p>
        <h2 className="text-xl font-black text-white mt-0.5">Orders</h2>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3">
        {["pending", "completed"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filter === s ? "bg-white/10 text-white" : "text-zinc-600"}`}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 text-zinc-600 active:text-white"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="a-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : orders.length === 0 ? <Empty icon={ShoppingBag} text={`No ${filter} orders`} />
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
                      <Check className="w-3 h-3" /> Done
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
function ProductEditor({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [variants, setVariants] = useState<Variant[]>(product.variants ?? []);
  const [fields, setFields] = useState<PurchaseField[]>(product.purchase_fields ?? []);
  const [newVar, setNewVar] = useState({ label: "", price: "" });
  const [newField, setNewField] = useState({ label: "", required: false });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await adminPatchProduct(product.id, { variants, purchase_fields: fields });
    setSaving(false);
    onSaved();
  };

  const addVariant = () => {
    if (!newVar.label.trim() || !newVar.price) return;
    setVariants([...variants, { label: newVar.label.trim(), price: Number(newVar.price) }]);
    setNewVar({ label: "", price: "" });
  };

  const addField = () => {
    if (!newField.label.trim()) return;
    setFields([...fields, { label: newField.label.trim(), required: newField.required }]);
    setNewField({ label: "", required: false });
  };

  return (
    <div className="px-4 pb-4 flex flex-col gap-4 border-t border-[#1e2030] pt-3">
      {/* Variants */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70 mb-2">Variants (price per option)</p>
        <div className="flex flex-col gap-1.5">
          {variants.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-white/80">{v.label}</span>
              <span className="text-zinc-500">{v.price.toLocaleString()} sum</span>
              <button onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                className="w-6 h-6 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <X className="w-3 h-3 text-red-400" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input value={newVar.label} onChange={(e) => setNewVar({ ...newVar, label: e.target.value })}
            placeholder="Label (e.g. 10 stars)" className="a-input flex-1 text-xs" />
          <input value={newVar.price} onChange={(e) => setNewVar({ ...newVar, price: e.target.value })}
            placeholder="Price" type="number" className="a-input w-24 text-xs" />
          <button onClick={addVariant} disabled={!newVar.label.trim() || !newVar.price}
            className="w-8 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 disabled:opacity-30">
            <Plus className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Purchase fields */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70 mb-2">Purchase fields (ask at checkout)</p>
        <div className="flex flex-col gap-1.5">
          {fields.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-white/80">{f.label}</span>
              <span className="text-[10px] text-zinc-600">{f.required ? "required" : "optional"}</span>
              <button onClick={() => setFields(fields.filter((_, j) => j !== i))}
                className="w-6 h-6 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <X className="w-3 h-3 text-red-400" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2 items-center">
          <input value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })}
            placeholder="Field label (e.g. Player ID)" className="a-input flex-1 text-xs" />
          <label className="flex items-center gap-1 text-[11px] text-zinc-500 flex-shrink-0 cursor-pointer">
            <input type="checkbox" checked={newField.required} onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              className="w-3.5 h-3.5" />
            req
          </label>
          <button onClick={addField} disabled={!newField.label.trim()}
            className="w-8 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 disabled:opacity-30">
            <Plus className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="a-btn text-xs py-2">
        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Save variants & fields</>}
      </button>
    </div>
  );
}

function ProductList({ game, onBack }: { game: Game; onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", desc: "", price: "", icon_url: "" });
  const [formVariants, setFormVariants] = useState<Variant[]>([]);
  const [formFields, setFormFields] = useState<PurchaseField[]>([]);
  const [newVar, setNewVar] = useState({ label: "", price: "" });
  const [newField, setNewField] = useState({ label: "", required: false });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => { setLoading(true); setProducts(await adminGetProducts(game.id)); setLoading(false); };
  useEffect(() => { load(); }, [game.id]);

  const addVar = () => {
    if (!newVar.label.trim() || !newVar.price) return;
    setFormVariants([...formVariants, { label: newVar.label.trim(), price: Number(newVar.price) }]);
    setNewVar({ label: "", price: "" });
  };
  const addField = () => {
    if (!newField.label.trim()) return;
    setFormFields([...formFields, { label: newField.label.trim(), required: newField.required }]);
    setNewField({ label: "", required: false });
  };

  const save = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    const result = await adminCreateProduct({ game_id: game.id, name: form.name.trim(), description: form.desc.trim(), price: Number(form.price), icon_url: form.icon_url });
    if ((formVariants.length > 0 || formFields.length > 0) && result?.product_id) {
      await adminPatchProduct(result.product_id, { variants: formVariants, purchase_fields: formFields });
    }
    setForm({ name: "", desc: "", price: "", icon_url: "" });
    setFormVariants([]); setFormFields([]);
    setNewVar({ label: "", price: "" }); setNewField({ label: "", required: false });
    setShowForm(false); setSaving(false); load();
  };

  const updateIcon = async (id: string, url: string) => {
    await adminPatchProduct(id, { icon_url: url });
    load();
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030]">
        <button onClick={onBack} className="a-card w-8 h-8 flex items-center justify-center active:opacity-70">
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Products</p>
          <p className="text-sm font-black text-white">{game.name}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-500"}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mt-4 a-card p-4 flex flex-col gap-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">New Product</p>

          {/* Base info */}
          <div className="flex gap-3 items-start">
            <UploadBtn current={form.icon_url} onDone={(url) => setForm({ ...form, icon_url: url })} />
            <div className="flex-1 flex flex-col gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name *" className="a-input" />
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Base price (sum) *" type="number" className="a-input" />
            </div>
          </div>
          <input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Description (optional)" className="a-input" />

          {/* Variants */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">
              Variants <span className="text-zinc-700 normal-case font-normal">(если нужны — 10 stars, 25 stars…)</span>
            </p>
            {formVariants.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                <span className="flex-1 text-white/70">{v.label}</span>
                <span className="text-zinc-500">{v.price.toLocaleString()} sum</span>
                <button onClick={() => setFormVariants(formVariants.filter((_, j) => j !== i))} className="w-5 h-5 rounded bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <X className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={newVar.label} onChange={(e) => setNewVar({ ...newVar, label: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addVar()}
                placeholder="Название (10 stars)" className="a-input flex-1 text-xs" />
              <input value={newVar.price} onChange={(e) => setNewVar({ ...newVar, price: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addVar()}
                placeholder="Цена" type="number" className="a-input w-24 text-xs" />
              <button onClick={addVar} disabled={!newVar.label.trim() || !newVar.price}
                className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 disabled:opacity-30">
                <Plus className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>

          {/* Purchase fields */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70">
              Что спросить при покупке <span className="text-zinc-700 normal-case font-normal">(ID игрока, ник…)</span>
            </p>
            {formFields.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                <span className="flex-1 text-white/70">{f.label}</span>
                <span className="text-[10px] text-zinc-600">{f.required ? "обязательно" : "необязательно"}</span>
                <button onClick={() => setFormFields(formFields.filter((_, j) => j !== i))} className="w-5 h-5 rounded bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <X className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 items-center">
              <input value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addField()}
                placeholder="Например: ID в Brawl Stars" className="a-input flex-1 text-xs" />
              <label className="flex items-center gap-1 text-[11px] text-zinc-500 flex-shrink-0 cursor-pointer select-none">
                <input type="checkbox" checked={newField.required}
                  onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                  className="w-3.5 h-3.5 accent-amber-500" />
                обяз.
              </label>
              <button onClick={addField} disabled={!newField.label.trim()}
                className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 disabled:opacity-30">
                <Plus className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>

          <button onClick={save} disabled={saving || !form.name.trim() || !form.price} className="a-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Создать товар</>}
          </button>
        </div>
      )}

      <div className="a-card mx-4 mt-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : products.length === 0 ? <Empty icon={Package} text="No products yet" />
          : products.map((p, i) => (
            <div key={p.id}>
              {i > 0 && <Divider />}
              <div
                className="flex items-center gap-3 px-4 py-3 active:bg-white/[0.02] cursor-pointer"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                <UploadBtn current={p.icon_url} onDone={(url) => { updateIcon(p.id, url); }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-zinc-600">
                    {p.variants?.length ? `${p.variants.length} variants` : fmt(p.price)}
                    {p.purchase_fields?.length ? ` · ${p.purchase_fields.length} fields` : ""}
                  </p>
                  <p className="text-[10px] text-zinc-700 mt-0.5">{p.sales_count} sold · {fmtShort(p.revenue)} sum</p>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-zinc-700 transition-transform ${expandedId === p.id ? "rotate-90" : ""}`} />
                  <button onClick={(e) => { e.stopPropagation(); adminDeleteProduct(p.id).then(load); }}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:opacity-70 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              {expandedId === p.id && (
                <ProductEditor product={p} onSaved={() => { load(); setExpandedId(null); }} />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

function Catalog() {
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

  if (selected) return <ProductList game={selected} onBack={() => { setSelected(null); load(); }} />;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Catalog</p>
          <h2 className="text-xl font-black text-white mt-0.5">Games</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-400"}`}>
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mb-3 a-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">New Game</p>
          <div className="flex gap-3 items-start">
            <UploadBtn current={form.icon_url} onDone={(url) => setForm({ ...form, icon_url: url })} />
            <div className="flex-1 flex flex-col gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Game name *" className="a-input" />
              <input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Description (optional)" className="a-input" />
            </div>
          </div>
          <button onClick={save} disabled={saving || !form.name.trim()} className="a-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Create Game</>}
          </button>
        </div>
      )}

      <div className="a-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : games.length === 0 ? <Empty icon={Gamepad2} text="No games yet" />
          : games.map((g, i) => (
            <div key={g.id}>
              {i > 0 && <Divider />}
              <div className="flex items-center gap-3 px-4 py-3">
                <UploadBtn current={g.icon_url} onDone={(url) => updateIcon(g.id, url)} />
                <button onClick={() => setSelected(g)} className="flex-1 text-left min-w-0 active:opacity-70">
                  <p className="text-[13px] font-bold text-white">{g.name}</p>
                  <p className="text-[11px] text-zinc-600">Tap to manage products</p>
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
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Insights</p>
        <h2 className="text-xl font-black text-white mt-0.5">Analytics</h2>
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 px-4 pb-3 no-scrollbar overflow-x-auto">
        {[["sales", "Sales"], ["products", "Products"], ["users", "Users"]] .map(([v, l]) => (
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
            salesData.length === 0 ? <Empty icon={BarChart2} text="No sales data yet" /> : (
              <div className="a-card p-4 flex flex-col gap-4">
                <p className="text-xs font-bold text-zinc-500">Revenue by day</p>
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
                  <div><p className="text-zinc-600">Orders</p><p className="text-white font-bold">{salesData.reduce((a, b) => a + b.count, 0)}</p></div>
                  <div className="text-right"><p className="text-zinc-600">Revenue</p><p className="text-violet-400 font-bold">{fmtShort(salesData.reduce((a, b) => a + b.revenue, 0))} sum</p></div>
                </div>
              </div>
            )
          )}

          {/* Top products */}
          {view === "products" && (
            productsData.length === 0 ? <Empty icon={Package} text="No sales yet" /> : (
              <div className="a-card overflow-hidden">
                {productsData.map((p, i) => (
                  <div key={p._id}>
                    {i > 0 && <Divider />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-[11px] font-black text-zinc-700 w-5 text-center">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-white truncate">{p.name}</p>
                        <p className="text-[11px] text-zinc-600">{p.count} sales</p>
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
            usersData.length === 0 ? <Empty icon={Users} text="No users yet" /> : (
              <div className="a-card overflow-hidden">
                {usersData.map((u, i) => (
                  <div key={u._id}>
                    {i > 0 && <Divider />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className={`text-[11px] font-black w-5 text-center ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-400" : i === 2 ? "text-orange-700" : "text-zinc-700"}`}>#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-white">{u.first_name}{u.username ? ` @${u.username}` : ""}</p>
                        <p className="text-[11px] text-zinc-600">{u.order_count} orders</p>
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
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Discounts</p>
          <h2 className="text-xl font-black text-white mt-0.5">Promo Codes</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold ${showForm ? "bg-white/10 text-white" : "a-card text-zinc-400"}`}>
          <Plus className="w-3.5 h-3.5" /> Create
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mb-3 a-card p-4 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">New Promo</p>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="PROMO CODE *" className="a-input font-mono tracking-widest uppercase" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-zinc-600 mb-1">Discount % *</p>
              <input value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
                placeholder="e.g. 20" type="number" min="1" max="100" className="a-input" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 mb-1">Min order (0 = any)</p>
              <input value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                placeholder="e.g. 100000" type="number" className="a-input" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 mb-1">Max uses (0 = unlimited)</p>
            <input value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              placeholder="e.g. 100" type="number" className="a-input" />
          </div>
          {err && <div className="flex items-center gap-2 text-red-400 text-[11px]"><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
          <button onClick={save} disabled={saving || !form.code.trim() || !form.discount_pct} className="a-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Tag className="w-4 h-4" /> Create Promo</>}
          </button>
        </div>
      )}

      <div className="a-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? <div className="flex justify-center py-10"><Spin /></div>
          : promos.length === 0 ? <Empty icon={Tag} text="No promo codes yet" />
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

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV: { id: Section; label: string; Icon: React.ElementType }[] = [
  { id: "dashboard", label: "Home",     Icon: LayoutDashboard },
  { id: "payments",  label: "Pay",      Icon: CreditCard },
  { id: "orders",    label: "Orders",   Icon: ShoppingBag },
  { id: "catalog",   label: "Catalog",  Icon: Gamepad2 },
  { id: "analytics", label: "Stats",    Icon: BarChart2 },
  { id: "promos",    label: "Promos",   Icon: Tag },
];

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [section, setSection] = useState<Section>(() => {
    const param = new URLSearchParams(window.location.search).get("section") as Section | null;
    if (param && (["dashboard","payments","orders","catalog","analytics","promos"] as string[]).includes(param)) {
      window.history.replaceState({}, "", window.location.pathname);
      return param;
    }
    return "dashboard";
  });
  return (
    <div className="a-shell flex flex-col min-h-dvh">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1c27]" style={{ background: "#0d0e14" }}>
        <span className="text-[13px] font-black tracking-wider text-white">ADMIN</span>
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
