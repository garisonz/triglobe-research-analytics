import { useEffect } from "react"
import { useLocation } from "react-router"
import { lenses } from "./content/lenses"
import AppRoutes from "./routes"

export default function App() {
  const { pathname, hash, key: locationKey } = useLocation()

  useEffect(() => {
    const lens = lenses.find((item) => pathname === `/${item.id}`)
    const title =
      pathname === "/"
        ? "Research with perspective"
        : lens
          ? lens.title
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

  return (
    <div className="relative isolate flex min-h-svh flex-col font-serif text-[20px] text-ink antialiased before:pointer-events-none before:fixed before:inset-0 before:-z-1 before:bg-atlas has-[.home-page]:before:hidden">
      <a
        className="fixed top-2.5 left-4 z-50 -translate-y-[180%] bg-ink px-[18px] py-3 text-paper focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <AppRoutes />
    </div>
  )
}
