import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard, CreditCard, ShoppingBag, Gamepad2,
  Check, X, ChevronLeft, Plus, Trash2, RefreshCw,
  TrendingUp, Package, Clock, Layers,
  ChevronRight, AlertCircle, Eye,
} from "lucide-react";
import {
  adminGetStats, adminGetTopups, adminGetOrders,
  adminConfirmTopup, adminRejectTopup, adminCompleteOrder,
  adminGetGames, adminGetProducts,
  adminCreateGame, adminDeleteGame,
  adminCreateProduct, adminDeleteProduct,
} from "../api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Stats { pending_topups: number; pending_orders: number; total_games: number; total_products: number }
interface Topup { id: string; user_id: number; amount: number; unique_amount: number; method: string; receipt_url: string; status: string; created_at: string }
interface Order { id: string; user_id: number; amount: number; status: string; created_at: string }
interface Game { id: string; name: string }
interface Product { id: string; name: string; price: number }

type Section = "dashboard" | "topups" | "orders" | "catalog";

const METHOD_LABEL: Record<string, string> = { card: "Card", payme: "Payme", atm: "ATM" };
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "text-amber-400",   bg: "bg-amber-400/10" },
  confirmed: { label: "Confirmed", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  rejected:  { label: "Rejected",  color: "text-red-400",     bg: "bg-red-400/10" },
  completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("ru-RU") + " sum"; }
