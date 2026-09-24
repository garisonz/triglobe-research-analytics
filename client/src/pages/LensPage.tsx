import { Link } from "react-router"
import { lenses } from "../content/lenses"
import type { Lens } from "../content/lenses"
import {
  archivalImage,
  eyebrow,
  introCopy,
  lensIcon,
  textLink,
} from "../lib/styles"
import { cn } from "../lib/utils"

// The landing page's balanced icon sizes, enlarged for the page header.
const iconWidths: Record<string, string> = {
  politics: "w-[125px] max-tablet:w-20",
  business: "w-[162px] max-tablet:w-26",
  nations: "w-[150px] max-tablet:w-24",
}

export default function LensPage({ lens }: { lens: Lens }) {
  const otherLenses = lenses.filter((other) => other.id !== lens.id)
  return (
    <article
      className="pt-[75px] pb-[90px] max-tablet:pt-[50px] max-tablet:pb-[65px]"
      aria-labelledby="lens-title"
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-10 border-b border-line pb-12 max-tablet:gap-6 max-tablet:pb-8 max-phone:grid-cols-1">
        <div>
          <p className={eyebrow}>
            Lens {lens.number} / {String(lenses.length).padStart(2, "0")}
          </p>
          <h1
            id="lens-title"
            className="mt-[15px] mb-6 text-[clamp(64px,10vw,150px)] leading-[0.95] tracking-[-0.04em] text-brand"
          >
            {lens.title}
          </h1>
          <p className={cn(introCopy, "max-w-[36ch]")}>{lens.copy}</p>
        </div>
        <img
          className={cn(
            lensIcon,
            archivalImage,
            iconWidths[lens.id],
            "max-phone:row-1"
          )}
          src={lens.image}
          alt={lens.alt}
          width="96"
          height="96"
        />
      </header>
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-16 pt-14 pb-16 max-laptop:grid-cols-1 max-laptop:gap-10 max-tablet:pt-9 max-tablet:pb-11">
        <p className="text-[clamp(26px,2.4vw,34px)] leading-[1.3]">
          {lens.description}
        </p>
        <section aria-labelledby="focus-title">
          <h2 id="focus-title" className={eyebrow}>
            What we cover
          </h2>
          <ul>
            {lens.focus.map((item) => (
              <li
                className="grid grid-cols-[220px_minmax(0,1fr)] gap-6 border-t border-line py-[22px] max-tablet:grid-cols-1 max-tablet:gap-2"
                key={item.title}
              >
                <h3 className="text-[28px] leading-[1.15]">{item.title}</h3>
                <p className="text-[21px] leading-[1.45] text-ink-muted">
                  {item.copy}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <nav
        className="flex flex-wrap items-center gap-x-10 gap-y-2 border-t border-line pt-7"
        aria-label="Other lenses"
      >
        <span className="text-[18px] text-ink-muted max-phone:basis-full">
          Keep reading
        </span>
        {otherLenses.map((other) => (
          <Link className={textLink} to={`/${other.id}`} key={other.id}>
            ({other.number}) {other.title} <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
    </article>
  )
}
