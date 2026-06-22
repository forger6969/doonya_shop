from fastapi import APIRouter, HTTPException
from backend.database import get_db
from backend.models import (
    get_games, get_game, get_categories, get_products, get_product, get_product_reviews,
    is_discount_active, calc_discounted_price,
    get_active_discounts, get_top_catalog_products,
)
from bson import ObjectId

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _fmt_product(p: dict, category_name: str = "") -> dict:
    discounted = calc_discounted_price(p["price"], p)
    return {
        "id": str(p["_id"]),
        "game_id": p["game_id"],
        "category_id": p.get("category_id", ""),
        "category_name": category_name,
        "name": p["name"],
        "description": p.get("description", ""),
        "price": p["price"],
        "discounted_price": discounted,
        "discount_percent": p.get("discount_percent", 0) if is_discount_active(p) else 0,
        "photo_id": p.get("photo_id", ""),
        "variants": p.get("variants", []),
        "purchase_fields": p.get("purchase_fields", []),
    }


@router.get("/games")
async def list_games():
    games = await get_games()
    return [
        {
            "id": str(g["_id"]),
            "name": g["name"],
            "description": g.get("description", ""),
            "photo_id": g.get("photo_id", "") or g.get("icon_url", ""),
        }
        for g in games
    ]


@router.get("/games/{game_id}/categories")
async def list_categories(game_id: str):
    game = await get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    cats = await get_categories(game_id)
    return [{"id": str(c["_id"]), "name": c["name"]} for c in cats]


@router.get("/games/{game_id}/products")
async def list_products(game_id: str):
    game = await get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    cats = await get_categories(game_id)
    cat_map = {str(c["_id"]): c["name"] for c in cats}

    products = await get_products(game_id)
    return [_fmt_product(p, cat_map.get(p.get("category_id", ""), "")) for p in products]


@router.get("/products/{product_id}")
async def product_detail(product_id: str):
    p = await get_product(product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    reviews = await get_product_reviews(product_id)
    avg_rating = (
        round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else None
    )
    result = _fmt_product(p)
    result["avg_rating"] = avg_rating
    result["reviews_count"] = len(reviews)
    return result


@router.get("/products/{product_id}/reviews")
async def product_reviews(product_id: str):
    reviews = await get_product_reviews(product_id)
    return [
        {
            "rating": r["rating"],
            "text": r.get("text", ""),
            "photo_url": r.get("photo_url", ""),
            "created_at": r["created_at"].isoformat(),
        }
        for r in reviews
    ]


@router.get("/top")
async def top_products():
    products = await get_top_catalog_products(6)
    return [_fmt_product(p) for p in products]


@router.get("/on-sale")
async def on_sale_products():
    products = await get_active_discounts(20)
    return [_fmt_product(p) for p in products]


@router.get("/search")
async def search(q: str = ""):
    if not q or len(q.strip()) < 1:
        return {"games": [], "categories": [], "products": []}
    db = get_db()
    q = q.strip()
    regex = {"$regex": q, "$options": "i"}

    raw_games = await db.games.find({"is_active": True, "name": regex}).limit(10).to_list(None)
    raw_cats = await db.categories.find({"is_active": True, "name": regex}).limit(10).to_list(None)
    raw_products = await db.products.find({"is_active": True, "name": regex}).limit(20).to_list(None)

    games = [{"id": str(g["_id"]), "name": g["name"], "photo_id": g.get("photo_id", "") or g.get("icon_url", "")} for g in raw_games]
    categories = [{"id": str(c["_id"]), "game_id": c["game_id"], "name": c["name"]} for c in raw_cats]
    products = [_fmt_product(p) for p in raw_products]

    return {"games": games, "categories": categories, "products": products}
