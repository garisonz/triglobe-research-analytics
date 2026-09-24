import { useEffect, useRef } from "react"

/** One frame per scroll event; transform-only updates keep React off the hot path. */
export function useHeroParallax() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const hero = ref.current
    if (!hero) return
    const layers = Array.from(
      hero.querySelectorAll<HTMLElement>("[data-parallax]")
    )
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    const update = () => {
      frame = 0
      const distance = Math.max(
        0,
        Math.min(-hero.getBoundingClientRect().top, hero.offsetHeight)
      )
      for (const layer of layers) {
        const offset = preference.matches
          ? 0
          : distance * Number(layer.dataset.parallax)
        layer.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`)
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    preference.addEventListener("change", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      preference.removeEventListener("change", schedule)
    }
  }, [])
  return ref
}
