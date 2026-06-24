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
    get_categories, get_category, create_category, update_category, delete_category,
    create_promo, list_promos, delete_promo, toggle_promo,
    get_sales_by_day, get_top_products, get_top_users, get_all_product_stats,
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
    banner_url: str | None = None


@router.get("/games")
async def list_all_games(_=Depends(require_admin)):
    games = await get_games()
    return [
        {
            "id": str(g["_id"]),
            "name": g["name"],
            "description": g.get("description", ""),
            "icon_url": g.get("icon_url", "") or g.get("photo_id", ""),
            "banner_url": g.get("banner_url", ""),
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
    # banner_url stored as-is, no alias needed
    if fields:
        await update_game(game_id, **fields)
    return {"ok": True}


@router.delete("/games/{game_id}")
async def del_game(game_id: str, _=Depends(require_admin)):
    await delete_game(game_id)
    return {"ok": True}


# ── Categories ────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    game_id: str
    name: str


class CategoryUpdate(BaseModel):
    name: str | None = None


@router.get("/games/{game_id}/categories")
async def list_categories(game_id: str, _=Depends(require_admin)):
    cats = await get_categories(game_id)
    return [{"id": str(c["_id"]), "game_id": c["game_id"], "name": c["name"]} for c in cats]


@router.post("/categories")
async def add_category(data: CategoryCreate, _=Depends(require_admin)):
    cat_id = await create_category(data.game_id, data.name)
    return {"ok": True, "category_id": cat_id}


@router.patch("/categories/{cat_id}")
async def patch_category(cat_id: str, data: CategoryUpdate, _=Depends(require_admin)):
    fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if fields:
        await update_category(cat_id, **fields)
    return {"ok": True}


@router.delete("/categories/{cat_id}")
async def del_category(cat_id: str, _=Depends(require_admin)):
    await delete_category(cat_id)
    return {"ok": True}


# ── Products ──────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    game_id: str
    category_id: str = ""
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
async def list_all_products(game_id: str, category_id: str = "", _=Depends(require_admin)):
    products = await get_products(game_id, category_id)
    cats = await get_categories(game_id)
    cat_map = {str(c["_id"]): c["name"] for c in cats}
    product_ids = [str(p["_id"]) for p in products]
    stats_map = await get_all_product_stats(product_ids)
    return [
        {
            "id": str(p["_id"]),
            "category_id": p.get("category_id", ""),
            "category_name": cat_map.get(p.get("category_id", ""), ""),
            "name": p["name"],
            "description": p.get("description", ""),
            "price": p["price"],
            "icon_url": p.get("icon_url", "") or p.get("photo_id", ""),
            "sales_count": stats_map[str(p["_id"])]["count"],
            "revenue": stats_map[str(p["_id"])]["revenue"],
            "variants": p.get("variants", []),
            "purchase_fields": p.get("purchase_fields", []),
            "discount_percent": p.get("discount_percent", 0),
            "discount_enabled": p.get("discount_enabled", False),
            "discount_until": p.get("discount_until").isoformat() if p.get("discount_until") else None,
        }
        for p in products
    ]


@router.post("/products")
async def add_product(data: ProductCreate, _=Depends(require_admin)):
    pid = await create_product(data.game_id, data.name, data.description, data.price, data.icon_url, data.category_id)
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
    discount_until: str | None = None
    broadcast: bool = False  # if True — send discount announcement to all users


@router.patch("/products/{product_id}/discount")
async def patch_discount(product_id: str, data: DiscountSet, _=Depends(require_admin)):
    import asyncio
    from datetime import datetime as dt
    until = None
    if data.discount_until:
        try:
            until = dt.fromisoformat(data.discount_until.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid discount_until format")
    await set_discount(product_id, data.discount_percent, data.discount_enabled, until)

    # Broadcast to all users if requested and discount is being enabled
    if data.broadcast and data.discount_enabled and data.discount_percent > 0:
        try:
            from backend.notify import broadcast_discount
            from bson import ObjectId as ObjId
            _db = get_db()
            product = await _db.products.find_one({"_id": ObjId(product_id)})
            if product:
                game = await _db.games.find_one({"_id": ObjId(product["game_id"])}) if product.get("game_id") else None
                game_name = game["name"] if game else ""
                asyncio.create_task(broadcast_discount(
                    product_name=product["name"],
                    discount_percent=data.discount_percent,
                    photo_url=product.get("icon_url") or product.get("photo_id") or "",
                    game_name=game_name,
                ))
        except Exception:
            pass

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
    try:
        from backend.routers.notifications import notify_manager
        await notify_manager.send(result["user_id"], "topup_confirmed", {"amount": result["amount"]})
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
    try:
        from backend.routers.notifications import notify_manager
        await notify_manager.send(result["user_id"], "topup_rejected", {})
    except Exception:
        pass
    return {"ok": True}


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/orders")
async def list_orders(status: str = "pending", _=Depends(require_admin)):
    db = get_db()
    orders = await db.orders.find({"status": status}).sort("created_at", -1).limit(50).to_list(None)
    # Batch-lookup users to get username/first_name
    user_ids = list({o["user_id"] for o in orders})
    users_raw = await db.users.find({"user_id": {"$in": user_ids}}, {"user_id": 1, "username": 1, "first_name": 1}).to_list(None)
    users_map = {u["user_id"]: u for u in users_raw}
    return [
        {
            "id": str(o["_id"]),
            "user_id": o["user_id"],
            "username": users_map.get(o["user_id"], {}).get("username", ""),
            "first_name": users_map.get(o["user_id"], {}).get("first_name", ""),
            "product_id": o["product_id"],
            "amount": o["amount"],
            "status": o["status"],
            "promo_code": o.get("promo_code", ""),
            "variant_label": o.get("variant_label", ""),
            "field_answers": o.get("field_answers", {}),
            "created_at": o["created_at"].isoformat(),
        }
        for o in orders
    ]


@router.post("/order/{order_id}/complete")
async def complete(order_id: str, _=Depends(require_admin)):
    import logging
    order = await complete_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    product_name = ""
    try:
        from bson import ObjectId as ObjId
        _db = get_db()
        product = await _db.products.find_one({"_id": ObjId(order["product_id"])})
        product_name = product["name"] if product else ""
    except Exception as e:
        logging.warning(f"complete order: product lookup failed: {e}")
    try:
        from backend.notify import notify_user_order_ready
        await notify_user_order_ready(order["user_id"], order_id, product_name)
    except Exception as e:
        logging.error(f"complete order: notify failed: {e}")
    try:
        from backend.routers.notifications import notify_manager
        await notify_manager.send(
            order["user_id"], "order_ready",
            {"order_id": order_id, "product_name": product_name},
        )
    except Exception as e:
        logging.warning(f"complete order: ws notify failed: {e}")
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


# ── Banners ────────────────────────────────────────────────────────────────────

class BannerCreate(BaseModel):
    title: str
    subtitle: str = ""
    gradient: str = "pink"
    emoji: str = "🎉"


def _fmt_banner(b: dict) -> dict:
    return {
        "id": str(b["_id"]),
        "title": b["title"],
        "subtitle": b.get("subtitle", ""),
        "gradient": b.get("gradient", "pink"),
        "emoji": b.get("emoji", "🎉"),
        "active": b.get("active", True),
        "created_at": b["created_at"].isoformat(),
    }


@router.get("/banners")
async def get_banners(_=Depends(require_admin)):
    from datetime import datetime, timezone
    db = get_db()
    banners = await db.banners.find().sort("created_at", -1).to_list(50)
    return [_fmt_banner(b) for b in banners]


@router.post("/banners")
async def create_banner(data: BannerCreate, _=Depends(require_admin)):
    from datetime import datetime, timezone
    db = get_db()
    result = await db.banners.insert_one({
        "title": data.title.strip(),
        "subtitle": data.subtitle.strip(),
        "gradient": data.gradient,
        "emoji": data.emoji,
        "active": True,
        "created_at": datetime.now(timezone.utc),
    })
    return {"ok": True, "id": str(result.inserted_id)}


@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str, _=Depends(require_admin)):
    from bson import ObjectId
    db = get_db()
    await db.banners.delete_one({"_id": ObjectId(banner_id)})
    return {"ok": True}


@router.patch("/banners/{banner_id}/toggle")
async def toggle_banner(banner_id: str, _=Depends(require_admin)):
    from bson import ObjectId
    db = get_db()
    b = await db.banners.find_one({"_id": ObjectId(banner_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")
    await db.banners.update_one({"_id": ObjectId(banner_id)}, {"$set": {"active": not b.get("active", True)}})
    return {"ok": True}
