from datetime import datetime
from bson import ObjectId
from backend.database import get_db


def db():
    return get_db()


# ── Users ──────────────────────────────────────────────────────────────
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


# ── Games ───────────────────────────────────────────────────────────────
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
        "is_active": True,
        "order": count,
        "created_at": datetime.utcnow(),
    })
    return str(result.inserted_id)


async def delete_game(game_id: str):
    await db().games.update_one({"_id": ObjectId(game_id)}, {"$set": {"is_active": False}})


# ── Products ─────────────────────────────────────────────────────────────
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
        "is_active": True,
        "order": count,
        "created_at": datetime.utcnow(),
    })
    return str(result.inserted_id)


async def delete_product(product_id: str):
    await db().products.update_one({"_id": ObjectId(product_id)}, {"$set": {"is_active": False}})


# ── Top-ups ──────────────────────────────────────────────────────────────
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


# ── Orders ───────────────────────────────────────────────────────────────
async def create_order(user_id: int, product_id: str, game_id: str, amount: int) -> str:
    result = await db().orders.insert_one({
        "user_id": user_id,
        "product_id": product_id,
        "game_id": game_id,
        "amount": amount,
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


# ── Reviews ──────────────────────────────────────────────────────────────
async def create_review(user_id: int, order_id: str, product_id: str, rating: int, text: str) -> str:
    result = await db().reviews.insert_one({
        "user_id": user_id,
        "order_id": order_id,
        "product_id": product_id,
        "rating": rating,
        "text": text,
        "created_at": datetime.utcnow(),
    })
    return str(result.inserted_id)


async def get_product_reviews(product_id: str) -> list:
    return await db().reviews.find({"product_id": product_id}).sort("created_at", -1).limit(5).to_list(None)
