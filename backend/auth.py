import hashlib
import hmac
import json
import time
from urllib.parse import unquote, parse_qsl
from fastapi import HTTPException, Header
from backend.config import BOT_TOKEN

# initData expires after 24 hours
_INIT_DATA_MAX_AGE = 86400


def verify_telegram_init_data(init_data: str) -> dict:
    """Validate Telegram Mini App initData and return parsed user."""
    if not init_data:
        raise HTTPException(status_code=401, detail="Missing initData")

    parsed = dict(parse_qsl(unquote(init_data), keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="No hash in initData")

    # Reject stale tokens (replay-attack protection)
    auth_date = parsed.get("auth_date", "")
    if auth_date:
        try:
            age = int(time.time()) - int(auth_date)
            if age > _INIT_DATA_MAX_AGE:
                raise HTTPException(status_code=401, detail="initData expired")
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid auth_date")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(received_hash, expected_hash):
        raise HTTPException(status_code=401, detail="Invalid initData signature")

    user_str = parsed.get("user", "{}")
    try:
        return json.loads(user_str)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid user payload in initData")


async def get_current_user(x_init_data: str = Header(..., alias="X-Init-Data")) -> dict:
    return verify_telegram_init_data(x_init_data)
