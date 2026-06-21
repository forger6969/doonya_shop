import { useState, useEffect, useRef } from "react";
import { Clock, Copy } from "lucide-react";
import { getTopupInfo, submitTopup } from "../api";

type Method = "card" | "uzcard" | "payme" | "atm";
type Step = "amount" | "method" | "requisites" | "receipt" | "done" | "expired";

interface TopupInfo {
  method: Method;
  requisites?: string;
  holder?: string;
  amount: number;
  note: string;
}

interface PendingSession {
  amount: string;
  method: Method;
  info: TopupInfo;
  expiresAt: number;
}

const SESSION_KEY = "topup_pending";
const TIMER_DURATION = 10 * 60; // 600 seconds

const METHODS: { id: Method; label: string; icon: string }[] = [
  { id: "card",   label: "Банковская карта", icon: "💳" },
  { id: "uzcard", label: "Uzcard",           icon: "🏦" },
  { id: "payme",  label: "Payme",            icon: "📱" },
  { id: "atm",    label: "Банкомат",         icon: "🏧" },
];

interface Props { onBack: () => void }

export default function TopupPage({ onBack }: Props) {
  const [step, setStep]     = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [info, setInfo]     = useState<TopupInfo | null>(null);
  const [file, setFile]     = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<number>(0);

  // Restore pending session on mount
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const s: PendingSession = JSON.parse(raw);
      const remaining = Math.floor((s.expiresAt - Date.now()) / 1000);
      if (remaining > 0) {
        setAmount(s.amount);
        setMethod(s.method);
        setInfo(s.info);
        setTimeLeft(remaining);
        setStep("requisites");
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // Countdown — only runs on requisites step
  useEffect(() => {
    if (step !== "requisites") return;
    intervalRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalRef.current);
          localStorage.removeItem(SESSION_KEY);
          setStep("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalRef.current);
  }, [step]);

  const handleAmountNext = () => {
    const n = parseInt(amount);
    if (!n || n < 550) { setError("Минимум 550 сум"); return; }
    setError("");
    setStep("method");
  };

  const handleMethod = async (m: Method) => {
    setMethod(m);
    setLoading(true);
    try {
      const data: TopupInfo = await getTopupInfo(parseInt(amount), m);
      setInfo(data);
      const expiresAt = Date.now() + TIMER_DURATION * 1000;
      setTimeLeft(TIMER_DURATION);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ amount, method: m, info: data, expiresAt } satisfies PendingSession));
      setStep("requisites");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file || !info || !method) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("amount", amount);
      fd.append("unique_amount", String(info.amount));
      fd.append("method", method);
      fd.append("receipt", file);
      await submitTopup(fd);
      window.clearInterval(intervalRef.current);
      localStorage.removeItem(SESSION_KEY);
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    window.Telegram?.WebApp?.showAlert("Скопировано!");
  };

  const startOver = () => {
    setStep("amount");
    setAmount("");
    setMethod(null);
    setInfo(null);
    setFile(null);
    setTimeLeft(0);
    localStorage.removeItem(SESSION_KEY);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const timerColor = timeLeft < 120 ? "text-red-400" : timeLeft < 300 ? "text-yellow-400" : "text-emerald-400";
  const timerBorder = timeLeft < 120 ? "border-red-400/20" : timeLeft < 300 ? "border-yellow-400/20" : "border-white/[0.07]";

  if (step === "done") return (
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

  if (step === "expired") return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="text-6xl">⏰</div>
      <div>
        <p className="text-xl font-bold text-red-400">Время вышло</p>
        <p className="text-white/50 mt-2 text-sm">
          Сессия оплаты истекла. Начните заново — сумма будет новой.
        </p>
      </div>
      <button className="btn-primary max-w-xs" onClick={startOver}>Начать заново</button>
    </div>
  );

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
          {/* Timer */}
          <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border ${timerBorder}`}>
            <Clock className={`w-4 h-4 ${timerColor}`} />
            <span className={`font-mono font-bold text-xl ${timerColor}`}>{fmt(timeLeft)}</span>
            <span className="text-white/35 text-sm">осталось</span>
          </div>

          <div className="card flex flex-col gap-3">
            {info.requisites && (
              <div className="flex justify-between items-center">
                <span className="text-white/50 text-sm">Реквизиты</span>
                <button
                  className="font-mono font-bold text-purple-300 active:opacity-70 flex items-center gap-1.5"
                  onClick={() => copy(info.requisites!)}
                >
                  {info.requisites}
                  <Copy className="w-3.5 h-3.5 opacity-50" />
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
                className="text-xl font-bold text-yellow-400 active:opacity-70 flex items-center gap-1.5"
                onClick={() => copy(String(info.amount))}
              >
                {info.amount.toLocaleString()} сум
                <Copy className="w-3.5 h-3.5 opacity-50" />
              </button>
            </div>
          </div>

          <p className="text-white/40 text-xs text-center">{info.note}</p>

          <button className="btn-primary" onClick={() => setStep("receipt")}>
            Я перевёл — прикрепить чек
          </button>
        </div>
      )}

      {step === "receipt" && (
        <div className="flex flex-col gap-4">
          <p className="text-white/60 text-sm">Прикрепите скриншот или фото чека об оплате</p>
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
