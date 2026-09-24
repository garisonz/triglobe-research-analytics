import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import { useAuth } from "../auth/auth-context"
import { lenses } from "../content/lenses"
import { cn } from "../lib/utils"

// Masthead links underline on hover and on the current page.
const navLink =
  "relative inline-flex min-h-11 items-center whitespace-nowrap after:absolute after:inset-x-0 after:bottom-[7px] after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-180 hover:after:scale-x-100 aria-[current=page]:after:scale-x-100"
const subscribeLink =
  "text-[22px] font-semibold whitespace-nowrap underline underline-offset-5"
const freeTag = "relative -top-[0.25em] ml-1 text-[12px] font-normal italic"

/** The editorial masthead and footer for the landing, lens, and sign-in pages. */
export default function PublicLayout() {
  const { key: locationKey } = useLocation()
  const auth = useAuth()
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  // A menu belongs to its current location and closes automatically on navigation.
  const menuOpen = openMenuKey === locationKey

  useEffect(() => {
    if (!menuOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuKey(null)
        menuButton.current?.focus()
      }
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [menuOpen])

  function renderLensLinks() {
    return lenses.map((lens) => (
      <NavLink
        key={lens.id}
        className={navLink}
        to={`/${lens.id}`}
        onClick={() => setOpenMenuKey(null)}
      >
        {lens.title}
      </NavLink>
    ))
  }

  return (
    <>
      <header className="relative z-10 page-width flex min-h-21 flex-wrap items-center justify-between gap-6 border-b border-line max-desktop:gap-4 max-phone:min-h-[74px] max-phone:gap-2.5">
        <Link
          className="inline-flex items-baseline gap-3 text-[30px] font-semibold tracking-[-0.8px] whitespace-nowrap max-phone:text-[26px]"
          to="/"
          aria-label="Triglobe landing page"
        >
          <span>Triglobe</span>
          <span className="text-[16px] font-normal tracking-normal text-ink-muted italic max-desktop:hidden max-laptop:inline max-phone:hidden">
            Est. 2026
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-[25px] text-[20px] max-desktop:gap-[18px] max-laptop:hidden"
        >
          {renderLensLinks()}
        </nav>
        <div className="flex items-center gap-[17px] text-[18px] max-desktop:gap-3 max-phone:gap-3.5 max-phone:text-[17px]">
          <label className="relative inline-flex items-center text-[16px] max-phone:hidden">
            <span className="sr-only">Language</span>
            <select
              className="min-h-8 cursor-pointer appearance-none rounded-full border border-brand bg-transparent py-[3px] pr-[27px] pl-3"
              aria-label="Language"
              defaultValue="en"
            >
              <option value="en">En</option>
            </select>
            <span
              className="pointer-events-none absolute right-2.5 text-[11px]"
              aria-hidden="true"
            >
              ▾
            </span>
          </label>
          {auth.status === "authenticated" ? (
            <NavLink className={navLink} to="/home">
              Home
            </NavLink>
          ) : (
            <>
              <NavLink className={navLink} to="/sign-in">
                Sign in
              </NavLink>
              <Link
                className={cn(subscribeLink, "max-phone:hidden")}
                to="/sign-up"
              >
                Subscribe <sup className={freeTag}>free</sup>
              </Link>
            </>
          )}
          <button
            ref={menuButton}
            className="hidden min-h-11 items-center max-laptop:inline-flex"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setOpenMenuKey(menuOpen ? null : locationKey)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
        <nav
          id="mobile-navigation"
          className="flex basis-full flex-wrap justify-between gap-4 border-t border-line pb-5 max-phone:gap-2.5 max-phone:text-[20px] laptop:hidden"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
        >
          {renderLensLinks()}
          {auth.status !== "authenticated" && (
            <Link
              className={cn(
                subscribeLink,
                "hidden max-phone:inline-flex max-phone:min-h-11 max-phone:basis-full max-phone:items-baseline max-phone:text-[20px]"
              )}
              to="/sign-up"
              onClick={() => setOpenMenuKey(null)}
            >
              Subscribe <sup className={freeTag}>free</sup>
            </Link>
          )}
        </nav>
      </header>
      <main id="main-content" className="page-width flex-1" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="page-width flex flex-wrap items-baseline justify-between gap-4 border-t border-line py-[26px] text-[16px] text-ink-muted max-phone:flex-col max-phone:gap-1.5 max-phone:text-[15px]">
        <span>Triglobe Research &amp; Analytics</span>
        <span>Politics. Business. Nations.</span>
        <span className="italic">Independent perspectives. Est. 2026.</span>
      </footer>
    </>
  )
}
