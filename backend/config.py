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
UZCARD_REQUISITES: str = os.getenv("UZCARD_REQUISITES", "5614 6868 1494 1939")
UZCARD_HOLDER: str = os.getenv("UZCARD_HOLDER", "H.D")
PAYME_PHONE: str = os.getenv("PAYME_PHONE", "+998901234567")

# Multi-admin support
ADMIN_IDS: set = {ADMIN_ID} | {
    int(x.strip()) for x in os.getenv("EXTRA_ADMIN_IDS", "7004667100").split(",") if x.strip()
}

CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")
