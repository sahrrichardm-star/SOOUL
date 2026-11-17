import { ArrowUpRight, BookHeart, Flower2, ShieldCheck, Sparkles } from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabase'

const pillars = [
  {
    icon: BookHeart,
    title: 'Stories',
    description: 'Capture the moments, lessons and experiences that make a life meaningful.',
  },
  {
    icon: Flower2,
    title: 'Legacy',
    description: 'Bring important wishes, values and personal records together in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'Safekeeping',
    description: 'Build on a secure foundation with clear control over your information.',
  },
]

export default function App() {
  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="SOOUL home">
          <span className="brand-mark"><Flower2 size={22} strokeWidth={1.7} /></span>
          <span>SOOUL</span>
        </a>
        <span className="topbar-note">A living legacy</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><Sparkles size={15} /> YOUR STORY. YOUR LEGACY.</div>
        <h1>Keep what matters.<br /><span>Pass on what lasts.</span></h1>
        <p className="hero-copy">
          A thoughtful home for your stories, memories, values and the things
          you want future generations to know.
        </p>
        <a className="primary-link" href="#begin">
          Explore SOOUL <ArrowUpRight size={17} />
        </a>
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-flower"><Flower2 size={150} strokeWidth={0.8} /></div>
      </section>

      <section className="pillars" id="begin" aria-labelledby="pillars-heading">
        <div className="section-heading">
          <span className="eyebrow">BUILT AROUND WHAT MATTERS</span>
          <h2 id="pillars-heading">A legacy is more than a record.</h2>
          <p>It is the knowledge, care and memories we choose to preserve.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map(({ icon: Icon, title, description }) => (
            <article className="pillar-card" key={title}>
              <span className="pillar-icon"><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} SOOUL</span>
        <span className="connection">
          <span className={isSupabaseConfigured ? 'status-dot online' : 'status-dot'} />
          {isSupabaseConfigured ? 'Backend configuration detected' : 'Backend setup pending'}
        </span>
      </footer>
    </main>
  )
}
