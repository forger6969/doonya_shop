import { useState } from "react";
import { getTopupInfo, submitTopup } from "../api";


type Method = "card" | "payme" | "atm";
type Step = "amount" | "method" | "requisites" | "receipt" | "done";

interface TopupInfo {
  method: Method;
  requisites?: string;
  holder?: string;
  amount: number;
  note: string;
}

interface Props { onBack: () => void }

const METHODS: { id: Method; label: string; icon: string }[] = [
  { id: "card", label: "Банковская карта", icon: "💳" },
  { id: "payme", label: "Payme", icon: "📱" },
  { id: "atm", label: "Банкомат", icon: "🏧" },
];

export default function TopupPage({ onBack }: Props) {
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [info, setInfo] = useState<TopupInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAmountNext = () => {
    const n = parseInt(amount);
    if (!n || n < 5000) { setError("Минимум 5 000 сум"); return; }
    setError("");
    setStep("method");
  };

  const handleMethod = async (m: Method) => {
    setMethod(m);
    setLoading(true);
    const data = await getTopupInfo(parseInt(amount), m);
    setInfo(data);
    setLoading(false);
    setStep("requisites");
  };

  const handleSubmit = async () => {
    if (!file || !info || !method) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("amount", amount);
    fd.append("unique_amount", String(info.amount));
    fd.append("method", method);
    fd.append("receipt", file);
    await submitTopup(fd);
    setLoading(false);
    setStep("done");
  };

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="text-6xl">✅</div>
        <div>
          <p className="text-xl font-bold">Заявка отправлена!</p>
          <p className="text-white/50 mt-2 text-sm">
            Мы проверим оплату и начислим баланс в течение нескольких минут.
          </p>
        </div>
        <button className="btn-primary max-w-xs" onClick={onBack}>На главную</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="flex items-center gap-2 text-sm text-white/60 active:opacity-70 w-fit" onClick={onBack}>
        ← Назад
      </button>
      <h2 className="text-lg font-bold">💰 Пополнение баланса</h2>

      {step === "amount" && (
        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-2">
            <label className="text-sm text-white/50">Сумма пополнения (сум)</label>
            <input
              type="number"
              className="bg-transparent text-2xl font-bold outline-none placeholder:text-white/20 w-full"
              placeholder="10 000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAmountNext()}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary" onClick={handleAmountNext}>Продолжить</button>
        </div>
      )}

      {step === "method" && (
        <div className="flex flex-col gap-3">
          <p className="text-white/50 text-sm">Выберите способ оплаты</p>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            METHODS.map((m) => (
              <button
                key={m.id}
                className="card text-left flex items-center gap-4 active:opacity-70"
                onClick={() => handleMethod(m.id)}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="font-medium">{m.label}</span>
                <span className="ml-auto text-white/40">›</span>
              </button>
            ))
          )}
        </div>
      )}

      {step === "requisites" && info && (
        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-3">
            {info.requisites && (
              <div className="flex justify-between items-center">
                <span className="text-white/50 text-sm">Реквизиты</span>
                <button
                  className="font-mono font-bold text-purple-300 active:opacity-70"
                  onClick={() => {
                    navigator.clipboard.writeText(info.requisites!);
                    window.Telegram?.WebApp?.showAlert("Скопировано!");
                  }}
                >
                  {info.requisites} 📋
                </button>
              </div>
            )}
            {info.holder && (
              <div className="flex justify-between">
                <span className="text-white/50 text-sm">Получатель</span>
                <span className="font-medium">{info.holder}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-1">
              <span className="text-white/50 text-sm">Сумма к переводу</span>
              <button
                className="text-xl font-bold text-yellow-400 active:opacity-70"
                onClick={() => {
                  navigator.clipboard.writeText(String(info.amount));
                  window.Telegram?.WebApp?.showAlert("Скопировано!");
                }}
              >
                {info.amount.toLocaleString()} сум 📋
              </button>
            </div>
          </div>
          <p className="text-white/50 text-xs text-center">{info.note}</p>
          <button className="btn-primary" onClick={() => setStep("receipt")}>
            Я перевёл, прикрепить чек
          </button>
        </div>
      )}

      {step === "receipt" && (
        <div className="flex flex-col gap-4">
          <p className="text-white/60 text-sm">
            Прикрепите скриншот или фото чека об оплате
          </p>
          <label className="card flex flex-col items-center gap-3 py-8 cursor-pointer border-dashed border-2 border-white/20 active:opacity-70">
            <span className="text-4xl">{file ? "📎" : "📷"}</span>
            <span className="text-sm text-white/60">
              {file ? file.name : "Нажмите чтобы выбрать файл"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={!file || loading}
            onClick={handleSubmit}
          >
            {loading ? "Отправка..." : "Отправить на проверку"}
          </button>
        </div>
      )}
    </div>
  );
}
