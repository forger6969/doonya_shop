import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const TG_URL = 'https://t.me/doonya_games_shop_bot'

const FLOATERS = ['💎', '⚡', '🎮', '🔥', '⭐', '🎯', '🟥', '💰']

export default function CTA() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Top line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/40 via-yellow-500/20 to-transparent" />

      {/* Glow bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-green-500/6 blur-[130px]" />
      </div>

      {/* Floating emoji */}
      {FLOATERS.map((e, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl select-none pointer-events-none"
          style={{
            left: `${8 + (i * 12) % 88}%`,
            top: `${10 + (i * 17) % 70}%`,
            opacity: 0.12,
          }}
          animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 4 + i * 0.5, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
        >
          {e}
        </motion.div>
      ))}

      <div ref={ref} className="max-w-3xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7 }}
        >
          <span className="text-xs font-bold tracking-[4px] uppercase text-green-400">Hoziroq boshlang</span>

          <h2 className="font-bebas tracking-widest mt-4 leading-none" style={{ fontSize: 'clamp(52px, 9vw, 96px)' }}>
            Donat qilishga
            <br />
            <span className="bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 bg-clip-text text-transparent">
              tayyormisiz?
            </span>
          </h2>

          <p className="text-slate-400 text-lg mt-5">
            Telegram botimizni oching va bir daqiqada buyurtma bering.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <motion.a
              href={TG_URL}
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.06, boxShadow: '0 0 80px rgba(34,197,94,0.6)' }}
              whileTap={{ scale: 0.97 }}
              className="gradient-border-anim flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-green-500 to-green-700 text-white font-bold text-xl rounded-full shadow-[0_0_50px_rgba(34,197,94,0.4)]"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.01 9.47c-.147.658-.537.818-1.084.508l-3-2.21-1.447 1.393c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.42 14.367l-2.96-.924c-.643-.204-.657-.643.136-.953l11.54-4.448c.538-.194 1.009.131.826.205z"/>
              </svg>
              Telegram'da ochish
            </motion.a>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap justify-center gap-6 mt-10 text-slate-500 text-sm"
          >
            {['✅ To\'lov xavfsiz', '⚡ 3-5 daqiqa yetkazish', '🔒 ID dan boshqa narsa so\'rmaymiz'].map(t => (
              <span key={t}>{t}</span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
