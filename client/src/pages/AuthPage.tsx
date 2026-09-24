import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowUpRight, Eye, EyeOff } from "lucide-react"
import { Link, Navigate, useLocation, useNavigate } from "react-router"
import { getReturnTo, useAuth } from "../auth/auth-context"
import { SessionStatus } from "../auth/RequireAuth"
import { ApiError, apiRequest } from "../lib/api"

export default function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signingUp = mode === "sign-up"
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = getReturnTo(location.state)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [confirmationError, setConfirmationError] = useState("")
  const registered = location.state?.registered === true

  if (auth.status === "loading") return <SessionStatus />
  if (auth.status === "authenticated") return <Navigate to={returnTo} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError("")
    setConfirmationError("")
    if (signingUp && password !== confirmation) {
      setConfirmationError("Your passwords don't match.")
      document.getElementById("confirm-password")?.focus()
      return
    }
    setPending(true)
    try {
      const credentials = { email: email.trim(), password }
      if (signingUp) {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify(credentials),
          notifyUnauthorized: false,
        })
        navigate("/sign-in", {
          replace: true,
          state: { returnTo, registered: true },
        })
      } else {
        await auth.signIn(credentials)
      }
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Something went wrong. Please try again."
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <div className="auth-intro">
        <p className="eyebrow">
          <span className="status-dot" /> A broader perspective
        </p>
        <h1 id="auth-title">
          {signingUp
            ? "A little curiosity.\nA wider world."
            : "Welcome back.\nFind your perspective."}
        </h1>
        <p className="intro-copy">
          {signingUp
            ? "Create your account and start connecting the companies, politics, and nations shaping our world."
            : "Sign in to return to your research workspace and keep exploring the bigger picture."}
        </p>
        <p className="auth-note">Politics. Business. Nations.</p>
      </div>
      <div className="auth-card">
        <h2>{signingUp ? "Create an account" : "Sign in to Triglobe"}</h2>
        <p className="auth-card-copy">
          {signingUp ? "Your research starts here." : "Good to have you here."}
        </p>
        {registered && !signingUp && (
          <p className="auth-success" role="status">
            Your account is ready. Sign in to open your workspace.
          </p>
        )}
        <form onSubmit={submit} aria-busy={pending}>
          <fieldset disabled={pending}>
            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={320}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="password-input">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  required
                  minLength={signingUp ? 15 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={signingUp ? "password-hint" : undefined}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              {signingUp && (
                <p className="field-hint" id="password-hint">
                  Use 15–128 characters. A few memorable words work well.
                </p>
              )}
            </div>
            {signingUp && (
              <div className="auth-field">
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={15}
                  maxLength={128}
                  value={confirmation}
                  onChange={(event) => {
                    setConfirmation(event.target.value)
                    setConfirmationError("")
                  }}
                  aria-invalid={Boolean(confirmationError)}
                  aria-describedby={
                    confirmationError ? "confirmation-error" : undefined
                  }
                />
                {confirmationError && (
                  <p
                    id="confirmation-error"
                    className="field-error"
                    role="alert"
                  >
                    {confirmationError}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p className="field-error auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary auth-submit" type="submit">
              {pending
                ? signingUp
                  ? "Creating account…"
                  : "Signing in…"
                : signingUp
                  ? "Create account"
                  : "Sign in"}
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </fieldset>
        </form>
        <p className="auth-switch">
          {signingUp ? "Already have an account?" : "New to Triglobe?"}{" "}
          <Link to={signingUp ? "/sign-in" : "/sign-up"} state={{ returnTo }}>
            {signingUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </section>
  )
}
