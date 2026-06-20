from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.config import ADMIN_ID
from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    confirm_topup, reject_topup, complete_order,
    create_game, delete_game, create_product, delete_product,
    get_games, get_products,
)

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(tg_user: dict = Depends(get_current_user)):
    if tg_user["id"] != ADMIN_ID:
        raise HTTPException(status_code=403, detail="Forbidden")
    return tg_user


# ── Stats ────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(_=Depends(require_admin)):
    db = get_db()
    pending_topups, pending_orders, total_games, total_products = await __import__("asyncio").gather(
        db.topups.count_documents({"status": "pending"}),
        db.orders.count_documents({"status": "pending"}),
        db.games.count_documents({}),
        db.products.count_documents({}),
    )
    return {
        "pending_topups": pending_topups,
        "pending_orders": pending_orders,
        "total_games": total_games,
        "total_products": total_products,
    }


# ── Top-ups list ─────────────────────────────────────────────────────────

@router.get("/topups")
async def list_topups(status: str = "pending", _=Depends(require_admin)):
    db = get_db()
    topups = await db.topups.find({"status": status}).sort("created_at", -1).limit(50).to_list(None)
    return [
        {
            "id": str(t["_id"]),
            "user_id": t["user_id"],
            "amount": t["amount"],
            "unique_amount": t["unique_amount"],
            "method": t["method"],
            "receipt_url": t.get("receipt_file_id", ""),
            "status": t["status"],
            "created_at": t["created_at"].isoformat(),
        }
        for t in topups
    ]


@router.get("/orders")
async def list_orders(status: str = "pending", _=Depends(require_admin)):
    db = get_db()
    orders = await db.orders.find({"status": status}).sort("created_at", -1).limit(50).to_list(None)
    return [
        {
            "id": str(o["_id"]),
            "user_id": o["user_id"],
            "product_id": o["product_id"],
            "amount": o["amount"],
            "status": o["status"],
            "created_at": o["created_at"].isoformat(),
        }
        for o in orders
    ]


# ── Top-ups actions ───────────────────────────────────────────────────────

@router.post("/topup/{topup_id}/confirm")
async def confirm(topup_id: str, _=Depends(require_admin)):
    result = await confirm_topup(topup_id)
    if not result:
        raise HTTPException(status_code=404, detail="Topup not found or already processed")
    try:
        from backend.notify import notify_user_topup_confirmed
        await notify_user_topup_confirmed(result["user_id"], result["amount"])
    except Exception:
        pass
    return {"ok": True}


@router.post("/topup/{topup_id}/reject")
async def reject(topup_id: str, _=Depends(require_admin)):
    result = await reject_topup(topup_id)
    if not result:
        raise HTTPException(status_code=404, detail="Topup not found or already processed")
    try:
        from backend.notify import notify_user_topup_rejected
        await notify_user_topup_rejected(result["user_id"])
    except Exception:
        pass
    return {"ok": True}


# ── Orders ────────────────────────────────────────────────────────────────

@router.post("/order/{order_id}/complete")
async def complete(order_id: str, _=Depends(require_admin)):
    order = await complete_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        from backend.notify import notify_user_order_ready
        await notify_user_order_ready(order["user_id"], order_id)
    except Exception:
        pass
    return {"ok": True}


# ── Catalog management ────────────────────────────────────────────────────

class GameCreate(BaseModel):
    name: str
    description: str = ""
    icon_url: str = ""


class ProductCreate(BaseModel):
    game_id: str
    name: str
    description: str = ""
    price: int


@router.post("/games")
async def add_game(data: GameCreate, _=Depends(require_admin)):
    game_id = await create_game(data.name, data.description, data.icon_url)
    return {"ok": True, "game_id": game_id}


@router.delete("/games/{game_id}")
async def del_game(game_id: str, _=Depends(require_admin)):
    await delete_game(game_id)
    return {"ok": True}


@router.post("/products")
async def add_product(data: ProductCreate, _=Depends(require_admin)):
    pid = await create_product(data.game_id, data.name, data.description, data.price)
    return {"ok": True, "product_id": pid}


@router.delete("/products/{product_id}")
async def del_product(product_id: str, _=Depends(require_admin)):
    await delete_product(product_id)
    return {"ok": True}


@router.get("/games")
async def list_all_games(_=Depends(require_admin)):
    games = await get_games()
    return [{"id": str(g["_id"]), "name": g["name"]} for g in games]


@router.get("/games/{game_id}/products")
async def list_all_products(game_id: str, _=Depends(require_admin)):
    products = await get_products(game_id)
    return [{"id": str(p["_id"]), "name": p["name"], "price": p["price"]} for p in products]
