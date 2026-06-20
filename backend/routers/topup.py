import random
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from backend.auth import get_current_user
from backend.models import get_or_create_user, create_topup
from backend.config import CARD_REQUISITES, CARD_HOLDER, PAYME_PHONE
import aiofiles
import os

router = APIRouter(prefix="/topup", tags=["topup"])

UPLOADS_DIR = "/tmp/receipts"
os.makedirs(UPLOADS_DIR, exist_ok=True)


def _unique_amount(base: int) -> int:
    """Card/Payme: add random 1-999 so the transfer is uniquely identifiable."""
    return base + random.randint(1, 999)


def _round_amount(base: int) -> int:
    """ATM: round to nearest 1000 (ATM can't accept odd sums)."""
    return round(base / 1000) * 1000


@router.get("/methods")
async def topup_methods(amount: int, method: str):
    """Return requisites + the exact amount to transfer for given method."""
    if method == "card":
        exact = _unique_amount(amount)
        return {
            "method": "card",
            "requisites": CARD_REQUISITES,
            "holder": CARD_HOLDER,
            "amount": exact,
            "note": f"Переведите ровно {exact:,} сум. По этой сумме мы идентифицируем ваш платёж.",
        }
    elif method == "payme":
        exact = _unique_amount(amount)
        return {
            "method": "payme",
            "requisites": PAYME_PHONE,
            "amount": exact,
            "note": f"Переведите ровно {exact:,} сум через Payme.",
        }
    elif method == "atm":
        exact = _round_amount(amount)
        return {
            "method": "atm",
            "amount": exact,
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

    ext = receipt.filename.rsplit(".", 1)[-1] if "." in receipt.filename else "jpg"
    filename = f"{user_id}_{unique_amount}.{ext}"
    path = os.path.join(UPLOADS_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await receipt.read())

    topup_id = await create_topup(
        user_id=user_id,
        amount=amount,
        unique_amount=unique_amount,
        method=method,
        receipt_file_id=filename,
    )

    # Notify admin via bot (fire-and-forget)
    try:
        from backend.notify import notify_admin_topup
        await notify_admin_topup(topup_id, user_id, unique_amount, method)
    except Exception:
        pass

    return {"ok": True, "topup_id": topup_id}
