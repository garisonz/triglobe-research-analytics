import type { CSSProperties } from "react"
import { Link } from "react-router"
import { lenses } from "../content/lenses"
import { useHeroParallax } from "../hooks/useHeroParallax"
import {
  archivalImage,
  eyebrow,
  lensIcon,
  primaryButton,
  textLink,
} from "../lib/styles"
import { cn } from "../lib/utils"

type Annotation = {
  text: string
  x: string
  y: string
  rotation: number
  speed: number
  /** Where the note sits on phones; notes without one are hidden there. */
  phone?: { x: string; y: string }
  /** Hidden at tablet widths and below. */
  wideOnly?: boolean
}

// Fixed positions prevent layout changes between renders. Notes are decorative, not live data.
const annotations: Annotation[] = [
  {
    text: "48°N 2°E",
    x: "7%",
    y: "0%",
    rotation: -7,
    speed: 0.09,
    phone: { x: "0%", y: "-24%" },
  },
  {
    text: "GDP +2.1%",
    x: "79%",
    y: "3%",
    rotation: 6,
    speed: -0.025,
    wideOnly: true,
  },
  {
    text: "35°S",
    x: "2%",
    y: "55%",
    rotation: -5,
    speed: 0.045,
    phone: { x: "0%", y: "108%" },
  },
  {
    text: "Δ 0.4",
    x: "88%",
    y: "52%",
    rotation: 8,
    speed: 0.085,
    wideOnly: true,
  },
  {
    text: "UN–193",
    x: "29%",
    y: "96%",
    rotation: -4,
    speed: -0.025,
    phone: { x: "60%", y: "108%" },
  },
  {
    text: "10°E",
    x: "64%",
    y: "-8%",
    rotation: 5,
    speed: 0.065,
    wideOnly: true,
  },
  {
    text: "Q3",
    x: "17%",
    y: "94%",
    rotation: 7,
    speed: 0.035,
    phone: { x: "76%", y: "-24%" },
  },
  {
    text: "Vote 52–48",
    x: "73%",
    y: "97%",
    rotation: -8,
    speed: 0.09,
    wideOnly: true,
  },
  { text: "see also ↗", x: "4%", y: "28%", rotation: -6, speed: -0.035 },
  {
    text: "fig. 01",
    x: "90%",
    y: "82%",
    rotation: 5,
    speed: 0.04,
    wideOnly: true,
  },
]

// Balance the SVGs' different internal margins without changing the supplied artwork.
const iconWidths: Record<string, string> = {
  politics: "w-20",
  business: "w-26",
  nations: "w-24",
}

