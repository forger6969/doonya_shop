from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.models import get_or_create_user, get_user, get_product, create_order, create_review

router = APIRouter(prefix="/orders", tags=["orders"])


class PurchaseRequest(BaseModel):
    product_id: str


class ReviewRequest(BaseModel):
    order_id: str
    product_id: str
    rating: int
    text: str = ""


@router.post("/buy")
async def buy_product(req: PurchaseRequest, tg_user: dict = Depends(get_current_user)):
    user_id = tg_user["id"]
    user = await get_or_create_user(user_id, tg_user.get("username", ""), tg_user.get("first_name", ""))

    product = await get_product(req.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if user["balance"] < product["price"]:
        raise HTTPException(status_code=402, detail="Insufficient balance")

    order_id = await create_order(
        user_id=user_id,
        product_id=req.product_id,
        game_id=product["game_id"],
        amount=product["price"],
    )

    # Notify admin to deliver
    try:
        from backend.notify import notify_admin_order
        await notify_admin_order(order_id, user_id, product["name"], product["price"])
    except Exception:
        pass

    return {"ok": True, "order_id": order_id}


@router.post("/review")
async def leave_review(req: ReviewRequest, tg_user: dict = Depends(get_current_user)):
    if not 1 <= req.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    await create_review(
        user_id=tg_user["id"],
        order_id=req.order_id,
        product_id=req.product_id,
        rating=req.rating,
        text=req.text,
    )
    return {"ok": True}
