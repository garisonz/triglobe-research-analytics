import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { ApiError, apiRequest, SESSION_EXPIRED_EVENT } from "../lib/api"
import { AuthContext } from "./auth-context"
import type { AuthState, Credentials, User } from "./auth-context"

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
  })
  const revision = useRef(0)

  const invalidate = useCallback(() => {
    ++revision.current
  }, [])
  const refresh = useCallback(() => {
    const current = ++revision.current
    return apiRequest<User>("/auth/me", { notifyUnauthorized: false }).then(
      (user) => {
        if (current === revision.current)
          setState({ status: "authenticated", user })
      },
      (error: unknown) => {
        if (current !== revision.current) return
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: "anonymous", user: null })
        } else {
          setState({
            status: "error",
            user: null,
            error: "We couldn't check your session. Please try again.",
          })
        }
      }
    )
  }, [])
  useEffect(() => {
    void refresh()
    const expire = () => {
      ++revision.current
      setState({ status: "anonymous", user: null })
    }
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    window.addEventListener("focus", onFocus)
    return () => {
      invalidate()
      window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh, invalidate])

  async function signIn(credentials: Credentials) {
    ++revision.current
    const user = await apiRequest<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      notifyUnauthorized: false,
    })
    ++revision.current
    setState({ status: "authenticated", user })
  }

  async function signOut() {
    ++revision.current
    await apiRequest<void>("/auth/logout", { method: "POST" })
    ++revision.current
    setState({ status: "anonymous", user: null })
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
