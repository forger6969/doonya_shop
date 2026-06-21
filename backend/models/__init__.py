from datetime import datetime, timedelta
from bson import ObjectId
from backend.database import get_db


def db():
    return get_db()


# ── Users ───────────────────────────────────────────────────────────────────
async def get_or_create_user(user_id: int, username: str, first_name: str) -> dict:
    user = await db().users.find_one({"user_id": user_id})
    if not user:
        user = {
            "user_id": user_id,
            "username": username,
            "first_name": first_name,
            "balance": 0,
            "created_at": datetime.utcnow(),
        }
        await db().users.insert_one(user)
    return user


async def get_user(user_id: int) -> dict | None:
    return await db().users.find_one({"user_id": user_id})


async def update_balance(user_id: int, amount: int):
    await db().users.update_one({"user_id": user_id}, {"$inc": {"balance": amount}})


# ── Games ────────────────────────────────────────────────────────────────────
async def get_games() -> list:
    return await db().games.find({"is_active": True}).sort("order", 1).to_list(None)


async def get_game(game_id: str) -> dict | None:
    return await db().games.find_one({"_id": ObjectId(game_id), "is_active": True})


async def create_game(name: str, description: str = "", photo_id: str = "") -> str:
    count = await db().games.count_documents({})
    result = await db().games.insert_one({
        "name": name,
        "description": description,
        "photo_id": photo_id,
        "icon_url": photo_id,
        "is_active": True,
        "order": count,
        "created_at": datetime.utcnow(),
    })
    return str(result.inserted_id)


async def update_game(game_id: str, **fields):
    await db().games.update_one({"_id": ObjectId(game_id)}, {"$set": fields})


async def delete_game(game_id: str):
    await db().games.update_one({"_id": ObjectId(game_id)}, {"$set": {"is_active": False}})


# ── Products ─────────────────────────────────────────────────────────────────
async def get_products(game_id: str) -> list:
    return await db().products.find({"game_id": game_id, "is_active": True}).sort("order", 1).to_list(None)


async def get_product(product_id: str) -> dict | None:
    return await db().products.find_one({"_id": ObjectId(product_id), "is_active": True})


async def create_product(game_id: str, name: str, description: str, price: int, photo_id: str = "") -> str:
    count = await db().products.count_documents({"game_id": game_id})
    result = await db().products.insert_one({
        "game_id": game_id,
        "name": name,
        "description": description,
        "price": price,
        "photo_id": photo_id,
        "icon_url": photo_id,
        "is_active": True,
        "order": count,
        "created_at": datetime.utcnow(),
    })
    return str(result.inserted_id)


async def update_product(product_id: str, **fields):
    await db().products.update_one({"_id": ObjectId(product_id)}, {"$set": fields})


async def delete_product(product_id: str):
    await db().products.update_one({"_id": ObjectId(product_id)}, {"$set": {"is_active": False}})


# ── Top-ups ──────────────────────────────────────────────────────────────────
async def create_topup(user_id: int, amount: int, unique_amount: int, method: str, receipt_file_id: str) -> str:
    result = await db().topups.insert_one({
        "user_id": user_id,
        "amount": amount,
        "unique_amount": unique_amount,
        "method": method,
        "receipt_file_id": receipt_file_id,
        "status": "pending",
        "created_at": datetime.utcnow(),
    })
    return str(result.inserted_id)


async def confirm_topup(topup_id: str) -> dict | None:
    topup = await db().topups.find_one({"_id": ObjectId(topup_id)})
    if topup and topup["status"] == "pending":
        await db().topups.update_one(
            {"_id": ObjectId(topup_id)},
            {"$set": {"status": "confirmed", "confirmed_at": datetime.utcnow()}}
        )
        await update_balance(topup["user_id"], topup["amount"])
        return topup
    return None


async def reject_topup(topup_id: str) -> dict | None:
    topup = await db().topups.find_one({"_id": ObjectId(topup_id)})
    if topup and topup["status"] == "pending":
        await db().topups.update_one(
            {"_id": ObjectId(topup_id)},
            {"$set": {"status": "rejected", "rejected_at": datetime.utcnow()}}
        )
    return topup


# ── Orders ───────────────────────────────────────────────────────────────────
async def create_order(
    user_id: int, product_id: str, game_id: str,
    amount: int, original_price: int = 0, promo_code: str = "",
) -> str:
    result = await db().orders.insert_one({
        "user_id": user_id,
        "product_id": product_id,
        "game_id": game_id,
        "amount": amount,
        "original_price": original_price or amount,
        "promo_code": promo_code,
        "status": "pending",
        "created_at": datetime.utcnow(),
    })
    await update_balance(user_id, -amount)
    return str(result.inserted_id)


