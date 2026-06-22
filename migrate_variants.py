#!/usr/bin/env python3
"""
Migration: split all variant-based products into standalone products.
Run once: python3 migrate_variants.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "")
DB_NAME = os.getenv("DB_NAME", "nyx_shop")


async def migrate():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]

    products = await db.products.find(
        {"is_active": True}
    ).to_list(None)

    total_created = 0
    total_removed = 0

    for p in products:
        variants = [v for v in (p.get("variants") or []) if v.get("label") and v.get("price")]
        if not variants:
            continue

        print(f"\n→ {p['name']}  ({len(variants)} variants)")

        base_order = await db.products.count_documents({"game_id": p["game_id"]})
        icon = p.get("icon_url") or p.get("photo_id") or ""

        for i, v in enumerate(variants):
            # Skip if a standalone product with same name already exists
            existing = await db.products.find_one({
                "game_id": p["game_id"],
                "name": v["label"],
                "is_active": True,
            })
            if existing:
                print(f"   ⏭  {v['label']} already exists, skipping")
                continue

            doc = {
                "game_id": p["game_id"],
                "name": v["label"],
                "description": "",
                "price": v["price"],
                "photo_id": icon,
                "icon_url": icon,
                "is_active": True,
                "order": base_order + i,
                "created_at": datetime.utcnow(),
                "purchase_fields": p.get("purchase_fields") or [],
                "variants": [],
                "discount_enabled": False,
                "discount_percent": 0,
                "discount_until": None,
            }
            res = await db.products.insert_one(doc)
            print(f"   ✓ {v['label']}  {v['price']} sum  → {res.inserted_id}")
            total_created += 1

        # Deactivate the grouped parent
        await db.products.update_one(
            {"_id": p["_id"]},
            {"$set": {"is_active": False}}
        )
        print(f"   ✗ parent '{p['name']}' deactivated")
        total_removed += 1

    print(f"\nDone. Created: {total_created} products, deactivated: {total_removed} parents.")
    client.close()


if __name__ == "__main__":
    if not MONGODB_URI:
        print("ERROR: MONGODB_URI not set in .env")
        exit(1)
    asyncio.run(migrate())
