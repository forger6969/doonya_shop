import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import connect_db, close_db
from backend.routers import users, catalog, topup, orders, admin


async def _start_bot():
    from bot.main import dp, bot
    await dp.start_polling(bot, handle_signals=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    bot_task = asyncio.create_task(_start_bot())
    yield
    bot_task.cancel()
    try:
        await bot_task
    except asyncio.CancelledError:
        pass
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


@app.get("/health")
async def health():
    return {"ok": True}
