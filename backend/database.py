from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from backend.config import MONGODB_URI, DB_NAME

_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None


def get_db() -> AsyncIOMotorDatabase:
    return _db


async def connect_db():
    global _client, _db
    _client = AsyncIOMotorClient(
        MONGODB_URI,
        maxPoolSize=20,
        minPoolSize=5,
        maxIdleTimeMS=30_000,
        serverSelectionTimeoutMS=5_000,
        connectTimeoutMS=5_000,
    )
    _db = _client[DB_NAME]
    print("✅ MongoDB connected")


async def close_db():
    if _client:
        _client.close()
