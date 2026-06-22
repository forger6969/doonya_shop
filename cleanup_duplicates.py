#!/usr/bin/env python3
"""
Cleanup duplicate products: keeps newest document per (game_id, name), deactivates the rest.
Run: python3 cleanup_duplicates.py [--dry-run]
"""
import asyncio
import sys
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "")
DB_NAME = os.getenv("DB_NAME", "nyx_shop")
DRY_RUN = "--dry-run" in sys.argv


async def cleanup():
    if not MONGODB_URI:
        print("ERROR: MONGODB_URI not set in .env")
        sys.exit(1)

    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]

    products = await db.products.find({"is_active": True}).sort("created_at", 1).to_list(None)
    print(f"Total active products: {len(products)}")

    # Group by (game_id, name) — case-insensitive name
    groups: dict[tuple, list] = defaultdict(list)
    for p in products:
        key = (p["game_id"], p["name"].strip().lower())
        groups[key].append(p)

    to_deactivate = []
    for (game_id, name), docs in groups.items():
        if len(docs) > 1:
            # Keep the last (newest) one, deactivate the rest
            keep = docs[-1]
            dupes = docs[:-1]
            print(f"\n  [{name}] — {len(docs)} copies, keeping {keep['_id']}, removing {len(dupes)}")
            to_deactivate.extend(d["_id"] for d in dupes)

    print(f"\nWill deactivate {len(to_deactivate)} duplicate products.")

    if DRY_RUN:
        print("DRY RUN — no changes made. Remove --dry-run to apply.")
        client.close()
        return

    if not to_deactivate:
        print("Nothing to clean up.")
        client.close()
        return

    result = await db.products.update_many(
        {"_id": {"$in": to_deactivate}},
        {"$set": {"is_active": False}},
    )
    print(f"Deactivated {result.modified_count} duplicate products.")

    remaining = await db.products.count_documents({"is_active": True})
    print(f"Active products after cleanup: {remaining}")

    client.close()


if __name__ == "__main__":
    asyncio.run(cleanup())
