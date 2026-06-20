from motor.motor_asyncio import AsyncIOMotorClient
from backend.config import MONGODB_URI, DB_NAME

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    # Indexes
    await db.users.create_index("user_id", unique=True)
    await db.topups.create_index("user_id")
    await db.orders.create_index("user_id")
    await db.products.create_index("game_id")
    print("✅ MongoDB connected")


async def close_db():
    if client:
        client.close()
