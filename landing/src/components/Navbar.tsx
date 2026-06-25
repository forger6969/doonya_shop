import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TG_URL = 'https://t.me/doonya_games_shop_bot'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300 ${
          scrolled
            ? 'bg-[#06060e]/90 backdrop-blur-xl border-b border-green-500/10'
            : 'bg-transparent'
        }`}
      >
        {/* Logo */}
        <a href="#" className="font-bebas text-2xl tracking-widest bg-gradient-to-r from-green-400 to-yellow-400 bg-clip-text text-transparent">
          DOONYA SHOP
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          {['O\'yinlar', 'Qanday ishlaydi', 'Nega biz'].map((l, i) => (
            <a
              key={i}
              href={`#${['games','how','why'][i]}`}
              className="hover:text-green-400 transition-colors"
            >
              {l}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <motion.a
            href={TG_URL}
            target="_blank"
            rel="noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold text-sm rounded-full transition-colors shadow-lg shadow-green-500/30"
          >
            <TgIcon />
            Botni ochish
          </motion.a>

          {/* Burger mobile */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="md:hidden flex flex-col gap-1.5 p-1"
          >
            <span className={`block w-6 h-0.5 bg-white transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 inset-x-0 z-40 bg-[#0d0d1a]/95 backdrop-blur-xl border-b border-green-500/10 flex flex-col p-6 gap-4 md:hidden"
          >
            {['O\'yinlar', 'Qanday ishlaydi', 'Nega biz'].map((l, i) => (
              <a
                key={i}
                href={`#${['games','how','why'][i]}`}
                onClick={() => setMenuOpen(false)}
                className="text-lg font-semibold text-slate-300 hover:text-green-400 transition-colors py-2 border-b border-white/5"
              >
                {l}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function TgIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.01 9.47c-.147.658-.537.818-1.084.508l-3-2.21-1.447 1.393c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.42 14.367l-2.96-.924c-.643-.204-.657-.643.136-.953l11.54-4.448c.538-.194 1.009.131.826.205z"/>
    </svg>
  )
}
