import { useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { gsap } from 'gsap'

const TG_URL = 'https://t.me/doonya_games_shop_bot'

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 4 + 2,
  delay: Math.random() * 5,
  dur: Math.random() * 4 + 3,
}))

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 600], [0, 120])
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0])

  // GSAP: staggered character animation on title
  useEffect(() => {
    if (!titleRef.current) return
    const chars = titleRef.current.querySelectorAll('.char')
    gsap.fromTo(chars,
      { y: 80, opacity: 0, rotateX: -90 },
      {
        y: 0, opacity: 1, rotateX: 0,
        duration: 0.7, stagger: 0.04, ease: 'back.out(1.5)',
        delay: 0.3,
      }
    )
  }, [])

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20"
    >
      {/* Animated grid bg */}
      <div className="grid-bg absolute inset-0 pointer-events-none" />

      {/* Radial glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-green-500/8 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-yellow-500/6 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/2 w-[300px] h-[300px] rounded-full bg-red-600/5 blur-[80px]" />
      </div>

      {/* Scanline */}
      <div className="scanline" style={{ zIndex: 1 }} />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-green-400"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: 0.3 }}
            animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <motion.div
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-semibold mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 glow-pulse" />
          Xizmat faol • 24/7
        </motion.div>

        {/* Main Title with GSAP chars */}
        <h1
          ref={titleRef}
          className="font-bebas tracking-widest leading-none mb-2"
          style={{ fontSize: 'clamp(72px, 14vw, 160px)', perspective: '800px' }}
        >
          {'DOONYA'.split('').map((c, i) => (
            <span key={i} className="char inline-block" style={{ opacity: 0 }}>{c}</span>
          ))}
        </h1>

        {/* SHOP with glitch */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="font-bebas tracking-[0.3em] text-4xl md:text-6xl mb-6"
        >
          <span
            className="glitch-wrap bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 bg-clip-text text-transparent"
            data-text="SHOP"
          >
            SHOP
          </span>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="text-slate-400 text-lg md:text-xl max-w-xl leading-relaxed mb-10"
        >
          Mobile Legends, PUBG, Free Fire va Roblox uchun
          <br />
          <span className="text-white font-semibold">eng tez va ishonchli</span> donat xizmati.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="flex flex-wrap gap-4 justify-center mb-14"
        >
          <motion.a
            href={TG_URL}
            target="_blank"
            rel="noreferrer"
            whileHover={{ scale: 1.06, boxShadow: '0 0 60px rgba(34,197,94,0.6)' }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-green-700 text-white font-bold text-lg rounded-full shadow-[0_0_40px_rgba(34,197,94,0.4)]"
          >
            <TgIcon />
            Telegram orqali buyurtma
          </motion.a>

          <motion.a
            href="#games"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-8 py-4 border border-green-500/40 text-green-400 font-semibold text-lg rounded-full hover:bg-green-500/10 transition-colors"
          >
            O'yinlarni ko'rish ↓
          </motion.a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.4 }}
          className="flex gap-10 md:gap-16"
        >
          {[
            { num: '500+', label: 'Buyurtma' },
            { num: '4',    label: 'O\'yin' },
            { num: '24/7', label: 'Ishlaydi' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="font-bebas text-4xl md:text-5xl text-green-400 tracking-wider">{s.num}</div>
              <div className="text-slate-500 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-600 text-xs"
      >
        <span>Pastga</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-0.5 h-8 bg-gradient-to-b from-green-500/60 to-transparent rounded-full"
        />
      </motion.div>
    </section>
  )
}

function TgIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.01 9.47c-.147.658-.537.818-1.084.508l-3-2.21-1.447 1.393c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.42 14.367l-2.96-.924c-.643-.204-.657-.643.136-.953l11.54-4.448c.538-.194 1.009.131.826.205z"/>
    </svg>
  )
}
