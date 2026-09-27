import type { FormEvent } from "react"
import { ArrowUpRight, Search } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { useMarketData } from "../lib/market"
import type { CatalogResponse } from "../lib/market"
import "./HomePage.css"

const pageSize = 24

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get("q")?.trim() ?? ""
  const sector = searchParams.get("sector") ?? ""
  const requestedPage = Number(searchParams.get("page") ?? "1")
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const offset = (page - 1) * pageSize
  const parameters = new URLSearchParams({
    sp500_only: "true",
    limit: String(pageSize),
    offset: String(offset),
  })
  if (query) parameters.set("q", query)
  if (sector) parameters.set("sector", sector)
  const { result, retry } = useMarketData<CatalogResponse>(
    `/market/catalog?${parameters}`
  )
  const catalog = result?.status === "ready" ? result.data : null
  const companies = catalog?.instruments ?? []
  const sectors = [...new Set([sector, ...(catalog?.sectors ?? [])])].filter(
    Boolean
  )

  function updateFilters(nextQuery: string, nextSector: string, nextPage = 1) {
    const next = new URLSearchParams()
    if (nextQuery) next.set("q", nextQuery)
    if (nextSector) next.set("sector", nextSector)
    if (nextPage > 1) next.set("page", String(nextPage))
    setSearchParams(next)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    updateFilters(String(form.get("q") ?? "").trim(), sector)
  }

  return (
    <div className="home-page">
      <section className="home-intro" aria-labelledby="home-title">
        <p className="home-eyebrow">Company research</p>
        <h1 id="home-title" className="home-title">
          Explore the S&P 500.
        </h1>
        <p className="home-intro-copy">
          Find a business, understand what it does, and explore its stored daily
          prices.
        </p>
      </section>
      <section className="home-search" aria-label="Filter company catalog">
        <form className="home-search-form" onSubmit={handleSearch}>
          <label htmlFor="company-search">Company name or ticker</label>
          <div className="home-search-controls">
            <div className="home-search-input">
              <Search size={18} aria-hidden="true" />
              <input
                key={query}
                id="company-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="e.g. Apple or AAPL"
                maxLength={100}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button className="home-search-button" type="submit">
              Search
            </button>
          </div>
        </form>
        <div className="home-sector-filter">
          <label htmlFor="company-sector">Sector</label>
          <select
            id="company-sector"
            value={sector}
            disabled={!result}
            onChange={(event) => updateFilters(query, event.target.value)}
          >
            <option value="">All sectors</option>
            {sectors.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </section>
      <section
        className="home-companies"
        aria-labelledby="companies-title"
        aria-busy={!result}
      >
        <div className="home-section-heading">
          <h2 id="companies-title">Company catalog</h2>
          <span className="home-section-caption">Current S&P 500 listings</span>
        </div>
        {(query || sector) && (
          <div className="home-active-filters">
            <p>
              {query ? `Results for “${query}”` : "All companies"}
              {sector ? ` · ${sector}` : ""}
            </p>
            <button type="button" onClick={() => updateFilters("", "")}>
              Clear filters
            </button>
          </div>
        )}
        {!result && (
          <p className="home-catalog-state" role="status">
            Loading company catalog…
          </p>
        )}
        {result?.status === "error" && (
          <div className="home-catalog-state" role="alert">
            <p>The company catalog could not be loaded.</p>
            <button
              className="home-search-button"
              type="button"
              onClick={retry}
            >
              Try again
            </button>
          </div>
        )}
        {catalog && !companies.length && (
          <p className="home-catalog-state" role="status">
            {page > 1
              ? "No companies on this page. Return to a previous page or clear the filters."
              : query || sector
                ? "No companies match these filters. Try another name, ticker, or sector."
                : "The S&P 500 company catalog has not been populated yet."}
          </p>
        )}
        <div className="home-company-grid">
          {companies.map((company) => (
            <Link
              className="home-company-card"
              to={`/stocks/${encodeURIComponent(company.symbol)}`}
              key={company.id}
            >
              <div className="home-company-card-top">
                <span className="home-ticker">{company.symbol}</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </div>
              <h3>{company.name}</h3>
              <p>
                {company.sector || company.gics_sector || "Sector unavailable"}
              </p>
              <p className="home-company-meta">
                {company.exchange || "Exchange unavailable"} ·{" "}
                {company.candle_count
                  ? `${company.candle_count.toLocaleString()} daily prices`
                  : "Price history not imported"}
              </p>
            </Link>
          ))}
        </div>
        {catalog && (
          <nav className="home-pagination" aria-label="Company catalog pages">
            <p role="status">
              {companies.length
                ? `${offset + 1}–${offset + companies.length} of ${catalog.total.toLocaleString()} listings`
                : `${catalog.total.toLocaleString()} listings`}
            </p>
            <div>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => updateFilters(query, sector, page - 1)}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                disabled={offset + pageSize >= catalog.total}
                onClick={() => updateFilters(query, sector, page + 1)}
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </section>
      <aside className="home-note">
        <p>
          Company profiles and price history are imported separately. A company
          can appear here before its historical prices are available.
        </p>
      </aside>
    </div>
  )
}
