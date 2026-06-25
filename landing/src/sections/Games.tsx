import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const GAMES = [
  {
    icon: '💎',
    name: 'MOBILE LEGENDS',
    sub: 'Bang Bang',
    currency: 'Diamonds — барча пакетлар',
    tag: '⚡ Eng mashhur',
    tagColor: 'text-green-400 bg-green-500/10 border-green-500/20',
    glow: 'hover:shadow-[0_20px_60px_rgba(34,197,94,0.15)]',
    accent: 'from-green-500 to-emerald-700',
  },
  {
    icon: '🎯',
    name: 'PUBG MOBILE',
    sub: 'PlayerUnknown',
    currency: 'UC — barcha miqdorlar',
    tag: '🔥 Aktiv',
    tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    glow: 'hover:shadow-[0_20px_60px_rgba(249,115,22,0.15)]',
    accent: 'from-orange-500 to-red-700',
  },
  {
    icon: '🔥',
    name: 'FREE FIRE',
    sub: 'Garena',
    currency: 'Diamonds — ID orqali',
    tag: '✅ Tez yetkazish',
    tagColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    glow: 'hover:shadow-[0_20px_60px_rgba(234,179,8,0.15)]',
    accent: 'from-yellow-500 to-orange-600',
  },
  {
    icon: '🟥',
    name: 'ROBLOX',
    sub: 'Corporation',
    currency: 'Robux — barcha paketlar',
    tag: '🎮 Yangi',
    tagColor: 'text-red-400 bg-red-500/10 border-red-500/20',
    glow: 'hover:shadow-[0_20px_60px_rgba(220,38,38,0.15)]',
    accent: 'from-red-500 to-red-800',
  },
]

export default function Games() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="games" className="relative py-28 px-6 md:px-20 overflow-hidden">
      {/* bg accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
      </div>

      <div ref={ref} className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <span className="text-xs font-bold tracking-[4px] uppercase text-green-400">Xizmatlar</span>
          <h2 className="font-bebas text-5xl md:text-7xl tracking-widest mt-2">
            Qaysi <span className="bg-gradient-to-r from-green-400 to-yellow-400 bg-clip-text text-transparent">o'yinlar</span> uchun?
          </h2>
          <p className="text-slate-400 text-lg mt-3 max-w-lg">
            Eng mashhur mobil o'yinlar uchun tez va xavfsiz donat.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {GAMES.map((g, i) => (
            <motion.div
              key={g.name}
              initial={{ opacity: 0, y: 40, rotateY: -15 }}
              animate={inView ? { opacity: 1, y: 0, rotateY: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className={`relative group bg-[#0d0d1a] border border-white/5 rounded-2xl p-6 cursor-default transition-all duration-300 ${g.glow} overflow-hidden`}
            >
              {/* Top gradient bar */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${g.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              {/* Inner glow on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(34,197,94,0.06) 0%, transparent 70%)' }} />

              <div className="text-5xl mb-5 float">{g.icon}</div>

              <div className="font-bebas text-2xl tracking-wider text-white">{g.name}</div>
              <div className="text-slate-600 text-xs mt-0.5 font-medium">{g.sub}</div>
              <div className="text-slate-400 text-sm mt-3">{g.currency}</div>

              <span className={`inline-block mt-4 px-3 py-1 rounded-full border text-xs font-bold ${g.tagColor}`}>
                {g.tag}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
