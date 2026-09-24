import { createContext, useContext } from "react"

export type User = { id: string; email: string; created_at: string }
export type Credentials = { email: string; password: string }
export type AuthState =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: User }
  | { status: "error"; user: null; error: string }

export type AuthContextValue = AuthState & {
  signIn: (credentials: Credentials) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

// Only return to local workspace routes, never an arbitrary redirect URL.
export function getReturnTo(state: unknown): string {
  if (!state || typeof state !== "object" || !("returnTo" in state))
    return "/home"
  const path = state.returnTo
  return typeof path === "string" &&
    /^\/(?:home|settings|stocks\/[A-Za-z0-9.-]+)(?:[?#].*)?$/.test(path)
    ? path
    : "/home"
}