export default function LandingPage() {
  const hero = useHeroParallax()
  return (
    <>
      <section
        className="relative flex min-h-[calc(100svh_-_84px)] flex-col items-center pt-[22px] pb-[27px] max-tablet:min-h-auto max-tablet:pb-[30px] wide:justify-center"
        aria-labelledby="landing-title"
        ref={hero}
      >
        <div className="flex w-full justify-between gap-5 text-[15px] text-ink-muted max-phone:gap-2.5 max-phone:text-[13px] wide:absolute wide:top-[22px]">
          <span>Independent perspectives</span>
          <span>
            <i>Edition</i> No. 001 / 2026
          </span>
        </div>
        <p className="mt-8 mb-[51px] text-center text-[clamp(20px,2vw,28px)] max-tablet:mt-[35px] max-tablet:mb-[50px] max-phone:mt-[30px] max-phone:mb-[52px] max-phone:max-w-[250px] max-phone:text-[23px] max-phone:leading-[1.2]">
          Mapping the Forces That Shape the World.
        </p>
        <div className="relative h-[clamp(300px,34vw,490px)] w-full max-w-[1400px] max-tablet:h-[34vw] max-tablet:min-h-[235px] max-phone:h-[36vw] max-phone:min-h-0">
          <div
            className="relative z-1 translate-y-[var(--parallax-y,0px)]"
            data-parallax="0.035"
          >
            <h1
              id="landing-title"
              className="animate-headline-arrive text-center text-[clamp(88px,18.2vw,270px)] leading-[0.85] tracking-[-0.045em] text-brand max-tablet:text-[18vw] max-phone:text-[18.5vw] max-phone:leading-[0.93]"
            >
              <span className="block">TRIGLOBE</span>
              <span className="block">ANALYTICS</span>
            </h1>
          </div>
          {/* The transparent globe overlaps the type. Replacement specifications live in public/images/README.md. */}
          <div
            className="pointer-events-none absolute top-[45%] left-1/2 z-3 w-[36%] max-w-[480px] -translate-x-1/2 translate-y-[calc(-50%_+_var(--parallax-y,0px))] -rotate-8 max-phone:top-[44%] max-phone:w-[40%]"
            data-parallax="0.13"
          >
            <img
              className={cn(
                "h-auto w-full animate-collage-arrive",
                archivalImage
              )}
              src="/images/archive/editorial-v1/hero-globe.png"
              alt="Vintage globe wrapped in a folded newspaper and tied with string"
              width="1200"
              height="1400"
              fetchPriority="high"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-4"
            aria-hidden="true"
          >
            {annotations.map((note, index) => (
              <span
                key={note.text}
                className={cn(
                  "absolute top-(--y) left-(--x) translate-y-[var(--parallax-y,0px)] rotate-(--rotation) font-hand text-[28px] leading-none whitespace-nowrap text-pencil max-tablet:text-[25px] max-phone:text-[24px]",
                  note.wideOnly && "max-tablet:hidden",
                  note.phone
                    ? "max-phone:top-(--phone-y) max-phone:left-(--phone-x)"
                    : "max-phone:hidden"
                )}
                data-parallax={note.speed}
                style={
                  {
                    "--x": note.x,
                    "--y": note.y,
                    "--phone-x": note.phone?.x,
                    "--phone-y": note.phone?.y,
                    "--rotation": `${note.rotation}deg`,
                    "--note-delay": `${0.7 + index * 0.085}s`,
                  } as CSSProperties
                }
              >
                <span className="block animate-note-arrive">{note.text}</span>
              </span>
            ))}
          </div>
        </div>
        <p className="z-5 mt-[35px] mb-2 text-center text-[clamp(18px,1.7vw,24px)] leading-normal max-tablet:mt-[42px] max-tablet:max-w-[440px] max-phone:mt-[54px] max-phone:text-[19px]">
          Politics · Business · Nations{" "}
          <span className="max-tablet:hidden">—</span>{" "}
          <span className="max-tablet:block">
            <i>independent research & social platform</i>.
          </span>
        </p>
        <Link
          className={cn(primaryButton, "relative z-5 mt-6 mb-[22px]")}
          to="/home"
        >
          Enter workspace <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section
        className="border-t border-line pt-[75px] pb-20 max-tablet:py-12"
        id="lenses"
        aria-labelledby="lenses-title"
      >
        <div className="mb-[43px] max-phone:mb-7">
          <p className={eyebrow}>01 / Our field of view</p>
          <h2
            id="lenses-title"
            className="text-[clamp(44px,5vw,68px)] leading-[1.05] tracking-[-1.6px]"
          >
            Three <i>Lenses.</i>
          </h2>
          <p className="mt-4 text-[21px] leading-normal text-ink-muted">
            One world. More than one way to see it.
          </p>
        </div>
        <div className="grid grid-cols-3 max-tablet:grid-cols-1">
          {lenses.map((lens) => (
            <article
              className="border-l border-line px-[35px] pb-3 first:border-l-0 first:pl-0 last:pr-0 max-laptop:px-6 max-tablet:border-0 max-tablet:border-t max-tablet:px-0 max-tablet:py-[27px]"
              id={lens.id}
              key={lens.id}
            >
              <div className="mb-[22px] flex min-h-26 items-center justify-between gap-5">
                <span className="text-[17px] text-ink-muted italic">
                  ({lens.number})
                </span>
                <img
                  className={cn(lensIcon, archivalImage, iconWidths[lens.id])}
                  src={lens.image}
                  alt={lens.alt}
                  width="96"
                  height="96"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <h3 className="mb-[17px] text-[42px] leading-[1.1] max-phone:text-[38px]">
                {lens.title}
              </h3>
              <p className="mb-6 max-w-[33ch] text-[22px] leading-[1.45] text-ink-muted max-tablet:max-w-[38ch] max-phone:text-[21px]">
                {lens.copy}
              </p>
              <Link className={textLink} to={`/${lens.id}`}>
                Explore {lens.title} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <aside className="pt-[50px] pb-[95px] text-center">
        <h2 className="mt-[18px] mb-5 text-[clamp(37px,4.5vw,62px)] leading-[1.12] tracking-[-1px]">
          The world is connected.
          <br />
          <i>Your thinking can be, too.</i>
        </h2>
        <Link className={textLink} to="/sign-up">
          Create a free account <span aria-hidden="true">→</span>
        </Link>
      </aside>
    </>
  )
}
