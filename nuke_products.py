#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI", ""))
    db = client[os.getenv("DB_NAME", "nyx_shop")]
    result = await db.products.delete_many({})
    print(f"Deleted {result.deleted_count} products.")
    client.close()

asyncio.run(main())
