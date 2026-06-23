import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from aiogram.types import Update
from backend.database import connect_db, close_db, get_db
from backend.routers import users, catalog, topup, orders, admin, support, notifications, order_chat

logging.basicConfig(level=logging.INFO)

WEBHOOK_PATH = "/webhook"
WEBHOOK_URL = os.getenv("WEBHOOK_URL", f"https://doonya-shop-api.onrender.com{WEBHOOK_PATH}")


async def _create_indexes():
    db = get_db()
    await db.users.create_index("user_id", unique=True, background=True)
    await db.orders.create_index("user_id", background=True)
    await db.orders.create_index("status", background=True)
    await db.orders.create_index("product_id", background=True)
    await db.topups.create_index("user_id", background=True)
    await db.topups.create_index("status", background=True)
    await db.order_chats.create_index("order_id", unique=True, background=True)
    await db.order_chats.create_index("user_id", background=True)
    await db.support_chats.create_index("user_id", unique=True, background=True)
    await db.notifications.create_index([("user_id", 1), ("read", 1)], background=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await _create_indexes()
    from bot.main import bot, dp
    await bot.set_webhook(
        WEBHOOK_URL,
        allowed_updates=["message", "callback_query", "inline_query"],
        drop_pending_updates=True,
    )
    app.state.bot = bot
    app.state.dp = dp
    yield
    await bot.session.close()
    await close_db()


app = FastAPI(title="Doonya Shop API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(catalog.router)
app.include_router(topup.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(support.router)
app.include_router(notifications.router)
app.include_router(order_chat.router)


@app.post(WEBHOOK_PATH)
async def telegram_webhook(request: Request):
    data = await request.json()
    update = Update.model_validate(data)
    await request.app.state.dp.feed_update(request.app.state.bot, update)
    return {"ok": True}


@app.get("/health")
async def health():
    return {"ok": True}
