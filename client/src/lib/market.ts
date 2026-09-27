import { useEffect, useState } from "react"
import { ApiError, apiRequest } from "./api"

export type Instrument = {
  symbol: string
  name: string
  asset_type: string
  exchange: string | null
  last_synced_at: string | null
  candle_count?: number
}
export type CatalogInstrument = {
  id: string
  company_id: string
  cik: string | null
  symbol: string
  yahoo_symbol: string | null
  name: string
  exchange: string | null
  currency: string | null
  sector: string | null
  industry: string | null
  gics_sector: string | null
  gics_sub_industry: string | null
  is_sp500: boolean
  catalog_synced_at: string | null
  profile_synced_at: string | null
  candle_count: number
}
export type CatalogResponse = {
  instruments: CatalogInstrument[]
  total: number
  sectors: string[]
}
export type CompanyProfile = CatalogInstrument & {
  description: string | null
  website: string | null
  country: string | null
}

export type Candle = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}
export type HistoryRange = "1m" | "3m" | "6m" | "1y" | "5y" | "all"
export type HistoryResponse = {
  instrument: Instrument
  interval: "1d"
  range: HistoryRange
  candles: Candle[]
  source: string
  last_synced_at: string | null
}
type Result<T> =
  | { key: string; status: "ready"; data: T }
  | { key: string; status: "error"; error: ApiError }

/** Key responses to their request so a slower old range cannot replace a new one. */
export function useMarketData<T>(path: string) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const key = `${path}:${attempt}`
  useEffect(() => {
    const controller = new AbortController()
    void apiRequest<T>(path, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    }).then(
      (data) => {
        if (!controller.signal.aborted)
          setResult({ key, status: "ready", data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            status: "error",
            error:
              error instanceof ApiError
                ? error
                : new ApiError(
                    "Unable to load market data. Please try again.",
                    0
                  ),
          })
      }
    )
    return () => controller.abort()
  }, [key, path])
  return {
    result: result?.key === key ? result : null,
    retry: () => setAttempt((current) => current + 1),
  }
}
