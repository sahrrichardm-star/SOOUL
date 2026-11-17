import { ArrowUpRight, BookHeart, Flower2, ShieldCheck, Sparkles, Infinity } from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabase'

const pillars = [
  {
    icon: BookHeart,
    title: 'Stories',
    description: 'Preserve the moments, memories and lessons that make your life uniquely yours.',
  },
  {
    icon: Infinity,
    title: 'Legacy',
    description: 'Pass on the values, wishes and knowledge you want future generations to carry.',
  },
  {
    icon: ShieldCheck,
    title: 'Safekeeping',
    description: 'Keep what matters together, with privacy and control at the heart of the experience.',
  },
]

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? 'brand-art brand-art-large' : 'brand-art'} aria-hidden="true">
      <Flower2 strokeWidth={1.15} />
      <span className="brand-art-core" />
    </span>
  )
}

export default function App() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SOOUL home">
          <BrandMark />
          <span>SOOUL</span>
        </a>
        <span className="topbar-note">Your life. Your legacy.</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy-block">
          <div className="eyebrow"><Sparkles size={15} /> A LEGACY THAT LIVES ON</div>
          <h1 id="hero-title">Your life.<br /><span>Your legacy.</span></h1>
          <p className="hero-copy">
            A thoughtful place for the stories, memories, values and wishes
            you want to preserve — and pass on beyond generations.
          </p>
          <a className="primary-link" href="#meaning">
            Discover SOOUL <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="hero-artwork" aria-label="SOOUL flower and infinity emblem">
          <div className="art-orbit art-orbit-outer" />
          <div className="art-orbit art-orbit-inner" />
          <div className="art-glow" />
          <BrandMark large />
          <div className="art-wordmark">SOOUL</div>
          <div className="art-tagline">YOUR LIFE · YOUR LEGACY · BEYOND GENERATIONS</div>
          <div className="art-rule"><span /></div>
        </div>
        <div className="hero-bottom-note">A living legacy, shaped by you.</div>
      </section>

      <section className="pillars" id="meaning" aria-labelledby="pillars-heading">
        <div className="section-heading">
          <span className="eyebrow">BUILT AROUND WHAT MATTERS</span>
          <h2 id="pillars-heading">Some things deserve to outlast us.</h2>
          <p>SOOUL is being built to help you keep them close and pass them forward.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map(({ icon: Icon, title, description }, index) => (
            <article className="pillar-card" key={title}>
              <span className="pillar-index">0{index + 1}</span>
              <span className="pillar-icon"><Icon size={22} strokeWidth={1.7} /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <a className="footer-brand" href="/">SOOUL<span>®</span></a>
        <span>© {new Date().getFullYear()} SOOUL. A legacy beyond generations.</span>
        <span className="connection">
          <span className={isSupabaseConfigured ? 'status-dot online' : 'status-dot'} />
          {isSupabaseConfigured ? 'Secure connection configured' : 'Backend configuration pending'}
        </span>
      </footer>
    </main>
  )
}
