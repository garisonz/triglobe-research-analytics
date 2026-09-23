import { ArrowDown, ArrowUpRight } from "lucide-react"
import { Link } from "react-router"

const perspectives = [
  {
    number: "01",
    title: "Politics",
    copy: "Look beyond the headlines. Explore the policies and decisions shaping our world.",
  },
  {
    number: "02",
    title: "Business",
    copy: "Put companies in context. Connect business performance with the bigger picture.",
  },
  {
    number: "03",
    title: "Nations",
    copy: "Take a wider view. Understand economies, countries, and the connections between them.",
  },
]

export default function LandingPage() {
  return (
    <>
      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="eyebrow">
          <span className="status-dot" /> A broader perspective
        </p>
        <h1 id="landing-title">
          A connected world.
          <br />
          <em>A clearer view.</em>
        </h1>
        <p className="hero-copy">
          A simple place to explore politics, business, and nations.
          <br className="desktop-break" /> Start with curiosity. Build your
          perspective.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/home">
            Start exploring <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <a className="text-link" href="#perspectives">
            Discover our focus <ArrowDown size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="hero-note">
          <span className="note-line" /> Three perspectives. One bigger picture.
        </div>
      </section>
      <section
        id="perspectives"
        className="perspectives"
        aria-labelledby="perspectives-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Our focus</p>
          <h2 id="perspectives-title">Everything is connected.</h2>
        </div>
        <div className="perspective-grid">
          {perspectives.map(({ number, title, copy }) => (
            <article className="perspective" key={title}>
              <span className="item-number">{number} /</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
