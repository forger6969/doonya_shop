import asyncio
from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.exceptions import TelegramForbiddenError, TelegramBadRequest
from backend.config import BOT_TOKEN, ADMIN_ID, MINI_APP_URL

_bot: Bot | None = None


def get_bot() -> Bot:
    global _bot
    if _bot is None:
        _bot = Bot(token=BOT_TOKEN)
    return _bot


async def notify_admin_topup(
    topup_id: str, user_id: int, amount: int, method: str,
    receipt_url: str = "", first_name: str = "",
):
    bot = get_bot()
    user_label = f"<b>{first_name}</b> (ID: <code>{user_id}</code>)" if first_name else f"ID: <code>{user_id}</code>"
    text = (
        f"💰 <b>Новое пополнение</b>\n"
        f"От: {user_label}\n"
        f"Сумма: <b>{amount:,} сум</b>\n"
        f"Метод: {method}\n"
        f"ID: <code>{topup_id}</code>"
    )
    action_row = [
        InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"confirm_topup:{topup_id}"),
        InlineKeyboardButton(text="❌ Отклонить", callback_data=f"reject_topup:{topup_id}"),
    ]
    rows = [action_row]
    if MINI_APP_URL:
        rows.append([
            InlineKeyboardButton(
                text="📱 Открыть приложение",
                web_app=WebAppInfo(url=f"{MINI_APP_URL}?section=payments"),
            )
        ])
    kb = InlineKeyboardMarkup(inline_keyboard=rows)
    if receipt_url:
        await bot.send_photo(ADMIN_ID, receipt_url, caption=text, parse_mode="HTML", reply_markup=kb)
    else:
        await bot.send_message(ADMIN_ID, text, parse_mode="HTML", reply_markup=kb)


async def notify_admin_order(
    order_id: str, user_id: int, product_name: str, price: int,
    variant_label: str = "", field_answers: dict | None = None,
    username: str = "", first_name: str = "",
):
    bot = get_bot()
    if username:
        user_label = f"<b>{first_name}</b> @{username} (<code>{user_id}</code>)" if first_name else f"@{username} (<code>{user_id}</code>)"
    elif first_name:
        user_label = f"<b>{first_name}</b> (<code>{user_id}</code>)"
    else:
        user_label = f"<code>{user_id}</code>"
    text = (
        f"🛒 <b>Новый заказ</b>\n"
        f"От: {user_label}\n"
        f"Товар: <b>{product_name}</b>"
    )
    if variant_label:
        text += f" — {variant_label}"
    text += f"\nЦена: {price:,} сум\nOrder ID: <code>{order_id}</code>"
    if field_answers:
        text += "\n"
        for k, v in field_answers.items():
            text += f"\n{k}: <code>{v}</code>"

    contact_url = f"https://t.me/{username}" if username else f"tg://user?id={user_id}"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Выполнен", callback_data=f"done_order:{order_id}"),
            InlineKeyboardButton(text="✍️ Написать", url=contact_url),
        ],
    ])
    await bot.send_message(ADMIN_ID, text, parse_mode="HTML", reply_markup=kb)


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


async def broadcast_discount(
    product_name: str,
    discount_percent: int,
    photo_url: str = "",
    game_name: str = "",
):
    """Send discount announcement to all users (fire-and-forget, rate-limited)."""
    from backend.models import get_all_user_ids
    bot = get_bot()
    user_ids = await get_all_user_ids()

    game_line = f"🎮 <b>{game_name}</b>\n" if game_name else ""
    text = (
        f"🔥 <b>СКИДКА В DOONYA SHOP!</b>\n\n"
        f"{game_line}"
        f"Товар: <b>{product_name}</b>\n"
        f"Скидка: <b>-{discount_percent}%</b> 🎉\n\n"
        f"Успей купить по выгодной цене!"
    )
    kb = None
    if MINI_APP_URL:
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🛒 Открыть магазин", web_app=WebAppInfo(url=MINI_APP_URL))
        ]])

    sent = 0
    for user_id in user_ids:
        try:
            if photo_url:
                await bot.send_photo(user_id, photo_url, caption=text, parse_mode="HTML", reply_markup=kb)
            else:
                await bot.send_message(user_id, text, parse_mode="HTML", reply_markup=kb)
            sent += 1
        except (TelegramForbiddenError, TelegramBadRequest):
            pass  # user blocked bot or chat not found
        except Exception:
            pass
        # Rate limit: ~30 msg/sec max, stay safe at 20/sec
        if sent % 20 == 0:
            await asyncio.sleep(1)

    return sent


async def notify_user_order_ready(user_id: int, order_id: str, product_name: str = ""):
    import logging
    bot = get_bot()
    label = f"<b>{product_name}</b>" if product_name else "Ваш заказ"
    kb = None
    try:
        review_url = f"{MINI_APP_URL}?review={order_id}" if MINI_APP_URL and MINI_APP_URL.startswith("https://") else ""
        if review_url:
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="⭐ Оставить отзыв", web_app=WebAppInfo(url=review_url)),
            ]])
    except Exception as e:
        logging.warning(f"notify_user_order_ready: keyboard build failed: {e}")
        kb = None
    try:
        await bot.send_message(
            user_id,
            f"🎮 {label} выполнен!\n\nОставьте отзыв — это помогает другим покупателям 🙏",
            parse_mode="HTML",
            reply_markup=kb,
        )
    except Exception as e:
        logging.error(f"notify_user_order_ready: send failed to {user_id}: {e}")
