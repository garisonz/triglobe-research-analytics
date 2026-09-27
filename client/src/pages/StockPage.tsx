import { useEffect, useId, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { useMarketData } from "../lib/market"
import type {
  Candle,
  CompanyProfile,
  HistoryRange,
  HistoryResponse,
} from "../lib/market"
import "./StockPage.css"

const ranges: { value: HistoryRange; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "all", label: "All" },
]
const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})
const wholeNumber = new Intl.NumberFormat("en-US")
// Daily sessions follow the exchange's timezone, not the viewer's.
const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
})
const syncTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
})

function DailyChart({
  candles,
  symbol,
}: {
  candles: Candle[]
  symbol: string
}) {
  const [selectedIndex, setSelectedIndex] = useState(candles.length - 1)
  const chartRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(960)
  useEffect(() => {
    if (!chartRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(200, entry.contentRect.width))
    })
    observer.observe(chartRef.current)
    return () => observer.disconnect()
  }, [])
  const descriptionId = useId()
  const sliderId = useId()
  const selected = candles[selectedIndex]
  const first = candles[0]
  const last = candles[candles.length - 1]
  const height = width < 650 ? 240 : 330
  const left = 12
  const right = width - 76
  const top = 25
  const bottom = height - 30
  const closes = candles.map((candle) => candle.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const padding = Math.max((max - min) * 0.12, max * 0.01, 0.01)
  const lower = Math.max(0, min - padding)
  const upper = max + padding
  const firstTime = new Date(first.time).getTime()
  const lastTime = new Date(last.time).getTime()
  const x = (candle: Candle) =>
    lastTime === firstTime
      ? (left + right) / 2
      : left +
        ((new Date(candle.time).getTime() - firstTime) /
          (lastTime - firstTime)) *
          (right - left)
  const y = (price: number) =>
    bottom - ((price - lower) / (upper - lower)) * (bottom - top)
  const line = candles
    .map(
      (candle, index) => `${index ? "L" : "M"}${x(candle)},${y(candle.close)}`
    )
    .join(" ")
  const fill = `${line} L${x(last)},${bottom} L${x(first)},${bottom} Z`

  return (
    <div className="stock-chart" ref={chartRef}>
      <dl
        className="stock-candle-details"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="stock-candle-date">
          <dt>Session</dt>
          <dd>{day.format(new Date(selected.time))}</dd>
        </div>
        {(["open", "high", "low", "close"] as const).map((field) => (
          <div key={field}>
            <dt>{field}</dt>
            <dd>{dollars.format(selected[field])}</dd>
          </div>
        ))}
        <div>
          <dt>Volume</dt>
          <dd>{wholeNumber.format(selected.volume)}</dd>
        </div>
      </dl>
      <svg
        className="stock-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${symbol} historical daily closing prices`}
        aria-describedby={descriptionId}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const chartX = ((event.clientX - bounds.left) / bounds.width) * width
          let closest = 0
          for (let index = 1; index < candles.length; index++) {
            if (
              Math.abs(x(candles[index]) - chartX) <
              Math.abs(x(candles[closest]) - chartX)
            )
              closest = index
          }
          setSelectedIndex(closest)
        }}
      >
        <desc id={descriptionId}>
          {candles.length} daily closes, from {day.format(new Date(first.time))}{" "}
          to {day.format(new Date(last.time))}. Use the session slider below to
          inspect each day's prices and volume.
        </desc>
        {[0, 1, 2, 3].map((index) => {
          const price = lower + ((upper - lower) * index) / 3
          return (
            <g key={index}>
              <line
                x1={left}
                x2={right}
                y1={y(price)}
                y2={y(price)}
                className="stock-chart-grid"
              />
              <text
                x={right + 14}
                y={y(price) + 4}
                className="stock-chart-label"
              >
                {dollars.format(price)}
              </text>
            </g>
          )
        })}
        <path d={fill} className="stock-chart-area" />
        <path d={line} className="stock-chart-line" />
        <line
          x1={x(selected)}
          x2={x(selected)}
          y1={top}
          y2={bottom}
          className="stock-chart-cursor"
        />
        <circle
          cx={x(selected)}
          cy={y(selected.close)}
          r={5}
          className="stock-chart-point"
        />
      </svg>
      <div className="stock-chart-dates" aria-hidden="true">
        <span>{day.format(new Date(first.time))}</span>
        <span>{day.format(new Date(last.time))}</span>
      </div>
      <div className="stock-session-control">
        <label htmlFor={sliderId}>Inspect a session</label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={candles.length - 1}
          step={1}
          value={selectedIndex}
          disabled={candles.length === 1}
          aria-valuetext={`${day.format(new Date(selected.time))}, close ${dollars.format(selected.close)}`}
          onChange={(event) => setSelectedIndex(Number(event.target.value))}
        />
        <span className="stock-muted">Drag or use the arrow keys.</span>
      </div>
    </div>
  )
}

