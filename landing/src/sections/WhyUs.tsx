import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import CountUp from 'react-countup'

const FEATURES = [
  { icon: '⚡', title: 'Tez yetkazish', desc: 'O\'rtacha 3–5 daqiqa. Kunning istalgan vaqtida.' },
  { icon: '🔒', title: 'Xavfsiz', desc: 'Faqat ID kerak — parol so\'rmaymiz. 100% xavfsiz.' },
  { icon: '💬', title: 'Jonli support', desc: 'Har qanday savol — bot ichidan yozing, tezda javob.' },
  { icon: '💰', title: 'Qulay narxlar', desc: 'Bozordagi eng qulay narxlar. Ko\'p miqdorda — chegirma.' },
  { icon: '📱', title: 'Faqat Telegram', desc: 'Alohida ilova yuklamasdan — Telegram ichida ishlaydi.' },
  { icon: '⭐', title: 'Ishonchli', desc: '500+ muvaffaqiyatli buyurtma. Minnatdor mijozlar.' },
]

const STATS = [
  { end: 500, suffix: '+', label: 'Buyurtma bajarildi' },
  { end: 4,   suffix: '',  label: 'O\'yin platformasi' },
  { end: 3,   suffix: ' min', label: 'O\'rtacha yetkazish' },
  { end: 100, suffix: '%', label: 'Muvaffaqiyat darajasi' },
]

export default function WhyUs() {
  const ref = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' })

  return (
    <section id="why" className="relative py-28 px-6 md:px-20 overflow-hidden">
      {/* bg glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-green-500/4 blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        {/* Stats strip */}
        <motion.div
          ref={statsRef}
          initial={{ opacity: 0, y: 30 }}
          animate={statsInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20 p-6 rounded-2xl border border-green-500/10 bg-[#0d0d1a]"
        >
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={statsInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center py-4"
            >
              <div className="font-bebas text-4xl md:text-5xl text-green-400 tracking-wider">
                {statsInView ? (
                  <CountUp end={s.end} duration={2} delay={i * 0.1} suffix={s.suffix} />
                ) : '0'}
              </div>
              <div className="text-slate-500 text-sm mt-1">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <span className="text-xs font-bold tracking-[4px] uppercase text-green-400">Afzalliklar</span>
          <h2 className="font-bebas text-5xl md:text-7xl tracking-widest mt-2">
            Nega <span className="bg-gradient-to-r from-green-400 to-yellow-400 bg-clip-text text-transparent">Doonya?</span>
          </h2>
        </motion.div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4, borderColor: 'rgba(34,197,94,0.3)' }}
              className="flex gap-4 p-6 bg-[#0d0d1a] border border-white/5 rounded-xl group transition-all duration-300"
            >
              <div className="text-3xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 float-slow">
                {f.icon}
              </div>
              <div>
                <div className="font-semibold text-white mb-1">{f.title}</div>
                <div className="text-slate-400 text-sm leading-relaxed">{f.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
