import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel, field_validator
from backend.auth import get_current_user
from backend.models import get_or_create_user, get_user, get_user_orders
from backend.database import get_db
from backend.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
)

router = APIRouter(prefix="/users", tags=["users"])


class EmailSave(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip()[:254]
        if v and "@" not in v:
            raise ValueError("Invalid email address")
        return v


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
        "avatar_url": user.get("avatar_url", ""),
    }


@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...), tg_user: dict = Depends(get_current_user)):
    db = get_db()
    contents = await file.read(5 * 1024 * 1024 + 1)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Avatar file too large (max 5 MB)")
    result = cloudinary.uploader.upload(
        contents,
        folder="doonya_shop/avatars",
        public_id=f"user_{tg_user['id']}",
        resource_type="image",
    )
    url = result["secure_url"]
    await db.users.update_one({"user_id": tg_user["id"]}, {"$set": {"avatar_url": url}})
    return {"url": url}


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
