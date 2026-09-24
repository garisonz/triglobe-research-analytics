import type { CSSProperties } from "react"
import { Link } from "react-router"
import { useHeroParallax } from "../hooks/useHeroParallax"
import { illustrationPath } from "../lib/illustrations"

const lenses = [
  {
    id: "politics",
    number: "01",
    title: "Politics",
    image: "politics.png",
    alt: "Illustration of a classical government building",
    copy: "Power leaves a paper trail. We follow the policies, institutions, and decisions that shape what comes next.",
  },
  {
    id: "business",
    number: "02",
    title: "Business",
    image: "business.png",
    alt: "Balance scales representing business and trade",
    copy: "No company exists in isolation. We place markets and enterprise within the wider currents of the world.",
  },
  {
    id: "nations",
    number: "03",
    title: "Nations",
    image: "nations.png",
    alt: "Compass illustration",
    copy: "Borders tell only part of the story. We explore the economies, histories, and relationships that connect us.",
  },
]

// Fixed positions prevent layout changes between renders. Notes are decorative, not live data.
const annotations = [
  { text: "48°N 2°E", x: "7%", y: "0%", rotation: -7, speed: 0.09 },
  { text: "GDP +2.1%", x: "79%", y: "3%", rotation: 6, speed: -0.025 },
  { text: "35°S", x: "2%", y: "55%", rotation: -5, speed: 0.045 },
  { text: "Δ 0.4", x: "88%", y: "52%", rotation: 8, speed: 0.085 },
  { text: "UN–193", x: "29%", y: "96%", rotation: -4, speed: -0.025 },
  { text: "10°E", x: "64%", y: "-8%", rotation: 5, speed: 0.065 },
  { text: "Q3", x: "17%", y: "94%", rotation: 7, speed: 0.035 },
  { text: "Vote 52–48", x: "73%", y: "97%", rotation: -8, speed: 0.09 },
  { text: "see also ↗", x: "4%", y: "28%", rotation: -6, speed: -0.035 },
  { text: "fig. 01", x: "90%", y: "82%", rotation: 5, speed: 0.04 },
]

export default function LandingPage() {
  const hero = useHeroParallax()
  return (
    <>
      <section
        className="landing-hero"
        aria-labelledby="landing-title"
        ref={hero}
      >
        <div className="edition-line">
          <span>Independent perspectives</span>
          <span>
            <i>Edition</i> No. 001 / 2026
          </span>
        </div>
        <p className="hero-tagline">Mapping the Forces That Shape the World.</p>
        <div className="hero-assembly">
          <div className="headline-layer" data-parallax="0.035">
            <h1 id="landing-title" className="hero-headline">
              <span>TRIGLOBE</span>
              <span>ANALYTICS</span>
            </h1>
          </div>
          {/* Transparent cutouts overlap the type. Replacement specifications live in public/images/README.md. */}
          <div className="collage-layer hero-globe" data-parallax="0.13">
            <img
              src={illustrationPath("hero-globe.png", "original")}
              alt="Vintage globe wrapped in a folded newspaper and tied with string"
              width="1200"
              height="1400"
              fetchPriority="high"
            />
          </div>
          <div className="hero-annotations" aria-hidden="true">
            {annotations.map((note, index) => (
              <span
                key={note.text}
                className="hero-annotation"
                data-parallax={note.speed}
                style={
                  {
                    left: note.x,
                    top: note.y,
                    "--rotation": `${note.rotation}deg`,
                    "--note-delay": `${0.7 + index * 0.085}s`,
                  } as CSSProperties
                }
              >
                <span>{note.text}</span>
              </span>
            ))}
          </div>
        </div>
        <p className="hero-byline">
          Politics · Business · Nations{" "}
          <span className="byline-divider">—</span>{" "}
          <span>
            <i>independent research & social platform</i>.
          </span>
        </p>
        <Link className="button button-primary hero-entry" to="/home">
          Enter workspace <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section
        className="lenses-section"
        id="lenses"
        aria-labelledby="lenses-title"
      >
        <div className="section-heading">
          <p className="eyebrow">01 / Our field of view</p>
          <h2 id="lenses-title">
            Three <i>Lenses.</i>
          </h2>
          <p className="section-description">
            One world. More than one way to see it.
          </p>
        </div>
        <div className="lens-grid">
          {lenses.map((lens) => (
            <article className="lens" id={lens.id} key={lens.id}>
              <div className="lens-masthead">
                <span className="item-number">({lens.number})</span>
                <img
                  src={illustrationPath(lens.image)}
                  alt={lens.alt}
                  width="480"
                  height="480"
                  loading="lazy"
                />
              </div>
              <h3>{lens.title}</h3>
              <p>{lens.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="editorial-invitation">
        <p className="handwritten">Stay curious.</p>
        <h2>
          The world is connected.
          <br />
          <i>Your thinking can be, too.</i>
        </h2>
        <Link className="text-link" to="/sign-up">
          Create a free account <span aria-hidden="true">→</span>
        </Link>
      </aside>
    </>
  )
}
