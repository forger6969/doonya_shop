from fastapi import APIRouter
from backend.models import get_games, get_game, get_products, get_product, get_product_reviews

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/games")
async def list_games():
    games = await get_games()
    return [
        {
            "id": str(g["_id"]),
            "name": g["name"],
            "description": g.get("description", ""),
            "photo_id": g.get("photo_id", ""),
        }
        for g in games
    ]


@router.get("/games/{game_id}/products")
async def list_products(game_id: str):
    game = await get_game(game_id)
    if not game:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Game not found")
    products = await get_products(game_id)
    return [
        {
            "id": str(p["_id"]),
            "game_id": p["game_id"],
            "name": p["name"],
            "description": p.get("description", ""),
            "price": p["price"],
            "photo_id": p.get("photo_id", ""),
        }
        for p in products
    ]


@router.get("/products/{product_id}")
async def product_detail(product_id: str):
    from fastapi import HTTPException
    p = await get_product(product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    reviews = await get_product_reviews(product_id)
    avg_rating = (
        round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else None
    )
    return {
        "id": str(p["_id"]),
        "game_id": p["game_id"],
        "name": p["name"],
        "description": p.get("description", ""),
        "price": p["price"],
        "photo_id": p.get("photo_id", ""),
        "avg_rating": avg_rating,
        "reviews_count": len(reviews),
    }


@router.get("/products/{product_id}/reviews")
async def product_reviews(product_id: str):
    reviews = await get_product_reviews(product_id)
    return [
        {
            "rating": r["rating"],
            "text": r.get("text", ""),
            "created_at": r["created_at"].isoformat(),
        }
        for r in reviews
    ]