function PriceSummary({ candles }: { candles: Candle[] }) {
  const last = candles[candles.length - 1]
  const previous = candles.at(-2)
  const change = previous ? last.close - previous.close : null
  const percentage =
    previous && previous.close !== 0 && change !== null
      ? (change / previous.close) * 100
      : null
  return (
    <div className="stock-price-summary">
      <div>
        <p className="stock-label">Latest stored close · USD</p>
        <p className="stock-price">{dollars.format(last.close)}</p>
        <p className="stock-muted">{day.format(new Date(last.time))}</p>
      </div>
      {change !== null && (
        <div className="stock-change">
          <p className={change >= 0 ? "stock-positive" : "stock-negative"}>
            {change > 0 ? "+" : ""}
            {dollars.format(change)}
            {percentage !== null &&
              ` (${percentage > 0 ? "+" : ""}${percentage.toFixed(2)}%)`}
          </p>
          <p className="stock-muted">vs. previous stored session</p>
        </div>
      )}
    </div>
  )
}

function CompanyOverview({ company }: { company: CompanyProfile }) {
  let website: URL | null = null
  try {
    const parsed = new URL(company.website ?? "")
    if (parsed.protocol === "https:" || parsed.protocol === "http:")
      website = parsed
  } catch {
    // Imported profiles may omit a website or contain an invalid URL.
  }
  const details = [
    ["Sector", company.sector || company.gics_sector],
    ["Industry", company.industry || company.gics_sub_industry],
    ["Exchange", company.exchange],
    ["Country", company.country],
    ["SEC CIK", company.cik],
  ]
  return (
    <>
      <div className="stock-profile-heading">
        <h2 id="company-overview-title">Company overview</h2>
        {company.is_sp500 && (
          <span className="stock-history-badge">S&P 500</span>
        )}
      </div>
      <p className="stock-description">
        {company.description || "A business description is not available yet."}
      </p>
      <dl className="stock-company-details">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "Not available"}</dd>
          </div>
        ))}
      </dl>
      {website && (
        <a
          className="stock-company-website"
          href={website.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {website.hostname} <ArrowUpRight size={15} aria-hidden="true" />
          <span className="stock-visually-hidden"> (opens in a new tab)</span>
        </a>
      )}
      <p className="stock-profile-freshness">
        {company.profile_synced_at
          ? `Profile updated ${syncTime.format(new Date(company.profile_synced_at))}`
          : "Company profile enrichment pending."}
        {company.catalog_synced_at &&
          ` · Catalog updated ${syncTime.format(new Date(company.catalog_synced_at))}`}
      </p>
    </>
  )
}

