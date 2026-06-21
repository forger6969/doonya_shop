import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'ru' | 'uz';

export interface Translations {
  // Nav
  shop: string; support: string; profile: string;
  // Catalog
  searchGames: string; allGames: string; products: string; all: string; buy: string;
  topUpBalance: string; fastDelivery: string; bestPrices: string;
  topUpNow: string; browseGames: string; shopNow: string;
  nothingFound: string; results: string; comingSoon: string;
  // Profile
  balance: string; orders: string; payments: string; settings: string;
  noOrders: string; noPayments: string;
  emailAddress: string; emailHint: string; save: string; saved: string;
  telegramAccount: string; language: string; changeAvatar: string;
  // BuyModal
  selectVariant: string; price: string; promoCode: string; apply: string;
  orderPlaced: string; processingShortly: string; confirm: string; cancel: string;
  insufficientBalance: string; sending: string;
  // Support
  newRequest: string; history: string; yourMessage: string; send: string;
  sentSuccess: string; requestSentDesc: string;
  // Review
  leaveReview: string; shareExperience: string; attachPhoto: string;
  sendReview: string; thankYou: string; helpedOthers: string;
  awful: string; bad: string; okay: string; good: string; excellent: string;
  // ProductDetail
  description: string; reviews: string; noReviews: string; pickVariant: string;
  // Admin nav
  adHome: string; adPay: string; adOrders: string; adCatalog: string; adStats: string; adPromos: string;
  // Admin labels
  overview: string; totalRevenue: string; allTime: string;
  pendingTopups: string; pendingOrders: string; totalGames: string; totalProducts: string;
  viewAnalytics: string; promoCodes: string;
  paymentDetail: string; reject: string; approve: string;
  noTopupsYet: string; noOrdersYet: string;
  newProduct: string; newGame: string; addProduct: string; createGame: string;
  basePrice: string; productName: string; gameName: string; description2: string;
  variantsLabel: string; fieldsLabel: string;
  // TopupPage
  topupTitle: string; chooseMethod: string; enterAmount: string; requisites: string;
  uploadReceipt: string; submitting: string; topupSent: string;
  // Common
  loading: string; error: string; retry: string; reload: string;
}

const ru: Translations = {
  shop: 'Магазин', support: 'Поддержка', profile: 'Профиль',
  searchGames: 'Поиск игр...', allGames: 'Все игры', products: 'товаров', all: 'Все', buy: 'Купить',
  topUpBalance: 'Пополнить баланс', fastDelivery: 'Быстрая доставка', bestPrices: 'Лучшие цены',
  topUpNow: 'Пополнить', browseGames: 'В каталог', shopNow: 'Перейти',
  nothingFound: 'Ничего не найдено', results: 'Результаты', comingSoon: 'Товары скоро появятся',
  balance: 'Баланс', orders: 'Заказы', payments: 'Платежи', settings: 'Настройки',
  noOrders: 'Заказов пока нет', noPayments: 'Платежей пока нет',
  emailAddress: 'Email адрес', emailHint: 'Получайте уведомления о заказах на email',
  save: 'Сохранить', saved: 'Сохранено!', telegramAccount: 'Аккаунт Telegram',
  language: 'Язык интерфейса', changeAvatar: 'Изменить фото',
  selectVariant: 'Выберите вариант', price: 'Цена', promoCode: 'Промокод', apply: 'Применить',
  orderPlaced: 'Заказ оформлен!', processingShortly: 'Обрабатывается...', confirm: 'Подтвердить',
  cancel: 'Отмена', insufficientBalance: 'Недостаточно средств. Пополните баланс.', sending: 'Отправка...',
  newRequest: 'Новое обращение', history: 'История', yourMessage: 'Опишите проблему...',
  send: 'Отправить', sentSuccess: 'Отправлено!', requestSentDesc: 'Мы ответим как можно скорее',
  leaveReview: 'Оставить отзыв', shareExperience: 'Поделитесь своим опытом',
  attachPhoto: 'Прикрепить фото', sendReview: 'Отправить отзыв',
  thankYou: 'Спасибо за отзыв!', helpedOthers: 'Это помогает другим покупателям',
  awful: 'Ужасно', bad: 'Плохо', okay: 'Нормально', good: 'Хорошо', excellent: 'Отлично',
  description: 'Описание', reviews: 'Отзывы', noReviews: 'Отзывов пока нет', pickVariant: 'Выберите вариант',
  adHome: 'Home', adPay: 'Pay', adOrders: 'Orders', adCatalog: 'Catalog', adStats: 'Stats', adPromos: 'Promos',
  overview: 'Обзор', totalRevenue: 'Общая выручка', allTime: 'За всё время',
  pendingTopups: 'Ожидают оплаты', pendingOrders: 'Ожидают выполнения',
  totalGames: 'Всего игр', totalProducts: 'Всего товаров',
  viewAnalytics: 'Аналитика', promoCodes: 'Промокоды',
  paymentDetail: 'Детали оплаты', reject: 'Отклонить', approve: 'Подтвердить',
  noTopupsYet: 'Пополнений пока нет', noOrdersYet: 'Заказов пока нет',
  newProduct: 'Новый товар', newGame: 'Новая игра', addProduct: 'Добавить товар', createGame: 'Создать игру',
  basePrice: 'Базовая цена (сум)', productName: 'Название товара *', gameName: 'Название игры *',
  description2: 'Описание (необязательно)',
  variantsLabel: 'Варианты (если нужны — 10 stars, 25 stars…)',
  fieldsLabel: 'Что спросить при покупке (ID игрока, ник…)',
  topupTitle: 'Пополнение баланса', chooseMethod: 'Выберите способ', enterAmount: 'Введите сумму',
  requisites: 'Реквизиты', uploadReceipt: 'Загрузить чек', submitting: 'Отправка...',
  topupSent: 'Заявка отправлена!',
  loading: 'Загрузка...', error: 'Ошибка', retry: 'Повторить', reload: 'Перезагрузить',
};

