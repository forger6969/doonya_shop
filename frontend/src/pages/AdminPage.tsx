import { useEffect, useState } from "react";
import {
  adminGetTopups, adminGetOrders,
  adminConfirmTopup, adminRejectTopup, adminCompleteOrder,
} from "../api";

interface Topup {
  id: string; user_id: number; amount: number; unique_amount: number;
  method: string; receipt_url: string; status: string; created_at: string;
}
interface Order {
  id: string; user_id: number; amount: number; status: string; created_at: string;
}

type AdminTab = "topups" | "orders";

const METHOD_ICON: Record<string, string> = { card: "💳", payme: "📱", atm: "🏧" };
const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-400", confirmed: "text-green-400",
  rejected: "text-red-400", completed: "text-green-400",
};

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("topups");
  const [topups, setTopups] = useState<Topup[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Topup | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("pending");

  const loadTopups = async () => {
    setLoading(true);
    setTopups(await adminGetTopups(filter));
    setLoading(false);
  };

  const loadOrders = async () => {
    setLoading(true);
    setOrders(await adminGetOrders(filter));
    setLoading(false);
  };

  useEffect(() => {
    tab === "topups" ? loadTopups() : loadOrders();
  }, [tab, filter]);

  const handleConfirm = async (id: string) => {
    await adminConfirmTopup(id);
    setSelected(null);
    loadTopups();
  };

  const handleReject = async (id: string) => {
    await adminRejectTopup(id);
    setSelected(null);
    loadTopups();
  };

  const handleOrderDone = async (id: string) => {
    await adminCompleteOrder(id);
    loadOrders();
  };

  // Receipt detail view
  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <button className="text-sm text-white/60 w-fit active:opacity-70" onClick={() => setSelected(null)}>
          ← Назад
        </button>
        <div className="card flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Пользователь</span>
            <span className="font-mono">{selected.user_id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Сумма</span>
            <span className="font-bold text-purple-400">{selected.amount.toLocaleString()} сум</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Уникальная сумма</span>
            <span className="font-mono text-yellow-400">{selected.unique_amount.toLocaleString()} сум</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Метод</span>
            <span>{METHOD_ICON[selected.method]} {selected.method}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Дата</span>
            <span>{new Date(selected.created_at).toLocaleString("ru-RU")}</span>
          </div>
        </div>

        {selected.receipt_url && (
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <img src={selected.receipt_url} alt="Чек" className="w-full object-contain max-h-80" />
          </div>
        )}

        {selected.status === "pending" && (
          <div className="flex gap-3">
            <button className="flex-1 py-3 rounded-xl bg-green-600 font-semibold text-white active:opacity-70"
              onClick={() => handleConfirm(selected.id)}>
              ✅ Подтвердить
            </button>
            <button className="flex-1 py-3 rounded-xl bg-red-600 font-semibold text-white active:opacity-70"
              onClick={() => handleReject(selected.id)}>
              ❌ Отклонить
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">⚙️ Админ-панель</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["topups", "orders"] as AdminTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? "bg-purple-600 text-white" : "bg-white/5 text-white/60"}`}>
            {t === "topups" ? "💰 Пополнения" : "🛒 Заказы"}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["pending", "confirmed", "rejected", "completed"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? "bg-white/20 text-white" : "bg-white/5 text-white/40"}`}>
            {s === "pending" ? "⏳" : s === "confirmed" || s === "completed" ? "✅" : "❌"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === "topups" ? (
        topups.length === 0 ? (
          <p className="text-white/40 text-center py-8">Нет записей</p>
        ) : (
          topups.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)}
              className="card text-left flex items-center justify-between gap-3 active:opacity-70">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-white/50 truncate">{t.user_id}</p>
                <p className="font-bold">{t.amount.toLocaleString()} сум</p>
                <p className="text-xs text-white/40">{METHOD_ICON[t.method]} {new Date(t.created_at).toLocaleString("ru-RU")}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs font-medium ${STATUS_COLOR[t.status]}`}>{t.status}</span>
                {t.receipt_url && <span className="text-xs text-white/30">📎 чек</span>}
                <span className="text-white/30 text-lg">›</span>
              </div>
            </button>
          ))
        )
      ) : (
        orders.length === 0 ? (
          <p className="text-white/40 text-center py-8">Нет записей</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-mono text-white/50">{o.user_id}</p>
                <p className="font-bold">{o.amount.toLocaleString()} сум</p>
                <p className="text-xs text-white/40">{new Date(o.created_at).toLocaleString("ru-RU")}</p>
              </div>
              {o.status === "pending" && (
                <button onClick={() => handleOrderDone(o.id)}
                  className="px-3 py-2 rounded-xl bg-green-600 text-sm font-semibold text-white active:opacity-70">
                  ✅ Выполнен
                </button>
              )}
            </div>
          ))
        )
      )}
    </div>
  );
}
