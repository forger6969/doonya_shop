import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const STEPS = [
  {
    num: '01',
    icon: '🤖',
    title: 'Botni oching',
    desc: 'Telegram\'da @doonya_games_shop_bot\'ga o\'ting va kerakli o\'yinni tanlang.',
    color: 'from-green-500 to-emerald-600',
    glow: 'rgba(34,197,94,0.5)',
  },
  {
    num: '02',
    icon: '💳',
    title: 'To\'lov qiling',
    desc: 'Karta rekvizitlari yuboriladi — Payme yoki to\'g\'ridan-to\'g\'ri karta orqali to\'lang.',
    color: 'from-yellow-500 to-orange-500',
    glow: 'rgba(245,166,35,0.5)',
  },
  {
    num: '03',
    icon: '🎮',
    title: 'Oling va o\'ynang',
    desc: 'Chek yuborilgach 3–5 daqiqa ichida diamondlar hisobingizga tushadi.',
    color: 'from-red-500 to-pink-600',
    glow: 'rgba(220,38,38,0.5)',
  },
]

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      id="how"
      className="relative py-28 px-6 md:px-20 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #06060e 0%, #0d0d1a 50%, #06060e 100%)' }}
    >
      {/* Divider lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />

      <div ref={ref} className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-xs font-bold tracking-[4px] uppercase text-green-400">Jarayon</span>
          <h2 className="font-bebas text-5xl md:text-7xl tracking-widest mt-2">
            Qanday <span className="bg-gradient-to-r from-green-400 to-yellow-400 bg-clip-text text-transparent">ishlaydi?</span>
          </h2>
          <p className="text-slate-400 text-lg mt-3">Uchta oddiy qadam — va o'yiningizda to'liq balans.</p>
        </motion.div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Connector line (desktop) */}
          <div className="absolute hidden md:block top-16 left-[16%] right-[16%] h-px overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 1, delay: 0.5, ease: 'easeInOut' }}
              className="h-full origin-left bg-gradient-to-r from-green-500 via-yellow-400 to-red-500"
              style={{ opacity: 0.4 }}
            />
          </div>

          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.18 }}
              whileHover={{ y: -6 }}
              className="relative flex flex-col items-center text-center p-8 bg-[#111827] border border-white/5 rounded-2xl group"
            >
              {/* Step number circle */}
              <motion.div
                whileHover={{ scale: 1.1 }}
                className={`w-14 h-14 rounded-full flex items-center justify-center font-bebas text-2xl text-white mb-6 bg-gradient-to-br ${s.color} relative z-10`}
                style={{ boxShadow: `0 0 30px ${s.glow}` }}
              >
                {s.num}
              </motion.div>

              <div className="text-4xl mb-4 float-del">{s.icon}</div>

              <h3 className="font-bebas text-2xl tracking-wider text-white mb-3">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>

              {/* Bottom glow on hover */}
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, transparent, ${s.glow}, transparent)` }}
              />
            </motion.div>
          ))}
        </div>

        {/* CTA after steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex justify-center mt-14"
        >
          <motion.a
            href="https://t.me/doonya_games_shop_bot"
            target="_blank"
            rel="noreferrer"
            whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(34,197,94,0.5)' }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 px-8 py-4 bg-green-500 hover:bg-green-400 text-black font-bold text-lg rounded-full transition-colors shadow-[0_0_40px_rgba(34,197,94,0.35)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.01 9.47c-.147.658-.537.818-1.084.508l-3-2.21-1.447 1.393c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.42 14.367l-2.96-.924c-.643-.204-.657-.643.136-.953l11.54-4.448c.538-.194 1.009.131.826.205z"/>
            </svg>
            Hoziroq boshlash
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
