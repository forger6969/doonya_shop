from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from aiogram.types import Update
from backend.database import connect_db, close_db
from backend.routers import users, catalog, topup, orders, admin
from backend.config import BOT_TOKEN

WEBHOOK_PATH = "/webhook"
WEBHOOK_URL = f"https://doonya-shop-api.onrender.com{WEBHOOK_PATH}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    from bot.main import bot, dp
    await bot.set_webhook(WEBHOOK_URL, drop_pending_updates=True)
    app.state.bot = bot
    app.state.dp = dp
    yield
    await bot.delete_webhook()
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


@app.post(WEBHOOK_PATH)
async def telegram_webhook(request: Request):
    data = await request.json()
    update = Update.model_validate(data)
    await request.app.state.dp.feed_update(request.app.state.bot, update)
    return {"ok": True}


@app.get("/health")
async def health():
    return {"ok": True}