function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + " " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "text-zinc-400", bg: "bg-zinc-400/10" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide ${m.color} ${m.bg}`}>
      {m.label}
    </span>
  );
}

function Spinner() {
  return <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />;
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 border-b border-[#1e2030] last:border-0 ${onClick ? "cursor-pointer active:bg-white/[0.03]" : ""}`}
    >
      {children}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ onNav }: { onNav: (s: Section) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { adminGetStats().then(setStats); }, []);

  const cards = stats ? [
    { label: "Pending Topups",  value: stats.pending_topups,  icon: CreditCard,     color: "text-amber-400",   bg: "bg-amber-400/10",   action: () => onNav("topups") },
    { label: "Pending Orders",  value: stats.pending_orders,  icon: ShoppingBag,    color: "text-violet-400",  bg: "bg-violet-400/10",  action: () => onNav("orders") },
    { label: "Games",           value: stats.total_games,     icon: Gamepad2,       color: "text-sky-400",     bg: "bg-sky-400/10",     action: () => onNav("catalog") },
    { label: "Products",        value: stats.total_products,  icon: Package,        color: "text-emerald-400", bg: "bg-emerald-400/10", action: () => onNav("catalog") },
  ] : [];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Overview</p>
        <h2 className="text-xl font-bold text-white mt-0.5">Dashboard</h2>
      </div>

      {!stats ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cards.map(({ label, value, icon: Icon, color, bg, action }) => (
            <button key={label} onClick={action}
              className="admin-card flex flex-col gap-3 p-4 text-left active:scale-[.98] transition-transform">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">{label}</p>
              </div>
              {value > 0 && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span className="text-[11px] text-amber-400 font-medium">Requires action</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="admin-card p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">All systems operational</p>
          <p className="text-[12px] text-zinc-500">Doonya Shop admin panel</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Topups ───────────────────────────────────────────────────────────────────

function TopupDetail({ topup, onBack, onDone }: { topup: Topup; onBack: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  const handle = async (action: "confirm" | "reject") => {
    setLoading(true);
    if (action === "confirm") await adminConfirmTopup(topup.id);
    else await adminRejectTopup(topup.id);
    setLoading(false);
    onDone();
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030]">
        <button onClick={onBack} className="w-8 h-8 rounded-lg admin-card flex items-center justify-center active:opacity-70">
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <span className="text-sm font-semibold text-white">Topup Detail</span>
        <Badge status={topup.status} />
      </div>

      <div className="flex flex-col gap-1 p-4">
        {[
          ["User ID", String(topup.user_id)],
          ["Amount", fmt(topup.amount)],
          ["Unique Amount", fmt(topup.unique_amount)],
          ["Method", METHOD_LABEL[topup.method] ?? topup.method],
          ["Date", fmtDate(topup.created_at)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between items-center py-2.5 border-b border-[#1a1c27]">
            <span className="text-[13px] text-zinc-500">{k}</span>
            <span className="text-[13px] font-medium text-white">{v}</span>
          </div>
        ))}
      </div>

      {topup.receipt_url && (
        <div className="px-4 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Receipt</p>
          <div className="rounded-xl overflow-hidden border border-[#1e2030]">
            <img src={topup.receipt_url} alt="receipt" className="w-full object-contain max-h-72" />
          </div>
        </div>
      )}

      {topup.status === "pending" && (
        <div className="px-4 pb-6 mt-auto flex gap-3">
          <button onClick={() => handle("reject")} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold active:opacity-70 disabled:opacity-40">
            <X className="w-4 h-4" /> Reject
          </button>
          <button onClick={() => handle("confirm")} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold active:opacity-70 disabled:opacity-40">
            <Check className="w-4 h-4" /> Approve
          </button>
        </div>
      )}
    </div>
  );
}

function Topups() {
  const [topups, setTopups] = useState<Topup[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Topup | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setTopups(await adminGetTopups(filter));
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  if (selected) return <TopupDetail topup={selected} onBack={() => setSelected(null)} onDone={() => { setSelected(null); load(); }} />;

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Finance</p>
        <h2 className="text-xl font-bold text-white mt-0.5">Topups</h2>
      </div>

      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto no-scrollbar">
        {["pending", "confirmed", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${filter === s ? "bg-white/10 text-white" : "text-zinc-500"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button onClick={load} className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-zinc-500 active:text-white">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 admin-card mx-4 mb-4 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : topups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-zinc-600">
            <CreditCard className="w-8 h-8" />
            <p className="text-sm">No {filter} topups</p>
          </div>
        ) : topups.map((t) => (
          <Row key={t.id} onClick={() => setSelected(t)}>
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white">{fmt(t.amount)}</p>
              <p className="text-[11px] text-zinc-500">{METHOD_LABEL[t.method]} · {fmtDate(t.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              {t.receipt_url && <Eye className="w-3.5 h-3.5 text-zinc-600" />}
              <Badge status={t.status} />
              <ChevronRight className="w-4 h-4 text-zinc-700" />
            </div>
          </Row>
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

  const load = useCallback(async () => {
    setLoading(true);
    setOrders(await adminGetOrders(filter));
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const complete = async (id: string) => {
    await adminCompleteOrder(id);
    load();
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Commerce</p>
        <h2 className="text-xl font-bold text-white mt-0.5">Orders</h2>
      </div>

      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto no-scrollbar">
        {["pending", "completed"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${filter === s ? "bg-white/10 text-white" : "text-zinc-500"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button onClick={load} className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-zinc-500 active:text-white">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 admin-card mx-4 mb-4 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-zinc-600">
            <ShoppingBag className="w-8 h-8" />
            <p className="text-sm">No {filter} orders</p>
          </div>
        ) : orders.map((o) => (
          <Row key={o.id}>
            <div className="w-8 h-8 rounded-lg bg-violet-400/10 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white">{fmt(o.amount)}</p>
              <p className="text-[11px] text-zinc-500">User {o.user_id} · {fmtDate(o.created_at)}</p>
            </div>
            {o.status === "pending" ? (
              <button onClick={() => complete(o.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-semibold active:opacity-70">
                <Check className="w-3.5 h-3.5" /> Done
              </button>
            ) : (
              <Badge status={o.status} />
            )}
          </Row>
        ))}
      </div>
    </div>
  );
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

function ProductList({ game, onBack }: { game: Game; onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setProducts(await adminGetProducts(game.id));
    setLoading(false);
  };

  useEffect(() => { load(); }, [game.id]);

  const save = async () => {
    if (!name.trim() || !price) return;
    setSaving(true);
    await adminCreateProduct({ game_id: game.id, name: name.trim(), description: desc.trim(), price: Number(price) });
    setName(""); setDesc(""); setPrice("");
    setShowForm(false);
    setSaving(false);
    load();
  };

  const remove = async (id: string) => {
    await adminDeleteProduct(id);
    load();
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030]">
        <button onClick={onBack} className="w-8 h-8 rounded-lg admin-card flex items-center justify-center active:opacity-70">
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Products</p>
          <p className="text-sm font-bold text-white leading-tight">{game.name}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showForm ? "bg-white/10 text-white" : "admin-card text-zinc-400"}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mt-4 admin-card p-4 flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">New Product</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name"
            className="admin-input" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)"
            className="admin-input" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (sum)" type="number"
            className="admin-input" />
          <button onClick={save} disabled={saving || !name.trim() || !price}
            className="admin-btn-primary">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add Product</>}
          </button>
        </div>
      )}

      <div className="admin-card mx-4 mt-4 mb-4 overflow-hidden flex-1">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-zinc-600">
            <Package className="w-7 h-7" />
            <p className="text-sm">No products yet</p>
          </div>
        ) : products.map((p) => (
          <Row key={p.id}>
            <div className="w-8 h-8 rounded-lg bg-sky-400/10 flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{p.name}</p>
              <p className="text-[11px] text-zinc-500">{fmt(p.price)}</p>
            </div>
            <button onClick={() => remove(p.id)}
              className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:opacity-70">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </Row>
        ))}
      </div>
    </div>
  );
}

function Catalog() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const load = async () => {
    setLoading(true);
    setGames(await adminGetGames());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await adminCreateGame(name.trim(), desc.trim(), iconUrl.trim());
    setName(""); setDesc(""); setIconUrl("");
    setShowForm(false);
    setSaving(false);
    load();
  };

  const remove = async (id: string) => {
    await adminDeleteGame(id);
    load();
  };

  if (selectedGame) return <ProductList game={selectedGame} onBack={() => { setSelectedGame(null); load(); }} />;

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Catalog</p>
          <h2 className="text-xl font-bold text-white mt-0.5">Games</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${showForm ? "bg-white/10 text-white" : "admin-card text-zinc-400"}`}>
          <Plus className="w-3.5 h-3.5" /> Add Game
        </button>
      </div>

      {showForm && (
        <div className="mx-4 mb-3 admin-card p-4 flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">New Game</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Game name *"
            className="admin-input" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)"
            className="admin-input" />
          <input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="Icon image URL (optional)"
            className="admin-input" />
          {iconUrl && (
            <div className="flex items-center gap-2">
              <img src={iconUrl} className="w-10 h-10 rounded-xl object-cover" alt="preview"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="text-[11px] text-zinc-500">Icon preview</span>
            </div>
          )}
          <button onClick={save} disabled={saving || !name.trim()} className="admin-btn-primary">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Create Game</>}
          </button>
        </div>
      )}

      <div className="admin-card mx-4 mb-4 overflow-hidden flex-1">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-zinc-600">
            <Gamepad2 className="w-8 h-8" />
            <p className="text-sm">No games yet</p>
          </div>
        ) : games.map((g) => (
          <Row key={g.id} onClick={() => setSelectedGame(g)}>
            <div className="w-9 h-9 rounded-xl bg-sky-400/10 flex items-center justify-center flex-shrink-0">
              <Gamepad2 className="w-5 h-5 text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white">{g.name}</p>
              <p className="text-[11px] text-zinc-500">Tap to manage products</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); remove(g.id); }}
                className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:opacity-70">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
              <ChevronRight className="w-4 h-4 text-zinc-700" />
            </div>
          </Row>
        ))}
      </div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard" as Section, label: "Dashboard", Icon: LayoutDashboard },
  { id: "topups"    as Section, label: "Topups",    Icon: CreditCard },
  { id: "orders"    as Section, label: "Orders",    Icon: ShoppingBag },
  { id: "catalog"   as Section, label: "Catalog",   Icon: Gamepad2 },
];

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [section, setSection] = useState<Section>("dashboard");

  return (
    <div className="admin-shell flex flex-col min-h-dvh">
      {/* Top header */}
      <div className="admin-header flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-400/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[13px] font-bold tracking-wide text-white">ADMIN PANEL</span>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
          Superuser
        </span>
      </div>

      {/* Nav bar */}
      <div className="flex border-b border-[#1e2030] px-2">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setSection(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors relative ${
              section === id ? "text-amber-400" : "text-zinc-600"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
            {section === id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {section === "dashboard" && <Dashboard onNav={setSection} />}
        {section === "topups"    && <Topups />}
        {section === "orders"    && <Orders />}
        {section === "catalog"   && <Catalog />}
      </div>
    </div>
  );
}
