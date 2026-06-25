import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

// This section shows the anime generated image prominently
// Drop hero-anime.png into /public/ and it auto-renders
// Falls back to animated placeholder if no image yet

export default function AnimeHero() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section ref={ref} className="relative py-20 px-6 md:px-20 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden border border-green-500/10 bg-[#0d0d1a]"
          style={{ minHeight: 420 }}>

          {/* Grid overlay */}
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div className="scanline" />

          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full bg-green-500/10 blur-[100px]" />
            <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-yellow-500/6 blur-[80px]" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 p-8 md:p-14">
            {/* Left: text */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.7 }}
              className="flex-1"
            >
              <span className="text-xs font-bold tracking-[4px] uppercase text-green-400">Anime style</span>
              <h2 className="font-bebas text-5xl md:text-6xl tracking-widest mt-2 leading-none">
                O'yin <span className="bg-gradient-to-r from-green-400 to-yellow-400 bg-clip-text text-transparent">dunyosi</span>
                <br/>biz bilan
              </h2>
              <p className="text-slate-400 text-base mt-4 max-w-md leading-relaxed">
                Kuchli qahramonlar kabi o'yin maydonida hech qachon resurssiz qolmang.
                Doonya Shop — sizning strategik ittifoqchingiz.
              </p>

              {/* Character badges */}
              <div className="flex flex-wrap gap-3 mt-6">
                {[
                  { emoji: '⚔️', name: 'Luffy style' },
                  { emoji: '🗡️', name: 'Zoro power' },
                  { emoji: '🍊', name: 'Nami speed' },
                ].map(c => (
                  <motion.div
                    key={c.name}
                    whileHover={{ scale: 1.08 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/20 bg-green-500/5 text-sm text-slate-300"
                  >
                    <span>{c.emoji}</span>
                    <span>{c.name}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right: anime image or placeholder */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, rotateY: 20 }}
              animate={inView ? { opacity: 1, scale: 1, rotateY: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative flex-shrink-0 float"
              style={{ width: 320, maxWidth: '100%' }}
            >
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-2xl bg-green-500/10 blur-2xl scale-110 glow-pulse" />

              <img
                src="/hero-anime.png"
                alt="Doonya Shop anime character"
                className="relative z-10 w-full rounded-2xl"
                onError={(e) => {
                  const el = e.currentTarget
                  el.style.display = 'none'
                  const fb = document.getElementById('anime-fallback')
                  if (fb) fb.style.display = 'flex'
                }}
              />

              {/* Fallback placeholder */}
              <div
                id="anime-fallback"
                className="relative z-10 w-full aspect-[3/4] rounded-2xl bg-[#111827] border border-green-500/10 flex-col items-center justify-center gap-4 text-center p-6"
                style={{ display: 'none' }}
              >
                <div className="text-6xl float">⚡</div>
                <div className="font-bebas text-2xl tracking-wider text-green-400">СКОРО</div>
                <div className="text-slate-500 text-xs">Аниме-арт будет здесь</div>
                <div className="mt-2 text-xs text-slate-600 font-mono">
                  → hero-anime.png файлини<br/>
                  /public/ papkasiga qo'ying
                </div>
              </div>

              {/* Floating stat badges */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-4 -left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0d0d1a] border border-green-500/30 text-sm font-semibold text-green-400 shadow-lg"
              >
                <span>💎</span> ML Diamonds
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, delay: 1.5, repeat: Infinity }}
                className="absolute -bottom-4 -right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0d0d1a] border border-yellow-500/30 text-sm font-semibold text-yellow-400 shadow-lg"
              >
                <span>⚡</span> ~3 min
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
