export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export const SESSION_EXPIRED_EVENT = "triglobe:session-expired"
const apiBase = (import.meta.env?.VITE_API_URL || "/api").replace(/\/$/, "")

type RequestOptions = RequestInit & { notifyUnauthorized?: boolean }

/** Send cookies with every API call; session tokens never enter JavaScript. */
export async function apiRequest<T>(
  path: string,
  { notifyUnauthorized = true, ...options }: RequestOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json")
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError("Unable to reach Triglobe. Please try again.", 0)
  }

  if (!response.ok) {
    if (response.status === 401 && notifyUnauthorized) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    const body: unknown = await response.json().catch(() => null)
    let message = "Something went wrong. Please try again."
    if (response.status === 429)
      message = "Too many attempts. Please try again later."
    if (body && typeof body === "object" && "detail" in body) {
      const detail = body.detail
      if (typeof detail === "string" && response.status < 500) message = detail
      else if (response.status === 422)
        message = "Check your email and password and try again."
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