const uz: Translations = {
  shop: "Do'kon", support: 'Yordam', profile: 'Profil',
  searchGames: "O'yinlarni qidirish...", allGames: "Barcha o'yinlar", products: 'mahsulot', all: 'Hammasi', buy: 'Sotib olish',
  topUpBalance: 'Balansni to\'ldirish', fastDelivery: 'Tez yetkazib berish', bestPrices: 'Eng yaxshi narxlar',
  topUpNow: "To'ldirish", browseGames: 'Katalogga', shopNow: "O'tish",
  nothingFound: 'Hech narsa topilmadi', results: 'Natijalar', comingSoon: "Mahsulotlar tez orada qo'shiladi",
  balance: 'Balans', orders: 'Buyurtmalar', payments: "To'lovlar", settings: 'Sozlamalar',
  noOrders: 'Hali buyurtmalar yo\'q', noPayments: "Hali to'lovlar yo'q",
  emailAddress: 'Email manzil', emailHint: "Buyurtmalar haqida emailga xabar olish",
  save: 'Saqlash', saved: 'Saqlandi!', telegramAccount: 'Telegram akkaunt',
  language: 'Interfeys tili', changeAvatar: 'Rasmni o\'zgartirish',
  selectVariant: 'Variantni tanlang', price: 'Narx', promoCode: 'Promo kod', apply: "Qo'llash",
  orderPlaced: 'Buyurtma qabul qilindi!', processingShortly: 'Jarayonda...', confirm: 'Tasdiqlash',
  cancel: 'Bekor qilish', insufficientBalance: "Mablag' yetarli emas. Balansni to'ldiring.", sending: 'Yuborilmoqda...',
  newRequest: 'Yangi murojaat', history: 'Tarix', yourMessage: 'Muammoni tavsiflang...',
  send: 'Yuborish', sentSuccess: 'Yuborildi!', requestSentDesc: "Imkon qadar tezroq javob beramiz",
  leaveReview: 'Sharh qoldirish', shareExperience: 'Tajribangiz bilan ulashing',
  attachPhoto: 'Rasm biriktirish', sendReview: 'Sharh yuborish',
  thankYou: 'Sharh uchun rahmat!', helpedOthers: "Bu boshqa xaridorlarga yordam beradi",
  awful: 'Dahshatli', bad: 'Yomon', okay: "Maqbul", good: 'Yaxshi', excellent: 'A\'lo',
  description: 'Tavsif', reviews: 'Sharhlar', noReviews: "Hali sharhlar yo'q", pickVariant: 'Variantni tanlang',
  adHome: 'Home', adPay: 'Pay', adOrders: 'Orders', adCatalog: 'Catalog', adStats: 'Stats', adPromos: 'Promos',
  overview: 'Umumiy ko\'rinish', totalRevenue: 'Umumiy daromad', allTime: 'Barcha vaqt',
  pendingTopups: "To'lov kutilmoqda", pendingOrders: 'Buyurtmalar kutilmoqda',
  totalGames: "Jami o'yinlar", totalProducts: 'Jami mahsulotlar',
  viewAnalytics: 'Analitika', promoCodes: 'Promo kodlar',
  paymentDetail: "To'lov tafsilotlari", reject: 'Rad etish', approve: 'Tasdiqlash',
  noTopupsYet: "Hali to'plamalar yo'q", noOrdersYet: "Hali buyurtmalar yo'q",
  newProduct: 'Yangi mahsulot', newGame: "Yangi o'yin", addProduct: 'Mahsulot qo\'shish', createGame: "O'yin yaratish",
  basePrice: 'Asosiy narx (so\'m)', productName: 'Mahsulot nomi *', gameName: "O'yin nomi *",
  description2: 'Tavsif (ixtiyoriy)',
  variantsLabel: 'Variantlar (10 stars, 25 stars…)',
  fieldsLabel: "Xarid paytida nima so'rash (Oyinchi ID, nick…)",
  topupTitle: 'Balansni to\'ldirish', chooseMethod: 'Usulni tanlang', enterAmount: 'Summani kiriting',
  requisites: 'Rekvizitlar', uploadReceipt: 'Chekni yuklash', submitting: 'Yuborilmoqda...',
  topupSent: 'Ariza yuborildi!',
  loading: 'Yuklanmoqda...', error: 'Xatolik', retry: 'Qayta urinish', reload: 'Qayta yuklash',
};

const ALL: Record<Lang, Translations> = { ru, uz };

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: Translations }
const LangContext = createContext<LangCtx>({ lang: 'ru', setLang: () => {}, t: ru });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'ru');
  const changeLang = (l: Lang) => { setLang(l); localStorage.setItem('lang', l); };
  return <LangContext.Provider value={{ lang, setLang: changeLang, t: ALL[lang] }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
