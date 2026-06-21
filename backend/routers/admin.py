import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from backend.config import ADMIN_IDS, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    confirm_topup, reject_topup, complete_order,
    create_game, delete_game, update_game,
    create_product, delete_product, update_product,
    get_games, get_products,
    create_promo, list_promos, delete_promo, toggle_promo,
    get_sales_by_day, get_top_products, get_top_users, get_product_stats,
    set_discount,
)

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(tg_user: dict = Depends(get_current_user)):
    if tg_user["id"] not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Forbidden")
    return tg_user


# ── Stats overview ────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(_=Depends(require_admin)):
    import asyncio
    db = get_db()
    pending_topups, pending_orders, total_games, total_products, total_revenue = await asyncio.gather(
        db.topups.count_documents({"status": "pending"}),
        db.orders.count_documents({"status": "pending"}),
        db.games.count_documents({"is_active": True}),
        db.products.count_documents({"is_active": True}),
        db.orders.aggregate([
            {"$match": {"status": {"$ne": "refunded"}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(None),
    )
    return {
        "pending_topups": pending_topups,
        "pending_orders": pending_orders,
        "total_games": total_games,
        "total_products": total_products,
        "total_revenue": total_revenue[0]["total"] if total_revenue else 0,
    }


# ── Image upload ──────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_image(file: UploadFile = File(...), _=Depends(require_admin)):
    contents = await file.read()
    result = cloudinary.uploader.upload(
        contents,
        folder="doonya_shop/catalog",
        resource_type="image",
    )
    return {"url": result["secure_url"]}


# ── Games ─────────────────────────────────────────────────────────────────────

class GameCreate(BaseModel):
    name: str
    description: str = ""
    icon_url: str = ""


class GameUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon_url: str | None = None


@router.get("/games")
async def list_all_games(_=Depends(require_admin)):
    games = await get_games()
    return [
        {
            "id": str(g["_id"]),
            "name": g["name"],
            "description": g.get("description", ""),
            "icon_url": g.get("icon_url", "") or g.get("photo_id", ""),
        }
        for g in games
    ]


@router.post("/games")
async def add_game(data: GameCreate, _=Depends(require_admin)):
    game_id = await create_game(data.name, data.description, data.icon_url)
    return {"ok": True, "game_id": game_id}


@router.patch("/games/{game_id}")
async def patch_game(game_id: str, data: GameUpdate, _=Depends(require_admin)):
    fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if "icon_url" in fields:
        fields["photo_id"] = fields["icon_url"]
    if fields:
        await update_game(game_id, **fields)
    return {"ok": True}


@router.delete("/games/{game_id}")
async def del_game(game_id: str, _=Depends(require_admin)):
    await delete_game(game_id)
    return {"ok": True}


# ── Products ──────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    game_id: str
    name: str
    description: str = ""
    price: int
    icon_url: str = ""


class VariantModel(BaseModel):
    label: str
    price: int

class PurchaseFieldModel(BaseModel):
    label: str
    required: bool = False

class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: int | None = None
    icon_url: str | None = None
    variants: list[VariantModel] | None = None
    purchase_fields: list[PurchaseFieldModel] | None = None


@router.get("/games/{game_id}/products")
async def list_all_products(game_id: str, _=Depends(require_admin)):
    products = await get_products(game_id)
    result = []
    for p in products:
        stats = await get_product_stats(str(p["_id"]))
        result.append({
            "id": str(p["_id"]),
            "name": p["name"],
            "description": p.get("description", ""),
            "price": p["price"],
            "icon_url": p.get("icon_url", "") or p.get("photo_id", ""),
            "sales_count": stats["count"],
            "revenue": stats["revenue"],
            "variants": p.get("variants", []),
            "purchase_fields": p.get("purchase_fields", []),
            "discount_percent": p.get("discount_percent", 0),
            "discount_enabled": p.get("discount_enabled", False),
            "discount_until": p.get("discount_until").isoformat() if p.get("discount_until") else None,
        })
    return result


@router.post("/products")
async def add_product(data: ProductCreate, _=Depends(require_admin)):
    pid = await create_product(data.game_id, data.name, data.description, data.price, data.icon_url)
    return {"ok": True, "product_id": pid}


@router.patch("/products/{product_id}")
async def patch_product(product_id: str, data: ProductUpdate, _=Depends(require_admin)):
    raw = data.model_dump(exclude_none=True)
    fields = {}
    for k, v in raw.items():
        if k == "icon_url":
            fields["icon_url"] = v
            fields["photo_id"] = v
        elif k == "variants":
            fields["variants"] = [item if isinstance(item, dict) else item for item in v]
        elif k == "purchase_fields":
            fields["purchase_fields"] = [item if isinstance(item, dict) else item for item in v]
        else:
            fields[k] = v
    if fields:
        await update_product(product_id, **fields)
    return {"ok": True}


@router.delete("/products/{product_id}")
async def del_product(product_id: str, _=Depends(require_admin)):
    await delete_product(product_id)
    return {"ok": True}


class DiscountSet(BaseModel):
    discount_percent: int = 0
    discount_enabled: bool = True
    discount_until: str | None = None  # ISO datetime string or null


@router.patch("/products/{product_id}/discount")
async def patch_discount(product_id: str, data: DiscountSet, _=Depends(require_admin)):
    from datetime import datetime as dt
    until = None
    if data.discount_until:
        try:
            until = dt.fromisoformat(data.discount_until.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid discount_until format")
    await set_discount(product_id, data.discount_percent, data.discount_enabled, until)
    return {"ok": True}


# ── Top-ups ───────────────────────────────────────────────────────────────────

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


# ── Orders ────────────────────────────────────────────────────────────────────

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
            "promo_code": o.get("promo_code", ""),
            "created_at": o["created_at"].isoformat(),
        }
        for o in orders
    ]


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


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics/sales")
async def analytics_sales(days: int = 7, _=Depends(require_admin)):
    rows = await get_sales_by_day(days)
    return rows


@router.get("/analytics/products")
async def analytics_products(_=Depends(require_admin)):
    return await get_top_products(15)


@router.get("/analytics/users")
async def analytics_users(_=Depends(require_admin)):
    return await get_top_users(20)


# ── Promos ────────────────────────────────────────────────────────────────────

class PromoCreate(BaseModel):
    code: str
    discount_pct: int
    min_order_amount: int = 0
    max_uses: int = 0


@router.get("/promos")
async def get_promos(_=Depends(require_admin)):
    promos = await list_promos()
    return [
        {
            "id": str(p["_id"]),
            "code": p["code"],
            "discount_pct": p["discount_pct"],
            "min_order_amount": p["min_order_amount"],
            "max_uses": p["max_uses"],
            "uses": p["uses"],
            "is_active": p["is_active"],
            "created_at": p["created_at"].isoformat(),
        }
        for p in promos
    ]


@router.post("/promos")
async def add_promo(data: PromoCreate, _=Depends(require_admin)):
    if not 1 <= data.discount_pct <= 100:
        raise HTTPException(status_code=400, detail="discount_pct must be 1-100")
    try:
        pid = await create_promo(data.code, data.discount_pct, data.min_order_amount, data.max_uses)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"ok": True, "promo_id": pid}


@router.delete("/promos/{promo_id}")
async def del_promo(promo_id: str, _=Depends(require_admin)):
    await delete_promo(promo_id)
    return {"ok": True}


@router.patch("/promos/{promo_id}/toggle")
async def toggle(promo_id: str, _=Depends(require_admin)):
    await toggle_promo(promo_id)
    return {"ok": True}
