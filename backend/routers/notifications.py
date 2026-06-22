from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.auth import verify_telegram_init_data
from backend.models import (
    create_notification, get_unread_notifications, mark_notifications_read,
)

router = APIRouter(prefix="/notify", tags=["notify"])


class NotifyManager:
    def __init__(self):
        self._connections: dict[int, WebSocket] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        self._connections[user_id] = ws

    def disconnect(self, user_id: int):
        self._connections.pop(user_id, None)

    async def send(self, user_id: int, type: str, payload: dict):
        # Always persist to DB first — guarantees delivery on reconnect
        doc = await create_notification(user_id, type, payload)

        ws = self._connections.get(user_id)
        if ws:
            try:
                await ws.send_json({"type": type, **payload})
            except Exception:
                self.disconnect(user_id)


notify_manager = NotifyManager()


@router.websocket("/ws")
async def notify_ws(websocket: WebSocket):
    init_data = websocket.query_params.get("initData", "")
    try:
        tg_user = verify_telegram_init_data(init_data)
    except Exception:
        await websocket.close(code=4001)
        return

    user_id: int = tg_user["id"]
    await websocket.accept()
    await notify_manager.connect(user_id, websocket)

    # Flush any unread notifications from DB immediately on connect
    unread = await get_unread_notifications(user_id)
    for n in reversed(unread):  # oldest first
        try:
            await websocket.send_json({"type": n["type"], **n["payload"]})
        except Exception:
            break

    try:
        while True:
            await websocket.receive_text()  # keep alive / client ping
    except WebSocketDisconnect:
        notify_manager.disconnect(user_id)


@router.post("/read")
async def mark_read(initData: str = ""):
    """Mark all notifications as read for the current user."""
    try:
        tg_user = verify_telegram_init_data(initData)
        await mark_notifications_read(tg_user["id"])
        return {"ok": True}
    except Exception:
        return {"ok": False}
