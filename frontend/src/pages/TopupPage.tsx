import { useState, useEffect, useRef } from "react";
import { Clock, Copy } from "lucide-react";
import { getTopupInfo, submitTopup } from "../api";
import { useLang } from "../i18n";

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
  { id: "atm",    label: "ATM", icon: "🏧" },
];

interface Props { onBack: () => void }

export default function TopupPage({ onBack }: Props) {
  const { t } = useLang();
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
    if (!n || n < 5000) { setError(t.topupMinError); return; }
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
    window.Telegram?.WebApp?.showAlert(t.copied);
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
        <p className="text-xl font-black text-white">{t.topupSent}</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>{t.topupSentBody}</p>
      </div>
      <button className="s-btn max-w-xs" onClick={onBack}>{t.toHome}</button>
    </div>
  );

  if (step === "expired") return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="text-6xl">⏰</div>
      <div>
        <p className="text-xl font-black text-red-400">{t.timeExpired}</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>{t.timeExpiredBody}</p>
      </div>
      <button className="s-btn max-w-xs" onClick={startOver}>{t.startOver}</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <button
        className="flex items-center gap-2 text-sm active:opacity-70 w-fit"
        style={{ color: "var(--text-dim)" }}
        onClick={onBack}
      >
        {t.back}
      </button>
      <h2 className="text-xl font-black text-white">💰 {t.topupTitle}</h2>

      {step === "amount" && (
        <div className="flex flex-col gap-4">
          <div
            className="flex flex-col gap-2 rounded-2xl p-5"
            style={{ background: "var(--bg-raised, #0D1020)", border: "1px solid var(--border, rgba(255,255,255,0.07))" }}
          >
            <label className="s-label">{t.topupAmountLabel}</label>
            <input
              type="number"
              className="bg-transparent text-3xl font-black outline-none placeholder:text-white/20 w-full text-white"
              placeholder="5 000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAmountNext()}
            />
            <p className="text-xs mt-1" style={{ color: "rgba(34,197,94,0.55)" }}>
              {t.topupMinError}
            </p>
          </div>

          {/* Legal disclaimer */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}
          >
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
                {t.legalDisclaimer}
              </p>
            </div>

            <button
              onClick={() => setAgreed((v) => !v)}
              className="flex items-center gap-3 active:opacity-70"
            >
              <div
                className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors"
                style={{
                  background: agreed ? "#22c55e" : "transparent",
                  border: agreed ? "1.5px solid #22c55e" : "1.5px solid rgba(34,197,94,0.25)",
                }}
              >
                {agreed && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-[12px] text-left leading-snug" style={{ color: "var(--text-dim)" }}>
                {t.iUnderstandNoRefund}
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
            {t.continueBtn}
          </button>
        </div>
      )}

      {step === "method" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>{t.choosePayMethod}</p>
          {loading ? (
            <div className="flex justify-center py-6">
              <div
                className="w-8 h-8 rounded-full animate-spin"
                style={{ border: "2px solid rgba(34,197,94,0.15)", borderTopColor: "#22c55e" }}
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
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{t.timeLeftLabel}</span>
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
                    <span className="text-sm" style={{ color: "var(--text-dim)" }}>{t.cardLabel}</span>
                    <button
                      className="font-mono font-bold active:opacity-70 flex items-center gap-1.5"
                      style={{ color: "#22c55e" }}
                      onClick={() => copy(c.requisites)}
                    >
                      {c.requisites}
                      <Copy className="w-3.5 h-3.5 opacity-50" />
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--text-dim)" }}>{t.recipientLabel}</span>
                    <span className="font-medium text-white">{c.holder}</span>
                  </div>
                </div>
              ))}
              <div
                className="flex justify-between items-center rounded-2xl p-4"
                style={{ background: "var(--bg-raised, #0D1020)", border: "1px solid var(--border, rgba(255,255,255,0.07))" }}
              >
                <span className="text-sm" style={{ color: "var(--text-dim)" }}>{t.amountToTransfer}</span>
                <button
                  className="text-xl font-black active:opacity-70 flex items-center gap-1.5"
                  style={{ color: "#22c55e" }}
                  onClick={() => copy(String(info.amount))}
                >
                  {info.amount.toLocaleString()} {t.sumLabel}
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
                  <span className="text-sm" style={{ color: "var(--text-dim)" }}>{t.requisites}</span>
                  <button
                    className="font-mono font-bold active:opacity-70 flex items-center gap-1.5"
                    style={{ color: "#22c55e" }}
                    onClick={() => copy(info.requisites!)}
                  >
                    {info.requisites}
                    <Copy className="w-3.5 h-3.5 opacity-50" />
                  </button>
                </div>
              )}
              {info.holder && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "var(--text-dim)" }}>{t.recipientLabel}</span>
                  <span className="font-medium text-white">{info.holder}</span>
                </div>
              )}
              <div
                className="flex justify-between items-center pt-3 mt-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-sm" style={{ color: "var(--text-dim)" }}>{t.amountToTransfer}</span>
                <button
                  className="text-xl font-black active:opacity-70 flex items-center gap-1.5"
                  style={{ color: "#22c55e" }}
                  onClick={() => copy(String(info.amount))}
                >
                  {info.amount.toLocaleString()} {t.sumLabel}
                  <Copy className="w-3.5 h-3.5 opacity-50" />
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>{info.note}</p>

          <button className="s-btn" onClick={() => setStep("receipt")}>
            {t.iTransferred}
          </button>
          <button
            onClick={startOver}
            className="w-full py-3 rounded-xl text-sm font-bold text-red-400 active:opacity-70"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}
          >
            {t.cancelTopup}
          </button>
        </div>
      )}

      {step === "receipt" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>{t.attachReceiptHint}</p>
          <label
            className="flex flex-col items-center gap-3 py-8 cursor-pointer active:opacity-70 rounded-2xl"
            style={{
              background: file ? "rgba(34,197,94,0.05)" : "rgba(34,197,94,0.05)",
              border: `1.5px dashed ${file ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.20)"}`,
              borderRadius: 16,
            }}
          >
            <span className="text-4xl">{file ? "📎" : "📷"}</span>
            <span className="text-sm" style={{ color: file ? "#22c55e" : "#22c55e" }}>
              {file ? file.name : t.selectFile}
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
            {loading ? t.sending : t.submitForReview}
          </button>
          <button
            onClick={startOver}
            className="w-full py-3 rounded-xl text-sm font-bold text-red-400 active:opacity-70"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}
          >
            {t.cancelTopup}
          </button>
        </div>
      )}
    </div>
  );
}
