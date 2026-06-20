from aiogram import Bot
from backend.config import BOT_TOKEN, ADMIN_ID

_bot: Bot | None = None


def get_bot() -> Bot:
    global _bot
    if _bot is None:
        _bot = Bot(token=BOT_TOKEN)
    return _bot


async def notify_admin_topup(topup_id: str, user_id: int, amount: int, method: str, receipt_url: str = ""):
    bot = get_bot()
    text = (
        f"💰 <b>Новое пополнение</b>\n"
        f"User: <code>{user_id}</code>\n"
        f"Сумма: <b>{amount:,} сум</b>\n"
        f"Метод: {method}\n"
        f"ID: <code>{topup_id}</code>\n\n"
        f"✅ /confirm_{topup_id}\n"
        f"❌ /reject_{topup_id}"
    )
    if receipt_url:
        await bot.send_photo(ADMIN_ID, receipt_url, caption=text, parse_mode="HTML")
    else:
        await bot.send_message(ADMIN_ID, text, parse_mode="HTML")


async def notify_admin_order(order_id: str, user_id: int, product_name: str, price: int):
    bot = get_bot()
    text = (
        f"🛒 <b>Новый заказ</b>\n"
        f"User: <code>{user_id}</code>\n"
        f"Товар: <b>{product_name}</b>\n"
        f"Цена: {price:,} сум\n"
        f"Order ID: <code>{order_id}</code>\n\n"
        f"После отправки: /done_{order_id}"
    )
    await bot.send_message(ADMIN_ID, text, parse_mode="HTML")


async def notify_user_topup_confirmed(user_id: int, amount: int):
    bot = get_bot()
    await bot.send_message(
        user_id,
        f"✅ Ваш баланс пополнен на <b>{amount:,} сум</b>. Приятных покупок!",
        parse_mode="HTML",
    )


async def notify_user_topup_rejected(user_id: int):
    bot = get_bot()
    await bot.send_message(
        user_id,
        "❌ Ваш запрос на пополнение отклонён. Напишите в поддержку если считаете это ошибкой.",
        parse_mode="HTML",
    )


async def notify_user_order_ready(user_id: int, order_id: str):
    bot = get_bot()
    await bot.send_message(
        user_id,
        f"🎮 Ваш заказ <code>{order_id}</code> выполнен! Проверьте почту/аккаунт.",
        parse_mode="HTML",
    )
