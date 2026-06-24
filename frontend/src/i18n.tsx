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
  inProgress: string; deliveryNote: string; backToShop: string;
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
  // TopupPage
  topupTitle: string; chooseMethod: string; enterAmount: string; requisites: string;
  uploadReceipt: string; submitting: string; topupSent: string;
  // Common
  loading: string; error: string; retry: string; reload: string;
  // Admin — Payments section
  finance: string; paymentsTitle: string;
  filterPending: string; filterConfirmed: string; filterRejected: string; filterCompleted: string;
  badgePending: string; badgeDone: string; badgeRejected: string; badgeCompleted: string;
  noPaymentsFilter: string; noOrdersFilter: string;
  // Admin — Orders section
  commerce: string; ordersTitle: string; doneBtn: string;
  // Admin — Catalog section
  catalogTitle: string; gamesTitle: string; addBtn: string;
  newGame: string; gameNamePlaceholder: string; descOptional: string; createGameBtn: string;
  tapManageProducts: string; noGamesYet: string; noProductsYet: string;
  productsSubtitle: string; newProduct: string; productNamePlaceholder: string; basePricePlaceholder: string;
  variantsPricePerOption: string; purchaseFieldsCheckout: string;
  labelVariantPlaceholder: string; pricePlaceholder: string;
  fieldLabelPlaceholder: string; reqLabel: string; optionalLabel: string; requiredLabel: string;
  saveVariantsBtn: string; createProductBtn: string;
  variantCount: string; fieldCount: string; sold: string;
  // Admin — Analytics section
  insights: string; analyticsTitle: string;
  salesTab: string; productsTab: string; usersTab: string;
  revenueByDay: string; ordersLabel: string; revenueLabel: string;
  noSalesData: string; noSalesYet: string; noUsersYet: string;
  salesCount: string; ordersCount: string;
  // Admin — Promos section
  discounts: string; promoCodesTitle: string; createBtn: string;
  newPromo: string; discountPct: string; minOrder: string; maxUses: string;
  createPromoBtn: string; noPromoCodesYet: string;
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
  inProgress: 'В обработке', deliveryNote: 'Доставим в течение нескольких минут', backToShop: 'Вернуться в магазин',
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
  topupTitle: 'Пополнение баланса', chooseMethod: 'Выберите способ', enterAmount: 'Введите сумму',
  requisites: 'Реквизиты', uploadReceipt: 'Загрузить чек', submitting: 'Отправка...',
  topupSent: 'Заявка отправлена!',
  loading: 'Загрузка...', error: 'Ошибка', retry: 'Повторить', reload: 'Перезагрузить',
  finance: 'Финансы', paymentsTitle: 'Платежи',
  filterPending: 'Ожидает', filterConfirmed: 'Подтверждён', filterRejected: 'Отклонён', filterCompleted: 'Выполнен',
  badgePending: 'Ожидает', badgeDone: 'Готово', badgeRejected: 'Отклонён', badgeCompleted: 'Выполнен',
  noPaymentsFilter: 'Платежей нет', noOrdersFilter: 'Заказов нет',
  commerce: 'Торговля', ordersTitle: 'Заказы', doneBtn: 'Готово',
  catalogTitle: 'Каталог', gamesTitle: 'Игры', addBtn: '+ Добавить',
  newGame: 'Новая игра', gameNamePlaceholder: 'Название игры *', descOptional: 'Описание (необязательно)', createGameBtn: 'Создать игру',
  tapManageProducts: 'Нажмите для управления товарами', noGamesYet: 'Игр пока нет', noProductsYet: 'Товаров пока нет',
  productsSubtitle: 'Товары', newProduct: 'Новый товар', productNamePlaceholder: 'Название товара *', basePricePlaceholder: 'Базовая цена (сум) *',
  variantsPricePerOption: 'Варианты (цена за вариант)',
  purchaseFieldsCheckout: 'Поля при покупке (спросить при оформлении)',
  labelVariantPlaceholder: 'Ярлык (напр. 10 stars)', pricePlaceholder: 'Цена',
  fieldLabelPlaceholder: 'Поле (напр. ID игрока)', reqLabel: 'обяз.', optionalLabel: 'необязательно', requiredLabel: 'обязательно',
  saveVariantsBtn: 'Сохранить варианты и поля', createProductBtn: 'Создать товар',
  variantCount: 'вариантов', fieldCount: 'полей', sold: 'продано',
  insights: 'Аналитика', analyticsTitle: 'Статистика',
  salesTab: 'Продажи', productsTab: 'Товары', usersTab: 'Пользователи',
  revenueByDay: 'Доход по дням', ordersLabel: 'Заказов', revenueLabel: 'Доход',
  noSalesData: 'Данных о продажах пока нет', noSalesYet: 'Продаж пока нет', noUsersYet: 'Пользователей пока нет',
  salesCount: 'продаж', ordersCount: 'заказов',
  discounts: 'Скидки', promoCodesTitle: 'Промокоды', createBtn: '+ Создать',
  newPromo: 'Новый промокод', discountPct: 'Скидка % *', minOrder: 'Мин. заказ (0 = любой)', maxUses: 'Макс. использований (0 = ∞)',
  createPromoBtn: 'Создать промокод', noPromoCodesYet: 'Промокодов пока нет',
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
  inProgress: 'Jarayonda', deliveryNote: "Bir necha daqiqa ichida yetkazib beramiz", backToShop: "Do'konga qaytish",
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
  topupTitle: 'Balansni to\'ldirish', chooseMethod: 'Usulni tanlang', enterAmount: 'Summani kiriting',
  requisites: 'Rekvizitlar', uploadReceipt: 'Chekni yuklash', submitting: 'Yuborilmoqda...',
  topupSent: 'Ariza yuborildi!',
  loading: 'Yuklanmoqda...', error: 'Xatolik', retry: 'Qayta urinish', reload: 'Qayta yuklash',
  finance: 'Moliya', paymentsTitle: "To'lovlar",
  filterPending: 'Kutilmoqda', filterConfirmed: 'Tasdiqlangan', filterRejected: 'Rad etilgan', filterCompleted: 'Bajarilgan',
  badgePending: 'Kutilmoqda', badgeDone: 'Bajarildi', badgeRejected: 'Rad etildi', badgeCompleted: 'Bajarildi',
  noPaymentsFilter: "To'lovlar yo'q", noOrdersFilter: "Buyurtmalar yo'q",
  commerce: 'Savdo', ordersTitle: 'Buyurtmalar', doneBtn: 'Bajarildi',
  catalogTitle: 'Katalog', gamesTitle: "O'yinlar", addBtn: "+ Qo'shish",
  newGame: "Yangi o'yin", gameNamePlaceholder: "O'yin nomi *", descOptional: 'Tavsif (ixtiyoriy)', createGameBtn: "O'yin yaratish",
  tapManageProducts: 'Mahsulotlarni boshqarish uchun bosing', noGamesYet: "Hali o'yinlar yo'q", noProductsYet: "Hali mahsulotlar yo'q",
  productsSubtitle: 'Mahsulotlar', newProduct: 'Yangi mahsulot', productNamePlaceholder: 'Mahsulot nomi *', basePricePlaceholder: 'Asosiy narx (so\'m) *',
  variantsPricePerOption: 'Variantlar (variant narxi)',
  purchaseFieldsCheckout: "Xarid maydonlari (to'lovda so'rash)",
  labelVariantPlaceholder: "Yorliq (masalan: 10 stars)", pricePlaceholder: 'Narx',
  fieldLabelPlaceholder: "Maydon (masalan: Oyinchi ID)", reqLabel: 'majb.', optionalLabel: 'ixtiyoriy', requiredLabel: 'majburiy',
  saveVariantsBtn: 'Variantlar va maydonlarni saqlash', createProductBtn: 'Mahsulot yaratish',
  variantCount: 'variant', fieldCount: 'maydon', sold: 'sotildi',
  insights: 'Tahlil', analyticsTitle: 'Statistika',
  salesTab: 'Savdo', productsTab: 'Mahsulotlar', usersTab: 'Foydalanuvchilar',
  revenueByDay: 'Kunlik daromad', ordersLabel: 'Buyurtmalar', revenueLabel: 'Daromad',
  noSalesData: "Hali savdo ma'lumotlari yo'q", noSalesYet: "Hali sotuvlar yo'q", noUsersYet: "Hali foydalanuvchilar yo'q",
  salesCount: 'sotuv', ordersCount: 'buyurtma',
  discounts: 'Chegirmalar', promoCodesTitle: 'Promo kodlar', createBtn: "+ Yaratish",
  newPromo: 'Yangi promo', discountPct: 'Chegirma % *', minOrder: 'Min. buyurtma (0 = ixtiyoriy)', maxUses: 'Maks. foydalanish (0 = ∞)',
  createPromoBtn: 'Promo kod yaratish', noPromoCodesYet: "Hali promo kodlar yo'q",
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
