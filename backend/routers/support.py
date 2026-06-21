import json
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from backend.auth import get_current_user, verify_telegram_init_data
from backend.config import SUPPORT_AGENT_IDS
from backend.database import get_db
from backend.models import (
    get_or_create_chat, add_chat_message, get_chat,
    list_active_chats, mark_chat_read,
)

router = APIRouter(prefix="/support", tags=["support"])


# ── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # user_id → WebSocket
        self.users: dict[int, WebSocket] = {}
        # agent_id → WebSocket
        self.agents: dict[int, WebSocket] = {}

    async def connect_user(self, user_id: int, ws: WebSocket):
        self.users[user_id] = ws

    async def connect_agent(self, agent_id: int, ws: WebSocket):
        self.agents[agent_id] = ws

    def disconnect_user(self, user_id: int):
        self.users.pop(user_id, None)

    def disconnect_agent(self, agent_id: int):
        self.agents.pop(agent_id, None)

    async def send_to_user(self, user_id: int, data: dict):
        ws = self.users.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect_user(user_id)

    async def broadcast_to_agents(self, data: dict):
        for agent_id, ws in list(self.agents.items()):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect_agent(agent_id)


manager = ConnectionManager()


def _fmt_chat(chat: dict) -> dict:
    return {
        "user_id": chat["user_id"],
        "user_name": chat.get("user_name", ""),
        "first_name": chat.get("first_name", ""),
        "unread": chat.get("unread_by_agent", 0),
        "last_ts": chat["last_ts"].isoformat() if isinstance(chat["last_ts"], datetime) else chat["last_ts"],
        "last_message": chat["messages"][-1]["text"] if chat.get("messages") else "",
    }


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def support_ws(websocket: WebSocket):
    # Auth via query param (WS doesn't support custom headers from browser)
    init_data = websocket.query_params.get("initData", "")
    try:
        tg_user = verify_telegram_init_data(init_data)
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    user_id: int = tg_user["id"]
    is_agent = user_id in SUPPORT_AGENT_IDS

    if is_agent:
        await manager.connect_agent(user_id, websocket)
        # Send all active chats on connect
        chats = await list_active_chats()
        await websocket.send_json({
            "type": "chats",
            "chats": [_fmt_chat(c) for c in chats],
        })
    else:
        await manager.connect_user(user_id, websocket)
        # Create chat if not exists & send history
        chat = await get_or_create_chat(
            user_id,
            tg_user.get("username", ""),
            tg_user.get("first_name", ""),
        )
        await websocket.send_json({
            "type": "history",
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

                if is_agent:
                    # Agent sending to a specific user
                    to_user_id = data.get("to_user_id")
                    if not to_user_id:
                        continue
                    msg = await add_chat_message(to_user_id, "agent", text, agent_id=user_id)
                    # Deliver to user if online
                    await manager.send_to_user(to_user_id, {
                        "type": "message",
                        **msg,
                    })
                    # Echo to all other agents
                    await manager.broadcast_to_agents({
                        "type": "message",
                        "user_id": to_user_id,
                        **msg,
                    })
                else:
                    # User sending message
                    msg = await add_chat_message(user_id, "user", text)
                    # Echo back to user (confirmation)
                    await websocket.send_json({"type": "message", **msg})
                    # Notify all agents
                    chat_info = await get_chat(user_id)
                    await manager.broadcast_to_agents({
                        "type": "message",
                        "user_id": user_id,
                        "user_name": tg_user.get("username", ""),
                        "first_name": tg_user.get("first_name", ""),
                        **msg,
                    })
                    # Notify via bot if no agents online
                    if not manager.agents:
                        try:
                            await _notify_agents_bot(tg_user, text)
                        except Exception:
                            pass

            elif msg_type == "select_chat" and is_agent:
                # Agent requested a specific chat's history
                target_id = data.get("user_id")
                if target_id:
                    chat = await get_chat(target_id)
                    if chat:
                        await mark_chat_read(target_id)
                        await websocket.send_json({
                            "type": "chat_history",
                            "user_id": target_id,
                            "messages": chat.get("messages", []),
                        })

    except WebSocketDisconnect:
        pass
    finally:
        if is_agent:
            manager.disconnect_agent(user_id)
        else:
            manager.disconnect_user(user_id)


async def _notify_agents_bot(tg_user: dict, text: str):
    from bot.main import bot
    name = tg_user.get("first_name", "")
    username = tg_user.get("username", "")
    header = f"💬 <b>{name}</b> (@{username or '—'}) написал в поддержку:\n\n{text}"
    for agent_id in SUPPORT_AGENT_IDS:
        try:
            await bot.send_message(agent_id, header, parse_mode="HTML")
        except Exception:
            pass


# ── REST fallback (for history without WS) ────────────────────────────────────

@router.get("/chat")
async def get_my_chat(tg_user: dict = Depends(get_current_user)):
    chat = await get_chat(tg_user["id"])
    if not chat:
        return {"messages": []}
    return {"messages": chat.get("messages", [])}


# ── Agent REST (for admin panel) ──────────────────────────────────────────────

async def require_agent(tg_user: dict = Depends(get_current_user)):
    if tg_user["id"] not in SUPPORT_AGENT_IDS:
        raise HTTPException(status_code=403, detail="Forbidden")
    return tg_user


@router.get("/agent/chats")
async def agent_list_chats(_=Depends(require_agent)):
    chats = await list_active_chats()
    return [_fmt_chat(c) for c in chats]


@router.get("/agent/chats/{user_id}")
async def agent_get_chat(user_id: int, _=Depends(require_agent)):
    chat = await get_chat(user_id)
    if not chat:
        raise HTTPException(404, "Chat not found")
    await mark_chat_read(user_id)
    return {"messages": chat.get("messages", []), **_fmt_chat(chat)}
