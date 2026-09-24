import { useState } from "react"
import { House, LogOut, Settings } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router"
import { useAuth } from "../auth/auth-context"
import { ApiError } from "../lib/api"
import { fieldError } from "../lib/styles"

const workspaceLinks = [
  { label: "Home", to: "/home", icon: House },
  { label: "Settings", to: "/settings", icon: Settings },
]

/** The signed-in workspace: a side nav in place of the landing masthead. */
export default function WorkspaceLayout() {
  const auth = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState("")

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

  return (
    <div className="grid flex-1 grid-cols-[220px_minmax(0,1fr)] max-laptop:flex max-laptop:flex-col">
      {/* Unstyled for now; the side-nav class resets it to browser defaults (see index.css). */}
      <aside className="side-nav">
        <Link to="/" aria-label="Triglobe landing page">
          Triglobe
        </Link>
        <nav aria-label="Workspace navigation">
          {workspaceLinks.map(({ label, to, icon: Icon }) => (
            <NavLink to={to} key={to}>
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        {auth.status === "authenticated" && (
          <div>
            <button type="button" disabled={signingOut} onClick={handleSignOut}>
              <LogOut size={18} aria-hidden="true" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </aside>
      <main id="main-content" className="page-width flex-1" tabIndex={-1}>
        {logoutError && (
          <p className={fieldError} role="alert">
            {logoutError}
          </p>
        )}
        <Outlet />
      </main>
    </div>
  )
}
