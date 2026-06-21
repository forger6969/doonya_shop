"""
Seed catalog: games + products with photos from @DonyaaPay + official logos.
Run from repo root: python3 seed_catalog.py
"""
import asyncio
import os
import sys
import tempfile
import requests

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

import cloudinary
import cloudinary.uploader
from backend.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
from backend.database import connect_db, close_db, get_db

CLOUDINARY_OK = bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)
if CLOUDINARY_OK:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
    )
else:
    print("⚠️  Cloudinary not configured — icons stored as direct URLs, card photos skipped")

# ── Telegram (to download channel photos) ─────────────────────────────────────
from telethon.sync import TelegramClient
from telethon.tl.types import MessageMediaPhoto

TG_API_ID = 36982142
TG_API_HASH = "7ef862d1e3d3ce1892232ff1cc24f5d0"
TG_SESSION = "/Users/saidazim/.claude/scripts/wewatch_session"
CHANNEL = "DonyaaPay"


# ── Catalog definition ────────────────────────────────────────────────────────
# itunes_term → used to search App Store for the icon (512×512)
# logo_url    → fallback direct URL if iTunes doesn't match well
# channel_msg → message ID in @DonyaaPay for the product card photo

CATALOG = [
    {
        "name": "Brawl Stars",
        "description": "Официальный донат через Supercell Account. Безопасно, без бана.",
        "itunes_term": "Brawl Stars",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/9a/ec/30/9aec302e-7b5b-bddb-9d58-9e6e2f1e7e77/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg",
        "products": [
            {
                "name": "Gems",
                "description": "💎 Гемы через Supercell Account. Безопасно, без бана, без мода.",
                "channel_msg": 1087,
                "base_price": 16000,
                "variants": [
                    ("30 Gems",   16000),
                    ("80 Gems",   40000),
                    ("170 Gems",  80000),
                    ("360 Gems", 155000),
                    ("950 Gems", 370000),
                    ("2000 Gems",735000),
                ],
                "fields": [("Supercell ID (email)", True)],
            },
            {
                "name": "Brawl Pass",
                "description": "🟨 Brawl Pass без входа на аккаунт.",
                "channel_msg": 2810,
                "base_price": 80000,
                "variants": [
                    ("BP Pass",   80000),
                    ("BP Plus",  125000),
                    ("Pro Pass", 210000),
                ],
                "fields": [("Supercell ID (email)", True)],
            },
        ],
    },
    {
        "name": "Roblox",
        "description": "Robux со входом на аккаунт. Быстро и безопасно.",
        "itunes_term": "Roblox",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ac/a5/f6/aca5f69c-4a2e-44ea-9db2-7d87acf84b9d/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/512x512bb.jpg",
        "products": [
            {
                "name": "Robux",
                "description": "😖 Robux покупаются со входом на аккаунт.",
                "channel_msg": 3193,
                "base_price": 10000,
                "variants": [
                    ("40 RBX",   10000),
                    ("80 RBX",   18000),
                    ("120 RBX",  26000),
                    ("160 RBX",  36000),
                    ("200 RBX",  45000),
                    ("240 RBX",  54000),
                    ("320 RBX",  72000),
                    ("400 RBX",  70000),
                    ("500 RBX",  85000),
                    ("660 RBX", 120000),
                    ("800 RBX", 140000),
                ],
                "fields": [("Логин Roblox", True), ("Пароль Roblox", True)],
            },
        ],
    },
    {
        "name": "PUBG Mobile",
        "description": "UC через ID аккаунта. Быстрая доставка.",
        "itunes_term": "PUBG Mobile",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/42/a0/f1/42a0f10c-fde1-87ba-a22e-493304fd9c96/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg",
        "products": [
            {
                "name": "UC",
                "description": "💰 UC отправляется через ваш ID аккаунта.",
                "channel_msg": 2055,
                "base_price": 6500,
                "variants": [
                    ("30 UC",      6500),
                    ("60 UC",     13000),
                    ("120 UC",    26000),
                    ("180 UC",    39000),
                    ("325 UC",    64000),
                    ("385 UC",    76500),
                    ("660 UC",   123000),
                    ("720 UC",   136000),
                    ("985 UC",   188000),
                    ("1310 UC",  247000),
                    ("1800 UC",  310000),
                    ("3850 UC",  615000),
                    ("8100 UC", 1210000),
                    ("16200 UC",2380000),
                ],
                "fields": [("PUBG ID", True)],
            },
        ],
    },
    {
        "name": "Telegram",
        "description": "Premium, Stars, Gifts, Аватарки и Mystery Box.",
        "itunes_term": "Telegram Messenger",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/1f/69/31/1f693117-6b3a-eacf-6b77-943856b02239/Telegram-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg",
        "products": [
            {
                "name": "Premium",
                "description": "⭐ Telegram Premium — со входом и без входа на аккаунт.",
                "channel_msg": 2109,
                "base_price": 45000,
                "variants": [
                    ("1 мес (со входом)",    45000),
                    ("1 год (со входом)",   320000),
                    ("3 мес (без входа)",   170000),
                    ("6 мес (без входа)",   225000),
                    ("12 мес (без входа)",  430000),
                ],
                "fields": [("Username или номер телефона", True)],
            },
            {
                "name": "Stars",
                "description": "⭐️ Telegram Stars — быстро, безопасно, по выгодным ценам.",
                "channel_msg": 1419,
                "base_price": 14000,
                "variants": [
                    ("50 ⭐",    14000),
                    ("75 ⭐",    20000),
                    ("100 ⭐",   24000),
                    ("150 ⭐",   35000),
                    ("175 ⭐",   41000),
                    ("200 ⭐",   46000),
                    ("250 ⭐",   58000),
                    ("350 ⭐",   80000),
                    ("450 ⭐",  102000),
                    ("500 ⭐",  115000),
                    ("750 ⭐",  172000),
                    ("1000 ⭐", 230000),
                    ("2500 ⭐", 575000),
                ],
                "fields": [("Username Telegram", True)],
            },
            {
                "name": "Gifts",
                "description": "🎁 Подарки Telegram — дёшево и безопасно.",
                "channel_msg": 1130,
                "base_price": 4000,
                "variants": [
                    ("15 ⭐ подарок",   4000),
                    ("25 ⭐ подарок",   6000),
                    ("50 ⭐ подарок",  12000),
                    ("100 ⭐ подарок", 23000),
                ],
                "fields": [("Username Telegram", True)],
            },
            {
                "name": "Аватарки",
                "description": "🎨 Аватарки и баннеры на заказ в твоём стиле.",
                "channel_msg": 782,
                "base_price": 15000,
                "variants": [
                    ("Аватарка",       15000),
                    ("Баннер видео",   20000),
                ],
                "fields": [("Ваши пожелания / референс", True)],
            },
            {
                "name": "Mystery Box",
                "description": "🌕 Mystery Box — выбери 1 из 3 боксов и получи сюрприз: NFT, Stars, Gift или Premium.",
                "channel_msg": 811,
                "base_price": 40000,
                "variants": [],
                "fields": [("Username Telegram", True)],
            },
        ],
    },
    {
        "name": "Standoff 2",
        "description": "Gold, Gold Pass и уровни через ID аккаунта. Комиссия рынка на нас.",
        "itunes_term": "Standoff 2",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/d1/bc/74/d1bc74bf-a56d-6569-1c14-7c6b52ff3740/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg",
        "products": [
            {
                "name": "Gold",
                "description": "💛 Gold через рынок. Комиссия на нас — получаешь ровно столько сколько заказал.",
                "channel_msg": 3181,
                "base_price": 14000,
                "variants": [
                    ("100 Gold",  14000),
                    ("200 Gold",  28000),
                    ("300 Gold",  42000),
                    ("400 Gold",  56000),
                    ("500 Gold",  70000),
                    ("600 Gold",  84000),
                    ("700 Gold",  98000),
                    ("800 Gold", 112000),
                    ("900 Gold", 126000),
                    ("1000 Gold",140000),
                ],
                "fields": [("ID аккаунта Standoff 2", True)],
            },
            {
                "name": "Gold Pass",
                "description": "💎 Gold Pass через ID аккаунта.",
                "channel_msg": 2850,
                "base_price": 130000,
                "variants": [
                    ("Gold Pass",     130000),
                    ("Gold Pass +10", 230000),
                ],
                "fields": [("ID аккаунта Standoff 2", True)],
            },
            {
                "name": "Gold Pass Уровни",
                "description": "💎 Дополнительные уровни Gold Pass через ID аккаунта.",
                "channel_msg": 2894,
                "base_price": 19000,
                "variants": [
                    ("1 LVL",   19000),
                    ("10 LVL", 150000),
                    ("20 LVL", 280000),
                    ("45 LVL", 500000),
                ],
                "fields": [("ID аккаунта Standoff 2", True)],
            },
        ],
    },
    {
        "name": "FC Mobile",
        "description": "FP Coins со входом на аккаунт.",
        "itunes_term": "EA Sports FC Mobile Football",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/86/d2/78/86d27854-818e-9b6e-daef-ba77dca3865b/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg",
        "products": [
            {
                "name": "FP Coins",
                "description": "✖️ FP Coins со входом на аккаунт. Каждый пакет можно купить только один раз.",
                "channel_msg": 409,
                "base_price": 105000,
                "variants": [
                    ("500+500 FP",       105000),
                    ("1000+1000 FP",     200000),
                    ("2000+2000 FP",     390000),
                    ("5000+5000 FP",     995000),
                    ("10000+10000 FP", 1950000),
                    ("750 FP",          105000),
                    ("1500 FP",         200000),
                    ("3000 FP",         390000),
                    ("7500 FP",         995000),
                    ("15000 FP",       1920000),
                ],
                "fields": [("Логин EA", True), ("Пароль EA", True)],
            },
        ],
    },
    {
        "name": "Матрешка РП",
        "description": "MC Coins через никнейм игрока. Без входа на аккаунт.",
        "itunes_term": "Матрешка РП",
        "logo_url": "https://play-lh.googleusercontent.com/XyJj5fUVlJf1fK0vNb0NzlPFmUFE7sBRuRMXXU8vsMjF7P1mPlGRY3mF4fO0TMwCnw",
        "products": [
            {
                "name": "MC Coins",
                "description": "🧡 Донат через никнейм. Без входа на аккаунт.",
                "channel_msg": 2386,
                "base_price": 21000,
                "variants": [
                    ("100 MC",    21000),
                    ("199 MC",    40000),
                    ("500 MC",   100000),
                    ("1000 MC",  195000),
                    ("2000 MC",  375000),
                    ("5000 MC",  920000),
                    ("10000 MC",1800000),
                ],
                "fields": [("Никнейм в игре", True)],
            },
        ],
    },
    {
        "name": "Clash Royale",
        "description": "Гемы через Supercell ID. Без входа на аккаунт.",
        "itunes_term": "Clash Royale",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/37/80/1e/37801e4c-717a-6d48-5023-5770fdbb2e01/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg",
        "products": [
            {
                "name": "Гемы",
                "description": "💎 Гемы через Supercell ID, без входа на аккаунт.",
                "channel_msg": 2425,
                "base_price": 10000,
                "variants": [
                    ("80 Gems",      10000),
                    ("500 Gems",     42000),
                    ("1200 Gems",    82000),
                    ("2500 Gems",   150000),
                    ("6500 Gems",   380000),
                    ("14000 Gems",  730000),
                ],
                "fields": [("Supercell ID (email)", True)],
            },
        ],
    },
    {
        "name": "Black Russia",
        "description": "Black Coins со входом на аккаунт.",
        "itunes_term": "Black Russia",
        "logo_url": "https://blackrussia.net/wp-content/uploads/2023/10/android-chrome-512x512-1.png",
        "products": [
            {
                "name": "Black Coins",
                "description": "🪙 Black Coins со входом на аккаунт.",
                "channel_msg": 2619,
                "base_price": 15000,
                "variants": [
                    ("60 BC",     15000),
                    ("150 BC",    29000),
                    ("300 BC",    55000),
                    ("500 BC",    90000),
                    ("750 BC",   132000),
                    ("1050 BC",  185000),
                    ("3210 BC",  413000),
                    ("5500 BC",  670000),
                    ("7700 BC",  932000),
                    ("11000 BC",1320000),
                ],
                "fields": [("Логин Black Russia", True), ("Пароль", True)],
            },
        ],
    },
    {
        "name": "Steam",
        "description": "Prime Status CS2 и пополнение баланса Steam.",
        "itunes_term": "Steam Mobile",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png",
        "products": [
            {
                "name": "Prime Status",
                "description": "🇺🇸 Prime Status CS2 со входом на Steam аккаунт.",
                "channel_msg": 2790,
                "base_price": 195000,
                "variants": [],
                "fields": [("Steam логин", True), ("Steam пароль", True)],
            },
            {
                "name": "Пополнение баланса",
                "description": "📱 Пополнение баланса Steam в долларах.",
                "channel_msg": 2895,
                "base_price": 13500,
                "variants": [
                    ("1$",   13500),
                    ("2$",   27000),
                    ("3$",   40500),
                    ("4$",   54000),
                    ("5$",   67500),
                    ("6$",   81000),
                    ("7$",   94500),
                    ("8$",  108000),
                    ("9$",  121500),
                    ("10$", 135000),
                ],
                "fields": [("Steam логин", True), ("Steam пароль", True)],
            },
        ],
    },
    {
        "name": "Grand Mobile",
        "description": "Grand Coin — 100 сум за 1 монету.",
        "itunes_term": "Grand Mobile",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/c4/b6/bf/c4b6bf61-4290-8f9e-6077-d6fba403961e/AppIcon-1x_U007emarketing-0-11-0-85-220-0.png/512x512bb.jpg",
        "products": [
            {
                "name": "Grand Coin",
                "description": "🎁 Grand Coin — 100 сум за монету. Любое количество.",
                "channel_msg": 3455,
                "base_price": 10000,
                "variants": [
                    ("100 Coin",   10000),
                    ("200 Coin",   20000),
                    ("300 Coin",   30000),
                    ("400 Coin",   40000),
                    ("500 Coin",   50000),
                    ("600 Coin",   60000),
                    ("700 Coin",   70000),
                    ("800 Coin",   80000),
                    ("900 Coin",   90000),
                    ("1000 Coin", 100000),
                ],
                "fields": [("ID в Grand Mobile", True)],
            },
        ],
    },
    {
        "name": "Free Fire",
        "description": "Diamonds по выгодным ценам.",
        "itunes_term": "Garena Free Fire",
        "logo_url": "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b5/d6/7e/b5d67e0f-94ad-7a4a-65e2-1c03d0ce2a56/AppIcon-1774968976-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg",
        "products": [
            {
                "name": "Diamonds",
                "description": "💎 Алмазы Free Fire — дёшево в любимую игру.",
                "channel_msg": 3456,
                "base_price": 17000,
                "variants": [
                    ("110 Алмазов",   17000),
                    ("220 Алмазов",   34000),
                    ("341 Алмаз",     45000),
                    ("451 Алмаз",     62000),
                    ("572 Алмаза",    75000),
                    ("792 Алмаза",   109000),
                    ("913 Алмаза",   120000),
                    ("1166 Алмазов", 145000),
                    ("1738 Алмазов", 220000),
                    ("2398 Алмазов", 272000),
                    ("3311 Алмазов", 370000),
                ],
                "fields": [("ID Free Fire", True)],
            },
        ],
    },
    {
        "name": "Yandex",
        "description": "Яндекс Плюс и Мульти подписка.",
        "itunes_term": "Яндекс",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Yandex_2021_colored_logo.svg/512px-Yandex_2021_colored_logo.svg.png",
        "products": [
            {
                "name": "Яндекс Плюс",
                "description": "➕ Подписка Яндекс Плюс и Мульти.",
                "channel_msg": 4609,
                "base_price": 10000,
                "variants": [
                    ("Yandex Plus",       10000),
                    ("Yandex Plus Multi", 20000),
                ],
                "fields": [("Логин Яндекс", True)],
            },
        ],
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_itunes_icon(term: str) -> str:
    try:
        r = requests.get(
            "https://itunes.apple.com/search",
            params={"term": term, "entity": "software", "limit": 3, "country": "us"},
            timeout=8,
        )
        results = r.json().get("results", [])
        if results:
            return results[0].get("artworkUrl512", "")
    except Exception as e:
        print(f"  iTunes error for '{term}': {e}")
    return ""


def upload_bytes_to_cloudinary(data: bytes, public_id: str, folder: str) -> str:
    if not CLOUDINARY_OK:
        return ""
    result = cloudinary.uploader.upload(
        data,
        folder=f"doonya_shop/{folder}",
        public_id=public_id,
        resource_type="image",
        overwrite=True,
    )
    return result["secure_url"]


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    await connect_db()
    db = get_db()

    async with TelegramClient(TG_SESSION, TG_API_ID, TG_API_HASH) as tg:

        for game_data in CATALOG:
            gname = game_data["name"]
            print(f"\n{'='*60}")
            print(f"🎮 {gname}")

            # ── Game icon ──────────────────────────────────────────────────
            icon_url = ""
            fallback_logo = game_data.get("logo_url", "")
            itunes_term = game_data.get("itunes_term", gname)

            print(f"  Searching iTunes: '{itunes_term}'...")
            itunes_icon = get_itunes_icon(itunes_term)
            if itunes_icon:
                # Use iTunes URL directly — stable Apple CDN, no re-upload needed
                icon_url = itunes_icon
                print(f"  ✅ iTunes icon → {icon_url[:70]}...")
            elif fallback_logo:
                icon_url = fallback_logo
                print(f"  ✅ Fallback icon → {icon_url[:70]}...")
            else:
                print(f"  ⚠️  No logo found for {gname}")

            # ── Create / upsert game ───────────────────────────────────────
            existing_game = await db.games.find_one({"name": gname})
            if existing_game:
                game_id = str(existing_game["_id"])
                await db.games.update_one(
                    {"_id": existing_game["_id"]},
                    {"$set": {"description": game_data["description"], "icon_url": icon_url, "photo_id": icon_url}},
                )
                print(f"  🔄 Game updated (id={game_id})")
            else:
                from datetime import datetime
                count = await db.games.count_documents({})
                res = await db.games.insert_one({
                    "name": gname,
                    "description": game_data["description"],
                    "photo_id": icon_url,
                    "icon_url": icon_url,
                    "is_active": True,
                    "order": count,
                    "created_at": datetime.utcnow(),
                })
                game_id = str(res.inserted_id)
                print(f"  ✅ Game created (id={game_id})")

            # ── Products ───────────────────────────────────────────────────
            for prod in game_data["products"]:
                pname = prod["name"]
                print(f"\n  📦 Product: {pname}")

                # Download card photo from DonyaaPay channel
                card_url = ""
                msg_id = prod.get("channel_msg")
                if msg_id and CLOUDINARY_OK:
                    try:
                        msg = await tg.get_messages(CHANNEL, ids=msg_id)
                        if msg and msg.media and isinstance(msg.media, MessageMediaPhoto):
                            print(f"     Downloading card photo (msg {msg_id})...")
                            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
                                fname = f.name
                            await tg.download_media(msg, file=fname)
                            with open(fname, "rb") as img:
                                data = img.read()
                            os.unlink(fname)
                            slug = f"{gname}_{pname}".lower().replace(" ", "_")
                            card_url = upload_bytes_to_cloudinary(data, f"card_{slug}", "cards")
                            print(f"     ✅ Card uploaded → {card_url[:60]}...")
                    except Exception as e:
                        print(f"     ⚠️  Photo error: {e}")
                elif msg_id:
                    print(f"     ℹ️  Skipping photo (no Cloudinary credentials)")

                variants = [{"label": v[0], "price": v[1]} for v in prod.get("variants", [])]
                fields = [{"label": f[0], "required": f[1]} for f in prod.get("fields", [])]
                base_price = prod["base_price"]

                # Use game icon as fallback when no product card photo available
                effective_photo = card_url or icon_url

                existing_prod = await db.products.find_one({"game_id": game_id, "name": pname})
                if existing_prod:
                    pid = str(existing_prod["_id"])
                    await db.products.update_one(
                        {"_id": existing_prod["_id"]},
                        {"$set": {
                            "description": prod["description"],
                            "price": base_price,
                            "photo_id": effective_photo,
                            "icon_url": effective_photo,
                            "variants": variants,
                            "purchase_fields": fields,
                        }},
                    )
                    print(f"     🔄 Product updated (id={pid})")
                else:
                    from datetime import datetime
                    count = await db.products.count_documents({"game_id": game_id})
                    res = await db.products.insert_one({
                        "game_id": game_id,
                        "name": pname,
                        "description": prod["description"],
                        "price": base_price,
                        "photo_id": effective_photo,
                        "icon_url": effective_photo,
                        "variants": variants,
                        "purchase_fields": fields,
                        "is_active": True,
                        "order": count,
                        "created_at": datetime.utcnow(),
                    })
                    print(f"     ✅ Product created (id={res.inserted_id})")

    await close_db()
    print("\n\n✅ DONE! Catalog seeded successfully.")


if __name__ == "__main__":
    asyncio.run(main())