export default function StockPage() {
  const { symbol: routeSymbol = "" } = useParams()
  const symbol = routeSymbol.toUpperCase()
  const [range, setRange] = useState<HistoryRange>("1y")
  const { result, retry } = useMarketData<HistoryResponse>(
    `/market/history/${encodeURIComponent(symbol)}?range=${range}`
  )
  const { result: profileResult, retry: retryProfile } =
    useMarketData<CompanyProfile>(
      `/market/catalog/${encodeURIComponent(symbol)}`
    )
  const company = profileResult?.status === "ready" ? profileResult.data : null
  const data = result?.status === "ready" ? result.data : null
  return (
    <article className="stock-page">
      <Link className="stock-back" to="/home">
        <ArrowLeft size={15} aria-hidden="true" /> Research home
      </Link>
      <header className="stock-header">
        <div>
          <p className="stock-eyebrow">Business research</p>
          <h1>{company?.symbol || symbol}</h1>
          {(company || data) && (
            <p className="stock-name">
              {company?.name || data?.instrument.name}
            </p>
          )}
        </div>
        <p className="stock-history-badge">
          Daily close <span aria-hidden="true">·</span> Historical
        </p>
      </header>
      {(!profileResult ||
        company ||
        (profileResult.status === "error" &&
          profileResult.error.status !== 404)) && (
        <section
          className="stock-profile"
          aria-labelledby={company ? "company-overview-title" : undefined}
          aria-label={company ? undefined : "Company overview"}
        >
          {!profileResult && (
            <p className="stock-profile-message" role="status">
              Loading company profile…
            </p>
          )}
          {profileResult?.status === "error" && (
            <div className="stock-profile-message" role="alert">
              <p>The company profile could not be loaded.</p>
              <button
                className="stock-action"
                type="button"
                onClick={retryProfile}
              >
                Retry company profile
              </button>
            </div>
          )}
          {company && <CompanyOverview company={company} />}
        </section>
      )}
      <section className="stock-history" aria-labelledby="price-history-title">
        <div className="stock-history-heading">
          <h2 id="price-history-title">Price history</h2>
          <div className="stock-ranges" role="group" aria-label="History range">
            {ranges.map(({ value, label }) => (
              <button
                type="button"
                key={value}
                aria-pressed={range === value}
                onClick={() => setRange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {!result && (
          <div className="stock-state" role="status">
            Loading historical prices…
          </div>
        )}
        {result?.status === "error" && (
          <div className="stock-state" role="alert">
            <h3>
              {result.error.status === 404
                ? "No price history is available for this symbol."
                : "Historical prices couldn't be loaded."}
            </h3>
            <p>
              {result.error.status === 404
                ? "Browse the company catalog to find a supported business."
                : "Please try again in a moment."}
            </p>
            {result.error.status === 404 ? (
              <Link className="stock-action" to="/home">
                View company catalog{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <button className="stock-action" type="button" onClick={retry}>
                Try again
              </button>
            )}
          </div>
        )}
        {data &&
          (data.candles.length ? (
            <>
              <PriceSummary candles={data.candles} />
              <DailyChart
                key={`${symbol}:${range}:${data.last_synced_at}`}
                candles={data.candles}
                symbol={symbol}
              />
            </>
          ) : (
            <div className="stock-state" role="status">
              <h3>
                {company?.candle_count === 0
                  ? "Price history has not been imported yet."
                  : "No historical data for this range."}
              </h3>
              <p>
                {company?.candle_count === 0
                  ? "Company information is available above. Daily prices will appear after a market-data import."
                  : "No daily prices are available for the selected period. Try a wider range."}
              </p>
            </div>
          ))}
        <footer className="stock-history-footer">
          <p>
            {data ? `Source: ${data.source}` : "Historical market data"}{" "}
            <span aria-hidden="true">·</span> Daily stock and ETF history{" "}
            <span aria-hidden="true">·</span> Not live prices
          </p>
          {data?.last_synced_at && (
            <p>Last synced {syncTime.format(new Date(data.last_synced_at))}</p>
          )}
        </footer>
      </section>
    </article>
  )
}
