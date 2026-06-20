import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
ADMIN_ID: int = int(os.getenv("ADMIN_ID", "0"))
MONGODB_URI: str = os.getenv("MONGODB_URI", "")
DB_NAME: str = os.getenv("DB_NAME", "nyx_shop")
MINI_APP_URL: str = os.getenv("MINI_APP_URL", "")

CARD_REQUISITES: str = os.getenv("CARD_REQUISITES", "8600 1234 5678 9012")
CARD_HOLDER: str = os.getenv("CARD_HOLDER", "NYX SHOP")
PAYME_PHONE: str = os.getenv("PAYME_PHONE", "+998901234567")
