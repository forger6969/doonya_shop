import asyncio
from fastapi import APIRouter, HTTPException
from backend.database import get_db
from backend.models import (
    get_games, get_game, get_categories, get_products, get_product, get_product_reviews,
    is_discount_active, calc_discounted_price,
    get_active_discounts, get_top_catalog_products,
    get_all_product_stats, get_all_product_ratings,
)
from backend.cache import cache_get, cache_set
from bson import ObjectId

router = APIRouter(prefix="/catalog", tags=["catalog"])

GAMES_TTL = 60
PRODUCTS_TTL = 30
BANNERS_TTL = 60


async def _gather_cats_products(game_id: str):
    return await asyncio.gather(get_categories(game_id), get_products(game_id))


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
        "avg_rating": None,
        "reviews_count": 0,
        "sales_count": p.get("_sales_count", 0),
    }


async def _enrich_social(results: list[dict]) -> list[dict]:
    """Attach real ratings + sales counts to a list of formatted products (batched)."""
    ids = [r["id"] for r in results]
    if not ids:
        return results
    stats, ratings = await asyncio.gather(
        get_all_product_stats(ids),
        get_all_product_ratings(ids),
    )
    for r in results:
        st = stats.get(r["id"])
        rt = ratings.get(r["id"])
        if st:
            r["sales_count"] = st.get("count", r["sales_count"])
        if rt:
            r["avg_rating"] = rt.get("avg")
            r["reviews_count"] = rt.get("count", 0)
    return results


@router.get("/games")
async def list_games():
    cached = cache_get("catalog:games")
    if cached is not None:
        return cached
    games = await get_games()
    result = [
        {
            "id": str(g["_id"]),
            "name": g["name"],
            "description": g.get("description", ""),
            "photo_id": g.get("photo_id", "") or g.get("icon_url", ""),
            "banner_url": g.get("banner_url", ""),
        }
        for g in games
    ]
    cache_set("catalog:games", result, GAMES_TTL)
    return result


@router.get("/games/{game_id}/categories")
async def list_categories(game_id: str):
    game = await get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    cats = await get_categories(game_id)
    return [{"id": str(c["_id"]), "name": c["name"]} for c in cats]


@router.get("/games/{game_id}/products")
async def list_products(game_id: str):
    key = f"catalog:products:{game_id}"
    cached = cache_get(key)
    if cached is not None:
        return cached
    game = await get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    cats, products = await _gather_cats_products(game_id)
    cat_map = {str(c["_id"]): c["name"] for c in cats}
    result = [_fmt_product(p, cat_map.get(p.get("category_id", ""), "")) for p in products]
    await _enrich_social(result)
    cache_set(key, result, PRODUCTS_TTL)
    return result


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
    cached = cache_get("catalog:top")
    if cached is not None:
        return cached
    products = await get_top_catalog_products(6)
    result = [_fmt_product(p) for p in products]
    await _enrich_social(result)
    cache_set("catalog:top", result, PRODUCTS_TTL)
    return result


@router.get("/on-sale")
async def on_sale_products():
    cached = cache_get("catalog:on_sale")
    if cached is not None:
        return cached
    products = await get_active_discounts(20)
    result = [_fmt_product(p) for p in products]
    await _enrich_social(result)
    cache_set("catalog:on_sale", result, PRODUCTS_TTL)
    return result


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
    await _enrich_social(products)

    return {"games": games, "categories": categories, "products": products}


@router.get("/banners")
async def get_active_banners():
    cached = cache_get("catalog:banners")
    if cached is not None:
        return cached
    db = get_db()
    banners = await db.banners.find({"active": True}).sort("created_at", -1).to_list(10)
    result = [
        {
            "id": str(b["_id"]),
            "title": b["title"],
            "subtitle": b.get("subtitle", ""),
            "gradient": b.get("gradient", "pink"),
            "emoji": b.get("emoji", "🎉"),
        }
        for b in banners
    ]
    cache_set("catalog:banners", result, BANNERS_TTL)
    return result
