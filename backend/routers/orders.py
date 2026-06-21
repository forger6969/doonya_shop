import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from bson import ObjectId
from backend.auth import get_current_user
from backend.database import get_db
from backend.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
from backend.models import (
    get_or_create_user, get_product, create_order,
    create_review, get_promo_by_code, apply_promo, use_promo,
)

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)

router = APIRouter(prefix="/orders", tags=["orders"])


class PurchaseRequest(BaseModel):
    product_id: str
    promo_code: str = ""
    variant_label: str = ""
    field_answers: dict = {}


class ReviewRequest(BaseModel):
    order_id: str
    rating: int
    text: str = ""
    photo_url: str = ""


@router.post("/buy")
async def buy_product(req: PurchaseRequest, tg_user: dict = Depends(get_current_user)):
    user_id = tg_user["id"]
    user = await get_or_create_user(user_id, tg_user.get("username", ""), tg_user.get("first_name", ""))

    product = await get_product(req.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Determine base price: variant overrides product price
    variants = product.get("variants", [])
    if variants:
        if not req.variant_label:
            raise HTTPException(status_code=400, detail="Please select a variant")
        variant = next((v for v in variants if v["label"] == req.variant_label), None)
        if not variant:
            raise HTTPException(status_code=400, detail="Invalid variant selected")
        original_price = variant["price"]
    else:
        original_price = product["price"]

    # Validate required purchase fields
    purchase_fields = product.get("purchase_fields", [])
    for f in purchase_fields:
        if f.get("required") and not req.field_answers.get(f["label"], "").strip():
            raise HTTPException(status_code=400, detail=f"Field required: {f['label']}")

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
        variant_label=req.variant_label,
        field_answers=req.field_answers,
    )

    if promo:
        await use_promo(str(promo["_id"]))

    try:
        from backend.notify import notify_admin_order
        await notify_admin_order(
            order_id, user_id, product["name"], final_price,
            variant_label=req.variant_label,
            field_answers=req.field_answers,
        )
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
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(req.order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["user_id"] != tg_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    existing = await db.reviews.find_one({"order_id": req.order_id, "user_id": tg_user["id"]})
    if existing:
        raise HTTPException(status_code=409, detail="Review already submitted")
    await create_review(
        user_id=tg_user["id"],
        order_id=req.order_id,
        product_id=order["product_id"],
        rating=req.rating,
        text=req.text,
        photo_url=req.photo_url,
    )
    return {"ok": True}


@router.post("/upload-photo")
async def upload_review_photo(file: UploadFile = File(...), _=Depends(get_current_user)):
    contents = await file.read()
    result = cloudinary.uploader.upload(
        contents,
        folder="doonya_shop/reviews",
        resource_type="image",
    )
    return {"url": result["secure_url"]}
