from fastapi import APIRouter, Depends
from backend.auth import get_current_user
from backend.models import get_or_create_user, get_user, get_user_orders

router = APIRouter(prefix="/users", tags=["users"])


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
    }


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
