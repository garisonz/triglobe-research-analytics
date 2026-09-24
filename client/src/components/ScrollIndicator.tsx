import { useEffect, useRef } from "react"

/** A decorative latitude marker; update its CSS variable without React renders. */
export default function ScrollIndicator() {
  const indicator = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame: number | null = null

    function updateProgress() {
      frame = null
      const scrollableHeight = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        0
      )
      const progress = scrollableHeight
        ? Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1)
        : 0
      indicator.current?.style.setProperty(
        "--scroll-progress",
        String(progress)
      )
    }

    function scheduleUpdate() {
      if (frame === null) frame = window.requestAnimationFrame(updateProgress)
    }

    // Route changes and images can change document height without a window resize.
    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(document.body)
    resizeObserver.observe(document.documentElement)
    window.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("resize", scheduleUpdate)
    scheduleUpdate()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={indicator} className="scroll-indicator" aria-hidden="true">
      <span>N</span>
      <span className="scroll-indicator-track">
        <span className="scroll-indicator-fill" />
      </span>
      <span>S</span>
    </div>
  )
}
