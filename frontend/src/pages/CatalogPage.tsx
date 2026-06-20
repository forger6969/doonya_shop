import { useEffect, useState } from "react";
import { getGames, getProducts } from "../api";

interface Game { id: string; name: string; description: string; photo_id: string }
interface Product { id: string; name: string; description: string; price: number; photo_id: string }

interface Props { onBuy: (product: Product) => void }

export default function CatalogPage({ onBuy }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [selected, setSelected] = useState<Game | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGames().then((g) => { setGames(g); setLoading(false); });
  }, []);

  const openGame = async (game: Game) => {
    setSelected(game);
    setLoading(true);
    const p = await getProducts(game.id);
    setProducts(p);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-3">
        <button
          className="flex items-center gap-2 text-sm text-white/60 active:opacity-70"
          onClick={() => { setSelected(null); setProducts([]); }}
        >
          ← Назад
        </button>
        <h2 className="text-lg font-bold">{selected.name}</h2>
        {products.length === 0 ? (
          <p className="text-white/50 text-center py-8">Товары скоро появятся</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{p.name}</p>
                {p.description && <p className="text-sm text-white/50 mt-0.5">{p.description}</p>}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="font-bold text-purple-400">{p.price.toLocaleString()} сум</span>
                <button className="btn-primary !w-auto px-4 py-1.5 text-sm" onClick={() => onBuy(p)}>
                  Купить
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">🎮 Каталог игр</h2>
      {games.length === 0 ? (
        <p className="text-white/50 text-center py-8">Игры скоро появятся</p>
      ) : (
        games.map((g) => (
          <button
            key={g.id}
            className="card text-left flex items-center justify-between active:opacity-70"
            onClick={() => openGame(g)}
          >
            <div>
              <p className="font-semibold">{g.name}</p>
              {g.description && <p className="text-sm text-white/50 mt-0.5">{g.description}</p>}
            </div>
            <span className="text-white/40 text-xl">›</span>
          </button>
        ))
      )}
    </div>
  );
}
