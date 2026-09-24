import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useLocation } from "react-router"
import { useAuth } from "./auth/auth-context"
import ScrollIndicator from "./components/ScrollIndicator"
import { ApiError } from "./lib/api"
import AppRoutes from "./routes"
import "./site.css"

const lensLinks = [
  { label: "Politics", hash: "politics" },
  { label: "Business", hash: "business" },
  { label: "Nations", hash: "nations" },
]

export default function App() {
  const { pathname, hash, key: locationKey } = useLocation()
  const auth = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState("")
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  // A menu belongs to its current location and closes automatically on navigation.
  const menuOpen = openMenuKey === locationKey

  useEffect(() => {
    const title =
      pathname === "/"
        ? "Research with perspective"
        : pathname === "/sign-in"
          ? "Sign in"
          : pathname === "/sign-up"
            ? "Create an account"
            : pathname === "/home"
              ? "Home"
              : pathname === "/settings"
                ? "Settings"
                : pathname.startsWith("/stocks/")
                  ? "Company research"
                  : "Page not found"
    document.title = `${title} | Triglobe`
  }, [pathname])

  useEffect(() => {
    // Wait for the destination route to mount before resolving cross-page anchors.
    const frame = window.requestAnimationFrame(() => {
      if (hash) {
        let targetId = hash.slice(1)
        try {
          targetId = decodeURIComponent(targetId)
        } catch {
          // Malformed URL escapes can still be treated as a literal element ID.
        }
        document.getElementById(targetId)?.scrollIntoView({ block: "start" })
      } else {
        window.scrollTo(0, 0)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pathname, hash, locationKey])

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

  async function handleSignOut() {
    setSigningOut(true)
    setLogoutError("")
    try {
      await auth.signOut()
    } catch (error) {
      setLogoutError(
        error instanceof ApiError
          ? error.message
          : "Unable to sign out. Please try again."
      )
    } finally {
      setSigningOut(false)
    }
  }

  function renderLensLinks() {
    return lensLinks.map((link) => {
      const active = pathname === "/" && hash === `#${link.hash}`
      return (
        <Link
          key={link.hash}
          className={`nav-link${active ? "active" : ""}`}
          to={`/#${link.hash}`}
          aria-current={active ? "location" : undefined}
          onClick={() => setOpenMenuKey(null)}
        >
          {link.label}
        </Link>
      )
    })
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Triglobe landing page">
          <span>Triglobe</span>
          <span className="brand-edition">Est. 2026</span>
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          {renderLensLinks()}
        </nav>
        <div className="header-actions">
          <label className="language-selector">
            <span className="sr-only">Language</span>
            <select aria-label="Language" defaultValue="en">
              <option value="en">En</option>
            </select>
            <span aria-hidden="true">▾</span>
          </label>
          {auth.status === "authenticated" ? (
            <>
              <NavLink className="account-link" to="/home">
                Home
              </NavLink>
              <NavLink className="account-link" to="/settings">
                Settings
              </NavLink>
              <button
                className="account-link sign-out-link"
                disabled={signingOut}
                onClick={handleSignOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <NavLink className="account-link" to="/sign-in">
                Sign in
              </NavLink>
              <Link className="subscribe-link" to="/sign-up">
                Subscribe <sup>free</sup>
              </Link>
            </>
          )}
          <button
            ref={menuButton}
            className="menu-toggle"
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
          className="mobile-menu"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
        >
          {renderLensLinks()}
          {auth.status !== "authenticated" && (
            <Link
              className="mobile-subscribe subscribe-link"
              to="/sign-up"
              onClick={() => setOpenMenuKey(null)}
            >
              Subscribe <sup>free</sup>
            </Link>
          )}
        </nav>
      </header>
      <ScrollIndicator />
      <main id="main-content" className="site-main" tabIndex={-1}>
        {logoutError && (
          <p className="field-error" role="alert">
            {logoutError}
          </p>
        )}
        <AppRoutes />
      </main>
      <footer className="site-footer">
        <span>Triglobe Research &amp; Analytics</span>
        <span>Politics. Business. Nations.</span>
        <span className="footer-edition">
          Independent perspectives. Est. 2026.
        </span>
      </footer>
    </div>
  )
}
