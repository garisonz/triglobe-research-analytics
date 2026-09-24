import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowUpRight, Eye, EyeOff } from "lucide-react"
import { Link, Navigate, useLocation, useNavigate } from "react-router"
import { getReturnTo, useAuth } from "../auth/auth-context"
import { SessionStatus } from "../auth/RequireAuth"
import { ApiError, apiRequest } from "../lib/api"
import { eyebrow, fieldError, introCopy, primaryButton } from "../lib/styles"
import { cn } from "../lib/utils"

const inputClass =
  "min-h-12 w-full min-w-0 rounded-none border border-[#999] bg-[#f3f3f3] px-3 py-2.5 text-[20px] aria-invalid:border-2 aria-invalid:border-ink"
const fieldClass = "mb-[21px]"
const labelClass = "mb-[9px] block text-[19px]"

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
    <section
      className="grid grid-cols-[1fr_minmax(0,440px)] items-center gap-[90px] pt-[82px] pb-24 max-laptop:gap-10 max-tablet:mx-auto max-tablet:max-w-[520px] max-tablet:grid-cols-1 max-tablet:pt-[50px] max-tablet:pb-[70px]"
      aria-labelledby="auth-title"
    >
      <div>
        <p className={eyebrow}>
          <span className="size-[5px] shrink-0 rounded-full bg-ink" /> A broader
          perspective
        </p>
        <h1
          id="auth-title"
          className="my-[25px] text-[clamp(48px,5.8vw,82px)] leading-[1.04] tracking-[-1.8px] whitespace-pre-line max-phone:text-[51px]"
        >
          {signingUp
            ? "A little curiosity.\nA wider world."
            : "Welcome back.\nFind your perspective."}
        </h1>
        <p className={cn(introCopy, "max-w-[460px]")}>
          {signingUp
            ? "Create your account and start connecting the companies, politics, and nations shaping our world."
            : "Sign in to return to your research workspace and keep exploring the bigger picture."}
        </p>
        <p className="mt-10 text-ink-muted italic max-tablet:hidden">
          Politics. Business. Nations.
        </p>
      </div>
      <div className="min-w-0 border border-[#bdbdbd] bg-paper p-8 max-phone:p-6">
        <h2 className="text-[40px] leading-[1.1] tracking-[-0.8px] max-phone:text-[36px]">
          {signingUp ? "Create an account" : "Sign in to Triglobe"}
        </h2>
        <p className="mt-3 mb-7 text-[21px] text-ink-muted">
          {signingUp ? "Your research starts here." : "Good to have you here."}
        </p>
        {registered && !signingUp && (
          <p
            className="mb-[22px] border border-[#999] bg-[#f4f4f4] p-3.5 text-[19px] leading-[1.4]"
            role="status"
          >
            Your account is ready. Sign in to open your workspace.
          </p>
        )}
        <form onSubmit={submit} aria-busy={pending}>
          <fieldset className="min-w-0" disabled={pending}>
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="email">
                Email address
              </label>
              <input
                className={inputClass}
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
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  className={cn(inputClass, "pr-12")}
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
                  className="absolute top-0.5 right-0.5 grid size-11 place-items-center text-ink-muted"
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
                <p
                  className="mt-2.5 text-[16px] leading-[1.45] text-ink-muted"
                  id="password-hint"
                >
                  Use 15–128 characters. A few memorable words work well.
                </p>
              )}
            </div>
            {signingUp && (
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  className={inputClass}
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
                    className={fieldError}
                    role="alert"
                  >
                    {confirmationError}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p className={cn(fieldError, "mb-4 leading-[1.45]")} role="alert">
                {error}
              </p>
            )}
            <button
              className={cn(primaryButton, "mt-[5px] w-full")}
              type="submit"
            >
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
        <p className="mt-[25px] text-center text-[19px] leading-normal text-ink-muted">
          {signingUp ? "Already have an account?" : "New to Triglobe?"}{" "}
          <Link
            className="text-ink underline underline-offset-4"
            to={signingUp ? "/sign-in" : "/sign-up"}
            state={{ returnTo }}
          >
            {signingUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </section>
  )
}
