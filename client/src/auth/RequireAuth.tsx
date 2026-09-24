import { useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router"
import {
  eyebrow,
  pageIntro,
  pageIntroCopy,
  pageTitle,
  primaryButton,
} from "../lib/styles"
import { useAuth } from "./auth-context"

export function SessionStatus() {
  const auth = useAuth()
  const [retrying, setRetrying] = useState(false)
  return (
    <section
      className={pageIntro}
      aria-live="polite"
      aria-busy={auth.status === "loading" || retrying}
    >
      <p className={eyebrow}>Your workspace</p>
      <h1 className={pageTitle}>
        {auth.status === "error"
          ? "Let's reconnect."
          : "Opening your workspace…"}
      </h1>
      {auth.status === "error" && (
        <>
          <p className={pageIntroCopy} role="alert">
            {auth.error}
          </p>
          <button
            className={primaryButton}
            disabled={retrying}
            onClick={async () => {
              setRetrying(true)
              await auth.refresh()
              setRetrying(false)
            }}
          >
            {retrying ? "Trying again…" : "Try again"}
          </button>
        </>
      )}
    </section>
  )
}

export default function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === "loading" || auth.status === "error")
    return <SessionStatus />
  if (auth.status === "anonymous") {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{
          returnTo: location.pathname + location.search + location.hash,
        }}
      />
    )
  }
  return <Outlet />
}
