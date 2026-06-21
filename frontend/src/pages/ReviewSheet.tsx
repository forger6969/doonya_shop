import { useState, useRef } from "react";
import { Star, Camera, X, CheckCircle, Loader } from "lucide-react";
import { leaveReview, uploadReviewPhoto } from "../api";
import { useLang } from "../i18n";

interface Props {
  orderId: string;
  onClose: () => void;
}

export default function ReviewSheet({ orderId, onClose }: Props) {
  const { t } = useLang();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { url } = await uploadReviewPhoto(file);
      setPhotoUrl(url);
    } catch {
      setPhotoPreview("");
      window.Telegram?.WebApp?.showAlert("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    setPhotoUrl("");
    setPhotoPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      await leaveReview({ order_id: orderId, rating, text: text.trim(), photo_url: photoUrl });
      setDone(true);
      setTimeout(onClose, 2200);
    } catch (e: any) {
      const msg = e?.response?.data?.detail;
      if (msg === "Review already submitted") {
        window.Telegram?.WebApp?.showAlert("Вы уже оставили отзыв на этот заказ.");
        onClose();
      } else {
        window.Telegram?.WebApp?.showAlert(msg || "Ошибка. Попробуйте ещё раз.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const LABELS = ["", t.awful, t.bad, t.okay, t.good, t.excellent];
  const activeRating = hovered || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full rounded-t-3xl flex flex-col gap-5 p-5 pb-8"
        style={{ background: "#161720", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Drag handle */}
        <div className="w-9 h-1 rounded-full bg-white/10 mx-auto -mt-1" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-white">{t.thankYou}</p>
              <p className="text-white/40 text-sm mt-1">{t.helpedOthers}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-white">{t.leaveReview}</p>
                <p className="text-xs text-white/30 mt-0.5">{t.shareExperience}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center">
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>

            {/* Stars */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(0)}
                    className="active:scale-90 transition-transform"
                  >
                    <Star
                      className={`w-10 h-10 transition-colors ${
                        i <= activeRating ? "fill-yellow-400 text-yellow-400" : "text-white/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {activeRating > 0 && (
                <p className="text-sm font-bold text-yellow-400">{LABELS[activeRating]}</p>
              )}
            </div>

            {/* Text */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder="Расскажите о своём опыте (необязательно)..."
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3.5 py-3 text-sm text-white placeholder-white/20 outline-none resize-none focus:border-blue-500/30 transition-colors"
            />

            {/* Photo */}
            <div>
              {photoPreview ? (
                <div className="relative w-20 h-20">
                  <img
                    src={photoPreview}
                    className="w-full h-full object-cover rounded-xl"
                    alt="review photo"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                      <Loader className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {!uploading && (
                    <button
                      onClick={removePhoto}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white/50 border border-white/[0.08] bg-white/[0.03] active:opacity-70"
                >
                  <Camera className="w-4 h-4" /> {t.attachPhoto}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!rating || submitting || uploading}
              className="w-full py-3.5 rounded-xl font-black text-sm text-white disabled:opacity-30 active:opacity-70"
              style={{ background: rating ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "#1f2030" }}
            >
              {submitting ? t.sending : t.sendReview}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
