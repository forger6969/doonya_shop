from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.auth import verify_telegram_init_data

router = APIRouter(prefix="/notify", tags=["notify"])


class NotifyManager:
    def __init__(self):
        self._connections: dict[int, WebSocket] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        self._connections[user_id] = ws

    def disconnect(self, user_id: int):
        self._connections.pop(user_id, None)

    async def send(self, user_id: int, data: dict):
        ws = self._connections.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
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

    try:
        while True:
            await websocket.receive_text()  # keep alive / ping
    except WebSocketDisconnect:
        notify_manager.disconnect(user_id)
