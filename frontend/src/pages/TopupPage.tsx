import { useState, useEffect, useRef } from "react";
import { Clock, Copy } from "lucide-react";
import { getTopupInfo, submitTopup } from "../api";

type Method = "uzcard" | "visa" | "atm";
type Step = "amount" | "method" | "requisites" | "receipt" | "done" | "expired";

interface CardInfo { requisites: string; holder: string; type: string }

interface TopupInfo {
  method: Method;
  requisites?: string;
  holder?: string;
  cards?: CardInfo[];
  amount: number;
  note: string;
}

interface PendingSession {
  v: number;
  amount: string;
  method: Method;
  info: TopupInfo;
  expiresAt: number;
}

const SESSION_KEY = "topup_pending";
const SESSION_VERSION = 2;
const TIMER_DURATION = 10 * 60;

const METHODS: { id: Method; label: string; icon: string }[] = [
  { id: "uzcard", label: "Uzcard",  icon: "🏦" },
  { id: "visa",   label: "Visa",    icon: "💠" },
  { id: "atm",    label: "Банкомат", icon: "🏧" },
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
  const [agreed, setAgreed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<number>(0);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const s: PendingSession = JSON.parse(raw);
      if (!s.v || s.v < SESSION_VERSION) { localStorage.removeItem(SESSION_KEY); return; }
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
      localStorage.setItem(SESSION_KEY, JSON.stringify({ v: SESSION_VERSION, amount, method: m, info: data, expiresAt } satisfies PendingSession));
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
  const timerColor = timeLeft < 120 ? "#EF4444" : timeLeft < 300 ? "#EAB308" : "#10B981";
  const timerBorderColor = timeLeft < 120 ? "rgba(239,68,68,0.20)" : timeLeft < 300 ? "rgba(234,179,8,0.20)" : "rgba(255,255,255,0.07)";

  if (step === "done") return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="text-6xl">✅</div>
      <div>
        <p className="text-xl font-black text-white">Заявка отправлена!</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
          Мы проверим оплату и начислим баланс в течение нескольких минут.
        </p>
      </div>
      <button className="s-btn max-w-xs" onClick={onBack}>На главную</button>
    </div>
  );

  if (step === "expired") return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="text-6xl">⏰</div>
      <div>
        <p className="text-xl font-black text-red-400">Время вышло</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
          Сессия оплаты истекла. Начните заново — сумма будет новой.
        </p>
      </div>
      <button className="s-btn max-w-xs" onClick={startOver}>Начать заново</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <button
        className="flex items-center gap-2 text-sm active:opacity-70 w-fit"
        style={{ color: "var(--text-dim)" }}
        onClick={onBack}
      >
        ← Назад
      </button>
      <h2 className="text-xl font-black text-white">💰 Пополнение баланса</h2>

      {step === "amount" && (
        <div className="flex flex-col gap-4">
          <div
            className="flex flex-col gap-2 rounded-2xl p-5"
            style={{ background: "var(--bg-raised, #0D1020)", border: "1px solid var(--border, rgba(255,255,255,0.07))" }}
          >
            <label className="s-label">Сумма пополнения (сум)</label>
            <input
              type="number"
              className="bg-transparent text-3xl font-black outline-none placeholder:text-white/20 w-full text-white"
              placeholder="10 000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAmountNext()}
            />
          </div>

          {/* Legal disclaimer */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)" }}
          >
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
                Пополненные средства являются внутренним балансом магазина и{" "}
                <span className="font-semibold" style={{ color: "#EC4899" }}>не подлежат возврату</span>.
                Баланс нельзя вывести на карту или счёт — он используется
                исключительно для покупок в Doonya Shop.
                Перед пополнением убедитесь, что вы хотите приобрести товары в нашем магазине.
              </p>
            </div>

            <button
              onClick={() => setAgreed((v) => !v)}
              className="flex items-center gap-3 active:opacity-70"
            >
              <div
                className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors"
                style={{
                  background: agreed ? "#EC4899" : "transparent",
                  border: agreed ? "1.5px solid #EC4899" : "1.5px solid rgba(168,85,247,0.25)",
                }}
              >
                {agreed && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-[12px] text-left leading-snug" style={{ color: "var(--text-dim)" }}>
                Я понимаю, что средства не возвращаются и не выводятся
              </span>
            </button>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            className="s-btn"
            disabled={!agreed}
            onClick={handleAmountNext}
            style={!agreed ? { opacity: 0.35, cursor: "not-allowed", boxShadow: "none", background: "var(--bg-surface)" } : undefined}
          >
            Продолжить
          </button>
        </div>
      )}

      {step === "method" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>Выберите способ оплаты</p>
          {loading ? (
            <div className="flex justify-center py-6">
              <div
                className="w-8 h-8 rounded-full animate-spin"
                style={{ border: "2px solid rgba(236,72,153,0.15)", borderTopColor: "#EC4899" }}
              />
            </div>
          ) : (
            METHODS.map((m) => (
              <button
                key={m.id}
                className="text-left flex items-center gap-4 active:opacity-70 p-4 rounded-2xl"
                style={{
                  background: "var(--bg-raised, #0D1020)",
                  border: "1px solid var(--border, rgba(255,255,255,0.07))",
                }}
                onClick={() => handleMethod(m.id)}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="font-bold text-white">{m.label}</span>
                <span className="ml-auto" style={{ color: "var(--text-muted)" }}>›</span>
              </button>
            ))
          )}
        </div>
      )}

      {step === "requisites" && info && (
        <div className="flex flex-col gap-4">
          {/* Timer */}
          <div
            className="flex items-center justify-center gap-2 py-3 rounded-2xl"
            style={{
              background: "var(--bg-raised, #0D1020)",
              border: `1px solid ${timerBorderColor}`,
            }}
          >
            <Clock className="w-4 h-4" style={{ color: timerColor }} />
            <span className="font-mono font-black text-xl" style={{ color: timerColor }}>{fmt(timeLeft)}</span>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>осталось</span>
          </div>

          {info.cards ? (
            <div className="flex flex-col gap-3">
              {info.cards.map((c) => (
                <div
                  key={c.type}
                  className="flex flex-col gap-2 rounded-2xl p-4"
                  style={{ background: "var(--bg-raised, #0D1020)", border: "1px solid var(--border, rgba(255,255,255,0.07))" }}
                >
                  <p className="s-label">{c.type}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: "var(--text-dim)" }}>Карта</span>
                    <button
                      className="font-mono font-bold active:opacity-70 flex items-center gap-1.5"
                      style={{ color: "#A78BFA" }}
                      onClick={() => copy(c.requisites)}
                    >
                      {c.requisites}
                      <Copy className="w-3.5 h-3.5 opacity-50" />
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-dim)" }}>Получатель</span>
                    <span className="font-medium text-white">{c.holder}</span>
                  </div>
                </div>
              ))}
              <div
                className="flex justify-between items-center rounded-2xl p-4"
                style={{ background: "var(--bg-raised, #0D1020)", border: "1px solid var(--border, rgba(255,255,255,0.07))" }}
              >
                <span className="text-sm" style={{ color: "var(--text-dim)" }}>Сумма к переводу</span>
                <button
                  className="text-xl font-black active:opacity-70 flex items-center gap-1.5"
                  style={{ color: "#EC4899" }}
                  onClick={() => copy(String(info.amount))}
                >
                  {info.amount.toLocaleString()} сум
                  <Copy className="w-3.5 h-3.5 opacity-50" />
                </button>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col gap-3 rounded-2xl p-4"
              style={{ background: "var(--bg-raised, #0D1020)", border: "1px solid var(--border, rgba(255,255,255,0.07))" }}
            >
              {info.requisites && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: "var(--text-dim)" }}>Реквизиты</span>
                  <button
                    className="font-mono font-bold active:opacity-70 flex items-center gap-1.5"
                    style={{ color: "#A78BFA" }}
                    onClick={() => copy(info.requisites!)}
                  >
                    {info.requisites}
                    <Copy className="w-3.5 h-3.5 opacity-50" />
                  </button>
                </div>
              )}
              {info.holder && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "var(--text-dim)" }}>Получатель</span>
                  <span className="font-medium text-white">{info.holder}</span>
                </div>
              )}
              <div
                className="flex justify-between items-center pt-3 mt-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-sm" style={{ color: "var(--text-dim)" }}>Сумма к переводу</span>
                <button
                  className="text-xl font-black active:opacity-70 flex items-center gap-1.5"
                  style={{ color: "#EC4899" }}
                  onClick={() => copy(String(info.amount))}
                >
                  {info.amount.toLocaleString()} сум
                  <Copy className="w-3.5 h-3.5 opacity-50" />
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>{info.note}</p>

          <button className="s-btn" onClick={() => setStep("receipt")}>
            Я перевёл — прикрепить чек
          </button>
          <button
            onClick={startOver}
            className="w-full py-3 rounded-xl text-sm font-bold text-red-400 active:opacity-70"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}
          >
            Отменить пополнение
          </button>
        </div>
      )}

      {step === "receipt" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>Прикрепите скриншот или фото чека об оплате</p>
          <label
            className="flex flex-col items-center gap-3 py-8 cursor-pointer active:opacity-70 rounded-2xl"
            style={{
              background: file ? "rgba(236,72,153,0.05)" : "rgba(168,85,247,0.05)",
              border: `1.5px dashed ${file ? "rgba(236,72,153,0.45)" : "rgba(168,85,247,0.20)"}`,
              borderRadius: 16,
            }}
          >
            <span className="text-4xl">{file ? "📎" : "📷"}</span>
            <span className="text-sm" style={{ color: file ? "#EC4899" : "#A78BFA" }}>
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
            className="s-btn"
            disabled={!file || loading}
            onClick={handleSubmit}
            style={!file || loading ? { opacity: 0.35, boxShadow: "none", background: "var(--bg-surface)" } : undefined}
          >
            {loading ? "Отправка..." : "Отправить на проверку"}
          </button>
          <button
            onClick={startOver}
            className="w-full py-3 rounded-xl text-sm font-bold text-red-400 active:opacity-70"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}
          >
            Отменить пополнение
          </button>
        </div>
      )}
    </div>
  );
}
