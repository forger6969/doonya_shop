import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from backend.config import BOT_TOKEN, MINI_APP_URL, ADMIN_ID
from backend.database import connect_db, close_db
from backend.models import confirm_topup, reject_topup, complete_order
from backend.notify import notify_user_topup_confirmed, notify_user_topup_rejected, notify_user_order_ready

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🎮 Открыть магазин", web_app=WebAppInfo(url=MINI_APP_URL))
    ]])
    await message.answer(
        "👋 Добро пожаловать в <b>Nyx Shop</b>!\n\n"
        "Здесь вы можете купить внутриигровую валюту, донаты и товары для ваших игр.",
        reply_markup=kb,
        parse_mode="HTML",
    )


# Admin commands: /confirm_<id>, /reject_<id>, /done_<id>
@dp.message(lambda m: m.text and m.text.startswith("/confirm_") and m.from_user.id == ADMIN_ID)
async def admin_confirm(message: types.Message):
    topup_id = message.text.removeprefix("/confirm_").strip()
    result = await confirm_topup(topup_id)
    if result:
        await notify_user_topup_confirmed(result["user_id"], result["amount"])
        await message.answer(f"✅ Пополнение подтверждено, баланс пользователя обновлён.")
    else:
        await message.answer("❌ Не найдено или уже обработано.")


@dp.message(lambda m: m.text and m.text.startswith("/reject_") and m.from_user.id == ADMIN_ID)
async def admin_reject(message: types.Message):
    topup_id = message.text.removeprefix("/reject_").strip()
    result = await reject_topup(topup_id)
    if result:
        await notify_user_topup_rejected(result["user_id"])
        await message.answer("✅ Пополнение отклонено, пользователь уведомлён.")
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


async def main():
    await connect_db()
    try:
        await dp.start_polling(bot)
    finally:
        await close_db()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
