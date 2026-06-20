from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import connect_db, close_db
from backend.routers import users, catalog, topup, orders, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="Nyx Shop API", lifespan=lifespan)

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
