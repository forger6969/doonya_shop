from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.database import get_db

router = APIRouter(prefix="/support", tags=["support"])

CATEGORIES = ["Payment", "Order", "Technical", "Other"]


class TicketCreate(BaseModel):
    category: str
    message: str


@router.post("/ticket")
async def create_ticket(req: TicketCreate, tg_user: dict = Depends(get_current_user)):
    db = get_db()
    ticket = {
        "user_id": tg_user["id"],
        "first_name": tg_user.get("first_name", ""),
        "username": tg_user.get("username", ""),
        "category": req.category,
        "message": req.message,
        "status": "pending",
        "created_at": datetime.utcnow(),
    }
    result = await db.tickets.insert_one(ticket)
    ticket_id = str(result.inserted_id)

    try:
        from backend.config import ADMIN_ID
        from bot.main import bot
        text = (
            f"🎫 <b>Support Ticket #{ticket_id[:8]}</b>\n"
            f"User: {tg_user.get('first_name')} (@{tg_user.get('username', '—')})\n"
            f"Category: {req.category}\n\n"
            f"{req.message}"
        )
        await bot.send_message(ADMIN_ID, text, parse_mode="HTML")
    except Exception:
        pass

    return {"ok": True, "ticket_id": ticket_id}


@router.get("/tickets")
async def my_tickets(tg_user: dict = Depends(get_current_user)):
    db = get_db()
    tickets = await db.tickets.find({"user_id": tg_user["id"]}).sort("created_at", -1).limit(20).to_list(None)
    return [
        {
            "id": str(t["_id"]),
            "category": t["category"],
            "message": t["message"],
            "status": t["status"],
            "reply": t.get("reply", ""),
            "created_at": t["created_at"].isoformat(),
        }
        for t in tickets
    ]
