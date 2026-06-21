from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.models import get_or_create_user, get_user, get_user_orders
from backend.database import get_db

router = APIRouter(prefix="/users", tags=["users"])


class EmailSave(BaseModel):
    email: str


@router.post("/me")
async def get_me(tg_user: dict = Depends(get_current_user)):
    user = await get_or_create_user(
        user_id=tg_user["id"],
        username=tg_user.get("username", ""),
        first_name=tg_user.get("first_name", ""),
    )
    return {
        "user_id": user["user_id"],
        "first_name": user["first_name"],
        "username": user.get("username", ""),
        "balance": user["balance"],
        "email": user.get("email", ""),
    }


@router.post("/email")
async def save_email(req: EmailSave, tg_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"user_id": tg_user["id"]},
        {"$set": {"email": req.email}},
    )
    return {"ok": True}


@router.get("/orders")
async def my_orders(tg_user: dict = Depends(get_current_user)):
    orders = await get_user_orders(tg_user["id"])
    return [
        {
            "id": str(o["_id"]),
            "product_id": o["product_id"],
            "amount": o["amount"],
            "status": o["status"],
            "created_at": o["created_at"].isoformat(),
        }
        for o in orders
    ]


@router.get("/topups")
async def my_topups(tg_user: dict = Depends(get_current_user)):
    db = get_db()
    topups = await db.topups.find({"user_id": tg_user["id"]}).sort("created_at", -1).limit(20).to_list(None)
    return [
        {
            "id": str(t["_id"]),
            "amount": t["amount"],
            "method": t["method"],
            "status": t["status"],
            "created_at": t["created_at"].isoformat(),
        }
        for t in topups
    ]