async def complete_order(order_id: str) -> dict | None:
    await db().orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )
    return await db().orders.find_one({"_id": ObjectId(order_id)})


async def get_user_orders(user_id: int) -> list:
    return await db().orders.find({"user_id": user_id}).sort("created_at", -1).limit(10).to_list(None)


# ── Reviews ──────────────────────────────────────────────────────────────────
async def create_review(user_id: int, order_id: str, product_id: str, rating: int, text: str, photo_url: str = "") -> str:
    result = await db().reviews.insert_one({
        "user_id": user_id,
        "order_id": order_id,
        "product_id": product_id,
        "rating": rating,
        "text": text,
        "photo_url": photo_url,
        "created_at": datetime.utcnow(),
    })
    return str(result.inserted_id)


async def get_product_reviews(product_id: str) -> list:
    return await db().reviews.find({"product_id": product_id}).sort("created_at", -1).limit(5).to_list(None)


# ── Promos ───────────────────────────────────────────────────────────────────
async def create_promo(code: str, discount_pct: int, min_order_amount: int, max_uses: int) -> str:
    existing = await db().promos.find_one({"code": code.upper()})
    if existing:
        raise ValueError("Promo code already exists")
    result = await db().promos.insert_one({
        "code": code.upper(),
        "discount_pct": discount_pct,
        "min_order_amount": min_order_amount,
        "max_uses": max_uses,
        "uses": 0,
        "is_active": True,
        "created_at": datetime.utcnow(),
    })
    return str(result.inserted_id)


async def list_promos() -> list:
    return await db().promos.find({}).sort("created_at", -1).to_list(None)


async def get_promo_by_code(code: str) -> dict | None:
    return await db().promos.find_one({"code": code.upper(), "is_active": True})


async def delete_promo(promo_id: str):
    await db().promos.delete_one({"_id": ObjectId(promo_id)})


async def toggle_promo(promo_id: str) -> dict | None:
    promo = await db().promos.find_one({"_id": ObjectId(promo_id)})
    if promo:
        await db().promos.update_one(
            {"_id": ObjectId(promo_id)},
            {"$set": {"is_active": not promo["is_active"]}}
        )
    return promo


async def use_promo(promo_id: str):
    await db().promos.update_one({"_id": ObjectId(promo_id)}, {"$inc": {"uses": 1}})


def apply_promo(price: int, promo: dict) -> int:
    if promo["min_order_amount"] > 0 and price < promo["min_order_amount"]:
        return price
    if promo["max_uses"] > 0 and promo["uses"] >= promo["max_uses"]:
        return price
    discount = int(price * promo["discount_pct"] / 100)
    return max(0, price - discount)


# ── Analytics ────────────────────────────────────────────────────────────────
async def get_sales_by_day(days: int = 7) -> list:
    since = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"created_at": {"$gte": since}, "status": {"$ne": "refunded"}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "revenue": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    return await db().orders.aggregate(pipeline).to_list(None)


async def get_top_products(limit: int = 10) -> list:
    pipeline = [
        {"$match": {"status": {"$ne": "refunded"}}},
        {"$group": {
            "_id": "$product_id",
            "revenue": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"revenue": -1}},
        {"$limit": limit},
    ]
    rows = await db().orders.aggregate(pipeline).to_list(None)
    for row in rows:
        try:
            p = await db().products.find_one({"_id": ObjectId(row["_id"])})
            row["name"] = p["name"] if p else "Unknown"
            row["game_id"] = p.get("game_id", "") if p else ""
        except Exception:
            row["name"] = "Unknown"
            row["game_id"] = ""
    return rows


async def get_top_users(limit: int = 20) -> list:
    pipeline = [
        {"$match": {"status": {"$ne": "refunded"}}},
        {"$group": {
            "_id": "$user_id",
            "total_spent": {"$sum": "$amount"},
            "order_count": {"$sum": 1},
        }},
        {"$sort": {"total_spent": -1}},
        {"$limit": limit},
    ]
    rows = await db().orders.aggregate(pipeline).to_list(None)
    for row in rows:
        u = await db().users.find_one({"user_id": row["_id"]})
        row["first_name"] = u["first_name"] if u else "Unknown"
        row["username"] = u.get("username", "") if u else ""
    return rows


async def get_product_stats(product_id: str) -> dict:
    pipeline = [
        {"$match": {"product_id": product_id}},
        {"$group": {
            "_id": None,
            "revenue": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
    ]
    rows = await db().orders.aggregate(pipeline).to_list(None)
    if rows:
        return {"revenue": rows[0]["revenue"], "count": rows[0]["count"]}
    return {"revenue": 0, "count": 0}
