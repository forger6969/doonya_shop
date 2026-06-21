from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.models import (
    get_or_create_user, get_product, create_order,
    create_review, get_promo_by_code, apply_promo, use_promo,
)

router = APIRouter(prefix="/orders", tags=["orders"])


class PurchaseRequest(BaseModel):
    product_id: str
    promo_code: str = ""


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

    original_price = product["price"]
    final_price = original_price
    promo = None

    if req.promo_code:
        promo = await get_promo_by_code(req.promo_code)
        if promo:
            final_price = apply_promo(original_price, promo)

    if user["balance"] < final_price:
        raise HTTPException(status_code=402, detail="Insufficient balance")

    order_id = await create_order(
        user_id=user_id,
        product_id=req.product_id,
        game_id=product["game_id"],
        amount=final_price,
        original_price=original_price,
        promo_code=req.promo_code.upper() if req.promo_code else "",
    )

    if promo:
        await use_promo(str(promo["_id"]))

    try:
        from backend.notify import notify_admin_order
        await notify_admin_order(order_id, user_id, product["name"], final_price)
    except Exception:
        pass

    return {
        "ok": True,
        "order_id": order_id,
        "original_price": original_price,
        "final_price": final_price,
        "discount": original_price - final_price,
    }


@router.post("/validate-promo")
async def validate_promo(
    product_id: str,
    promo_code: str,
    tg_user: dict = Depends(get_current_user),
):
    product = await get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    promo = await get_promo_by_code(promo_code)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found or inactive")

    original = product["price"]
    final = apply_promo(original, promo)
    return {
        "valid": True,
        "original_price": original,
        "final_price": final,
        "discount_pct": promo["discount_pct"],
        "discount": original - final,
    }


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
