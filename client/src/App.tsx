import { useEffect } from "react"
import { Link, NavLink, useLocation } from "react-router"
import AppRoutes from "./routes"
import "./site.css"

export default function App() {
  const { pathname } = useLocation()
  const isLanding = pathname === "/"

  useEffect(() => {
    window.scrollTo(0, 0)
    const title =
      pathname === "/"
        ? "Research with perspective"
        : pathname === "/home"
          ? "Home"
          : pathname === "/settings"
            ? "Settings"
            : pathname.startsWith("/stocks/")
              ? "Company research"
              : "Page not found"
    document.title = `${title} | Triglobe`
  }, [pathname])

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Triglobe landing page">
          <img
            className="brand-logo"
            src="/triglobe-logo.svg"
            alt=""
            width={34}
            height={32}
          />
          <span>
            triglobe<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          {isLanding ? (
            <>
              <a className="nav-link" href="#perspectives">
                Our focus
              </a>
              <Link className="button button-primary button-small" to="/home">
                Open workspace <span aria-hidden="true">&rarr;</span>
              </Link>
            </>
          ) : (
            <>
              <NavLink className="nav-link" to="/home">
                Home
              </NavLink>
              <NavLink className="nav-link" to="/settings">
                Settings
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <main id="main-content" className="site-main" tabIndex={-1}>
        <AppRoutes />
      </main>
      <footer className="site-footer">
        <span>Triglobe Research &amp; Analytics</span>
        <span>Politics. Business. Nations.</span>
      </footer>
    </div>
  )
}
