import { useEffect, useState } from "react";
import { getMe, getOrders } from "../api";

interface User { user_id: number; first_name: string; username: string; balance: number }
interface Order { id: string; amount: number; status: string; created_at: string }

interface Props { onTopup: () => void }

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ Ожидание",
  completed: "✅ Выполнен",
};

export default function ProfilePage({ onTopup }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"profile" | "orders">("profile");

  useEffect(() => {
    getMe().then(setUser);
    getOrders().then(setOrders);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold shrink-0">
          {user.first_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg truncate">{user.first_name}</p>
          {user.username && <p className="text-white/50 text-sm">@{user.username}</p>}
        </div>
      </div>

      <div className="card flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm">Баланс</p>
          <p className="text-2xl font-bold text-purple-400">{user.balance.toLocaleString()} сум</p>
        </div>
        <button className="btn-primary !w-auto px-5" onClick={onTopup}>
          + Пополнить
        </button>
      </div>

      <div className="flex gap-2">
        {(["profile", "orders"] as const).map((t) => (
          <button
            key={t}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t ? "bg-purple-600 text-white" : "bg-white/5 text-white/60"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "profile" ? "Профиль" : "История"}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <div className="flex flex-col gap-2">
          {orders.length === 0 ? (
            <p className="text-white/50 text-center py-6">Покупок пока нет</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="card flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{STATUS_LABEL[o.status] ?? o.status}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {new Date(o.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <p className="font-semibold text-purple-400">{o.amount.toLocaleString()} сум</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
