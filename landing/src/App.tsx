import './index.css'
import Navbar from './components/Navbar'
import Hero from './sections/Hero'
import AnimeHero from './sections/AnimeHero'
import Games from './sections/Games'
import HowItWorks from './sections/HowItWorks'
import WhyUs from './sections/WhyUs'
import CTA from './sections/CTA'

export default function App() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <AnimeHero />
      <Games />
      <HowItWorks />
      <WhyUs />
      <CTA />

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 md:px-20 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-sm">
        <span className="font-bebas text-xl tracking-widest bg-gradient-to-r from-green-400 to-yellow-400 bg-clip-text text-transparent">
          DOONYA SHOP
        </span>
        <span>© 2024 Doonya Shop. Barcha huquqlar himoyalangan.</span>
        <a
          href="https://t.me/doonya_games_shop_bot"
          target="_blank"
          rel="noreferrer"
          className="text-green-400 hover:text-green-300 font-semibold transition-colors"
        >
          @doonya_games_shop_bot
        </a>
      </footer>
    </div>
  )
}
