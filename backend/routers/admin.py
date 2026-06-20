from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from backend.config import ADMIN_ID
from backend.models import (
    confirm_topup, reject_topup, complete_order,
    create_game, delete_game, create_product, delete_product,
    get_games, get_products,
)

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(x_admin_id: str = Header(..., alias="X-Admin-Id")):
    if int(x_admin_id) != ADMIN_ID:
        raise HTTPException(status_code=403, detail="Forbidden")
    return int(x_admin_id)


# ── Top-ups ───────────────────────────────────────────────────────────────

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


class ProductCreate(BaseModel):
    game_id: str
    name: str
    description: str = ""
    price: int


@router.post("/games")
async def add_game(data: GameCreate, _=Depends(require_admin)):
    game_id = await create_game(data.name, data.description)
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
