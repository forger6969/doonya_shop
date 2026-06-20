from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from backend.config import MONGODB_URI, DB_NAME

_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None


def get_db() -> AsyncIOMotorDatabase:
    return _db


async def connect_db():
    global _client, _db
    _client = AsyncIOMotorClient(MONGODB_URI)
    _db = _client[DB_NAME]
    await _db.users.create_index("user_id", unique=True)
    await _db.topups.create_index("user_id")
    await _db.orders.create_index("user_id")
    await _db.products.create_index("game_id")
    print("✅ MongoDB connected")


async def close_db():
    if _client:
        _client.close()
