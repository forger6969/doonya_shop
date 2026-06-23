import random
import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from backend.auth import get_current_user
from backend.models import get_or_create_user, create_topup
from backend.config import UZCARD_REQUISITES, UZCARD_HOLDER, VISA_REQUISITES, VISA_HOLDER
from backend.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

router = APIRouter(prefix="/topup", tags=["topup"])

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)


def _unique_amount(base: int) -> int:
    return base + random.randint(1, 100)


def _round_amount(base: int) -> int:
    return round(base / 1000) * 1000


@router.get("/methods")
async def topup_methods(amount: int, method: str):
    if method == "uzcard":
        exact = _unique_amount(amount)
        return {
            "method": "uzcard",
            "requisites": UZCARD_REQUISITES,
            "holder": UZCARD_HOLDER,
            "amount": exact,
            "note": f"Переведите ровно {exact:,} сум на Uzcard. По этой сумме мы идентифицируем ваш платёж.",
        }
    elif method == "visa":
        exact = _unique_amount(amount)
        return {
            "method": "visa",
            "requisites": VISA_REQUISITES,
            "holder": VISA_HOLDER,
            "amount": exact,
            "note": f"Переведите ровно {exact:,} сум на Visa. По этой сумме мы идентифицируем ваш платёж.",
        }
    elif method == "atm":
        exact = _round_amount(amount)
        return {
            "method": "atm",
            "amount": exact,
            "cards": [
                {"requisites": UZCARD_REQUISITES, "holder": UZCARD_HOLDER, "type": "Uzcard"},
                {"requisites": VISA_REQUISITES, "holder": VISA_HOLDER, "type": "Visa"},
            ],
            "note": f"Внесите ровно {exact:,} сум через банкомат и прикрепите чек.",
        }
    raise HTTPException(status_code=400, detail="Unknown method")


@router.post("/submit")
async def submit_topup(
    amount: int = Form(...),
    unique_amount: int = Form(...),
    method: str = Form(...),
    receipt: UploadFile = File(...),
    tg_user: dict = Depends(get_current_user),
):
    user_id = tg_user["id"]
    await get_or_create_user(user_id, tg_user.get("username", ""), tg_user.get("first_name", ""))

    contents = await receipt.read(10 * 1024 * 1024 + 1)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Receipt file too large (max 10 MB)")
    upload_result = cloudinary.uploader.upload(
        contents,
        folder="doonya_shop/receipts",
        public_id=f"{user_id}_{unique_amount}",
        resource_type="image",
    )
    receipt_url = upload_result["secure_url"]

    topup_id = await create_topup(
        user_id=user_id,
        amount=amount,
        unique_amount=unique_amount,
        method=method,
        receipt_file_id=receipt_url,
    )

    try:
        from backend.notify import notify_admin_topup
        await notify_admin_topup(
            topup_id, user_id, unique_amount, method, receipt_url,
            first_name=tg_user.get("first_name", ""),
        )
    except Exception:
        pass

    return {"ok": True, "topup_id": topup_id}
