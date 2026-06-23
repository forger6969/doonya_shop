import json
import logging
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from backend.auth import get_current_user, verify_telegram_init_data
from backend.config import ADMIN_IDS, AGENT_IDS

logger = logging.getLogger(__name__)
from backend.models import (
    get_order_chat, add_order_chat_msg, list_order_chats,
    mark_order_chat_read_admin, mark_order_chat_read_user, get_user_order_chats,
)

router = APIRouter(prefix="/order-chat", tags=["order-chat"])


class OrderChatManager:
    def __init__(self):
        self.users: dict[str, dict[int, WebSocket]] = {}
        self.admins: dict[int, WebSocket] = {}

    def connect_user(self, order_id: str, user_id: int, ws: WebSocket):
        self.users.setdefault(order_id, {})[user_id] = ws

    def connect_admin(self, admin_id: int, ws: WebSocket):
        self.admins[admin_id] = ws

    def disconnect_user(self, order_id: str, user_id: int):
        if order_id in self.users:
            self.users[order_id].pop(user_id, None)

    def disconnect_admin(self, admin_id: int):
        self.admins.pop(admin_id, None)

    async def send_to_user(self, order_id: str, data: dict):
        for ws in list((self.users.get(order_id) or {}).values()):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    async def broadcast_to_admins(self, data: dict):
        for admin_id, ws in list(self.admins.items()):
            try:
                await ws.send_json(data)
            except Exception:
                self.admins.pop(admin_id, None)


manager = OrderChatManager()


def _fmt(chat: dict) -> dict:
    return {
        "order_id": chat["order_id"],
        "user_id": chat["user_id"],
        "username": chat.get("username", ""),
        "first_name": chat.get("first_name", ""),
        "product_id": chat.get("product_id", ""),
        "product_name": chat.get("product_name", ""),
        "game_id": chat.get("game_id", ""),
        "game_name": chat.get("game_name", ""),
        "unread_by_admin": chat.get("unread_by_admin", 0),
        "unread_by_user": chat.get("unread_by_user", 0),
        "last_ts": chat["last_ts"].isoformat() if isinstance(chat["last_ts"], datetime) else chat["last_ts"],
        "last_message": chat["messages"][-1]["text"] if chat.get("messages") else "",
    }


@router.websocket("/ws")
async def order_chat_ws(websocket: WebSocket):
    init_data = websocket.query_params.get("initData", "")
    order_id = websocket.query_params.get("order_id", "")
    try:
        tg_user = verify_telegram_init_data(init_data)
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    user_id: int = tg_user["id"]
    is_admin = user_id in AGENT_IDS

    if is_admin:
        manager.connect_admin(user_id, websocket)
        chats = await list_order_chats()
        await websocket.send_json({"type": "order_chats", "chats": [_fmt(c) for c in chats]})
    else:
        if not order_id:
            await websocket.close(code=4002)
            return
        chat = await get_order_chat(order_id)
        if not chat or chat["user_id"] != user_id:
            await websocket.close(code=4003)
            return
        manager.connect_user(order_id, user_id, websocket)
        await mark_order_chat_read_user(order_id)
        await websocket.send_json({
            "type": "history",
            "order_id": order_id,
            "messages": chat.get("messages", []),
        })

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "message":
                text = str(data.get("text", "")).strip()
                if not text:
                    continue

                if is_admin:
                    target = data.get("order_id", "")
                    if not target:
                        continue
                    msg = await add_order_chat_msg(target, "admin", text, agent_id=user_id)
                    await manager.send_to_user(target, {"type": "message", "order_id": target, **msg})
                    await manager.broadcast_to_admins({"type": "message", "order_id": target, **msg})
                    # Notify user via Telegram bot
                    chat_doc = await get_order_chat(target)
                    if chat_doc:
                        await _notify_user_bot(chat_doc, text)
                else:
                    msg = await add_order_chat_msg(order_id, "user", text)
                    await websocket.send_json({"type": "message", "order_id": order_id, **msg})
                    await manager.broadcast_to_admins({
                        "type": "message", "order_id": order_id, "user_id": user_id, **msg,
                    })

            elif msg_type == "select_order" and is_admin:
                target = data.get("order_id", "")
                if target:
                    chat = await get_order_chat(target)
                    await mark_order_chat_read_admin(target)
                    await websocket.send_json({
                        "type": "order_history",
                        "order_id": target,
                        "messages": chat.get("messages", []) if chat else [],
                    })

    except WebSocketDisconnect:
        pass
    finally:
        if is_admin:
            manager.disconnect_admin(user_id)
        else:
            manager.disconnect_user(order_id, user_id)


async def _notify_user_bot(chat: dict, text: str) -> None:
    try:
        from backend.notify import get_bot
        from backend.config import MINI_APP_URL
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

        bot = get_bot()
        product = chat.get("product_name", "заказ")
        order_id = chat["order_id"]
        caption = f"💬 <b>Сообщение по заказу «{product}»</b>\n\n{text}"

        kb = None
        if MINI_APP_URL and MINI_APP_URL.startswith("https://"):
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(
                    text="📱 Открыть чат",
                    web_app=WebAppInfo(url=f"{MINI_APP_URL}?order_chat={order_id}"),
                )
            ]])

        await bot.send_message(chat["user_id"], caption, parse_mode="HTML", reply_markup=kb)
    except Exception as e:
        logger.warning("_notify_user_bot failed for order %s: %s", chat.get("order_id"), e)


async def _enrich_usernames(chats: list) -> None:
    """Backfill username/first_name from users collection for old chat docs that lack it."""
    missing = [c for c in chats if not c.get("username") and not c.get("first_name")]
    if not missing:
        return
    from backend.database import get_db
    _db = get_db()
    ids = list({c["user_id"] for c in missing})
    users = await _db.users.find(
        {"user_id": {"$in": ids}}, {"user_id": 1, "username": 1, "first_name": 1}
    ).to_list(None)
    umap = {u["user_id"]: u for u in users}
    for c in missing:
        u = umap.get(c["user_id"], {})
        if u:
            c["username"] = u.get("username", "")
            c["first_name"] = u.get("first_name", "")
            await _db.order_chats.update_one(
                {"order_id": c["order_id"]},
                {"$set": {"username": c["username"], "first_name": c["first_name"]}},
            )


async def require_admin(tg_user: dict = Depends(get_current_user)):
    if tg_user["id"] not in AGENT_IDS:
        raise HTTPException(status_code=403, detail="Forbidden")
    return tg_user


@router.get("/admin/chats")
async def admin_list_chats(game_id: str = "", product_id: str = "", _=Depends(require_admin)):
    chats = await list_order_chats(game_id=game_id, product_id=product_id)
    await _enrich_usernames(chats)
    return [_fmt(c) for c in chats]


@router.get("/my")
async def my_order_chats(tg_user: dict = Depends(get_current_user)):
    chats = await get_user_order_chats(tg_user["id"])
    return [_fmt(c) for c in chats]


@router.get("/my/{order_id}")
async def my_order_chat_history(order_id: str, tg_user: dict = Depends(get_current_user)):
    chat = await get_order_chat(order_id)
    if not chat:
        return {"messages": [], "order_id": order_id, "unread_by_user": 0}
    if chat["user_id"] != tg_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    await mark_order_chat_read_user(order_id)
    return {"messages": chat.get("messages", []), **_fmt(chat)}
