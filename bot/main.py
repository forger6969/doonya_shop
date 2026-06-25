import os
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, FSInputFile
from backend.config import BOT_TOKEN, MINI_APP_URL, ADMIN_ID, ADMIN_IDS, SUPPORT_AGENT_IDS
from backend.models import confirm_topup, reject_topup, complete_order, get_product, add_chat_message, get_chat
from backend.database import get_db
from backend.notify import notify_user_topup_confirmed, notify_user_topup_rejected, notify_user_order_ready

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

BANNER_PATH = os.path.join(os.path.dirname(__file__), "welcome_banner.png")


@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🎮 Magazinni ochish", web_app=WebAppInfo(url=MINI_APP_URL))
    ]])
    caption = (
        "👋 <b>Doonya Shop</b>ga xush kelibsiz!\n\n"
        "Bizning bot orqali o'yinlar🎮 uchun tez va ishonchli tarzda "
        "donat qilishingiz mumkin.\n\n"
        "Davom etish uchun quyidagi tugmadan foydalaning 👇"
    )
    if os.path.exists(BANNER_PATH):
        await message.answer_photo(
            photo=FSInputFile(BANNER_PATH),
            caption=caption,
            reply_markup=kb,
            parse_mode="HTML",
        )
    else:
        await message.answer(caption, reply_markup=kb, parse_mode="HTML")


# ── Callback handlers (inline buttons) ───────────────────────────────────────

async def _edit_status(msg: types.Message, status_line: str) -> None:
    """Edit admin message to prepend status line, remove inline buttons."""
    try:
        if msg.photo:
            old = msg.caption or ""
            await msg.edit_caption(caption=f"{status_line}\n\n{old}", parse_mode="HTML", reply_markup=None)
        else:
            old = msg.text or ""
            await msg.edit_text(f"{status_line}\n\n{old}", parse_mode="HTML", reply_markup=None)
    except Exception:
        try:
            await msg.edit_reply_markup(reply_markup=None)
        except Exception:
            pass


@dp.callback_query(lambda c: c.data and c.data.startswith("confirm_topup:"))
async def cb_confirm_topup(callback: types.CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Нет доступа", show_alert=True)
        return
    topup_id = callback.data.removeprefix("confirm_topup:")
    result = await confirm_topup(topup_id)
    if result:
        await notify_user_topup_confirmed(result["user_id"], result["amount"])
        await _edit_status(callback.message, f"✅ <b>ПОДТВЕРЖДЕНО</b> — баланс +{result['amount']:,} сум")
        await callback.answer("✅ Подтверждено! Баланс пополнен.")
    else:
        await callback.answer("Уже обработано", show_alert=True)


@dp.callback_query(lambda c: c.data and c.data.startswith("reject_topup:"))
async def cb_reject_topup(callback: types.CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Нет доступа", show_alert=True)
        return
    topup_id = callback.data.removeprefix("reject_topup:")
    result = await reject_topup(topup_id)
    if result:
        await notify_user_topup_rejected(result["user_id"])
        await _edit_status(callback.message, "❌ <b>ОТКЛОНЕНО</b>")
        await callback.answer("❌ Отклонено.")
    else:
        await callback.answer("Уже обработано", show_alert=True)


@dp.callback_query(lambda c: c.data and c.data.startswith("done_order:"))
async def cb_done_order(callback: types.CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Нет доступа", show_alert=True)
        return
    order_id = callback.data.removeprefix("done_order:")
    order = await complete_order(order_id)
    if order:
        product_name = ""
        try:
            p = await get_product(order["product_id"])
            product_name = p["name"] if p else ""
        except Exception:
            pass
        await notify_user_order_ready(order["user_id"], order_id, product_name)
        await _edit_status(callback.message, "✅ <b>ВЫПОЛНЕН</b> — пользователь уведомлён")
        await callback.answer("✅ Заказ выполнен, пользователь уведомлён.")
    else:
        await callback.answer("Заказ не найден", show_alert=True)


# ── Legacy text command fallbacks ─────────────────────────────────────────────

@dp.message(lambda m: m.text and m.text.startswith("/confirm_") and m.from_user.id == ADMIN_ID)
async def admin_confirm(message: types.Message):
    topup_id = message.text.removeprefix("/confirm_").strip()
    result = await confirm_topup(topup_id)
    if result:
        await notify_user_topup_confirmed(result["user_id"], result["amount"])
        await message.answer("✅ Пополнение подтверждено, баланс обновлён.")
    else:
        await message.answer("❌ Не найдено или уже обработано.")


@dp.message(lambda m: m.text and m.text.startswith("/reject_") and m.from_user.id == ADMIN_ID)
async def admin_reject(message: types.Message):
    topup_id = message.text.removeprefix("/reject_").strip()
    result = await reject_topup(topup_id)
    if result:
        await notify_user_topup_rejected(result["user_id"])
        await message.answer("✅ Отклонено, пользователь уведомлён.")
    else:
        await message.answer("❌ Не найдено или уже обработано.")


@dp.message(lambda m: m.text and m.text.startswith("/done_") and m.from_user.id == ADMIN_ID)
async def admin_done(message: types.Message):
    order_id = message.text.removeprefix("/done_").strip()
    order = await complete_order(order_id)
    if order:
        await notify_user_order_ready(order["user_id"], order_id)
        await message.answer("✅ Заказ выполнен, пользователь уведомлён.")
    else:
        await message.answer("❌ Заказ не найден.")


# ── Support: agent reply via bot ──────────────────────────────────────────────

@dp.message(lambda m: m.text and m.text.startswith("/sreply") and m.from_user.id in SUPPORT_AGENT_IDS)
async def agent_sreply(message: types.Message):
    """Usage: /sreply <user_id> <text>"""
    parts = message.text.removeprefix("/sreply").strip().split(" ", 1)
    if len(parts) < 2:
        await message.answer("Usage: /sreply <user_id> <text>")
        return
    try:
        target_user_id = int(parts[0])
    except ValueError:
        await message.answer("❌ Invalid user_id")
        return
    text = parts[1].strip()
    if not text:
        await message.answer("❌ Empty message")
        return

    msg = await add_chat_message(target_user_id, "agent", text, agent_id=message.from_user.id)

    # Push to user via WebSocket if online
    try:
        from backend.routers.support import manager
        await manager.send_to_user(target_user_id, {"type": "message", **msg})
        await manager.broadcast_to_agents({"type": "message", "user_id": target_user_id, **msg})
    except Exception:
        pass

    # Notify user via bot if not in mini-app
    try:
        await bot.send_message(
            target_user_id,
            f"💬 <b>Поддержка:</b>\n{text}\n\n<i>Открой магазин чтобы ответить</i>",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="💬 Открыть чат", web_app=WebAppInfo(url=MINI_APP_URL))
            ]]),
        )
    except Exception:
        pass

    await message.answer("✅ Отправлено")
