import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowUpRight, Search } from "lucide-react"
import { Link, useNavigate } from "react-router"

const companies = [
  { symbol: "AAPL", name: "Apple", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA", sector: "Semiconductors" },
]

export default function HomePage() {
  const [symbol, setSymbol] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ticker = symbol.trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker)) {
      setError("Enter a ticker such as AAPL, MSFT, or BRK.B.")
      return
    }
    navigate(`/stocks/${encodeURIComponent(ticker)}`)
  }

  return (
    <div className="home-page">
      <section className="home-intro" aria-labelledby="home-title">
        <p className="eyebrow">
          <span className="status-dot" /> Your research workspace
        </p>
        <h1 id="home-title">Start with a question.</h1>
        <p className="intro-copy">
          Make room for a little perspective. What will you explore today?
        </p>
      </section>
      <section className="search-panel" aria-labelledby="search-title">
        <div>
          <p className="eyebrow">Company research</p>
          <h2 id="search-title">Find your starting point.</h2>
          <p>Open a company workspace using its stock ticker.</p>
        </div>
        <form className="company-search" onSubmit={handleSearch} noValidate>
          <label htmlFor="company-symbol">Stock ticker</label>
          <div className="search-controls">
            <div className="search-input-wrap">
              <Search size={18} aria-hidden="true" />
              <input
                id="company-symbol"
                name="symbol"
                type="text"
                value={symbol}
                onChange={(event) => {
                  setSymbol(event.target.value)
                  setError("")
                }}
                placeholder="e.g. AAPL"
                maxLength={15}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "search-error" : "search-hint"}
              />
            </div>
            <button className="button button-primary" type="submit">
              Explore <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </div>
          <p id="search-hint" className="field-hint">
            Company pages are a preview. Live data is not connected yet.
          </p>
          {error && (
            <p id="search-error" className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
      <section className="company-section" aria-labelledby="companies-title">
        <div className="section-heading inline-heading">
          <h2 id="companies-title">A few places to begin</h2>
          <span className="section-caption">Company shortcuts</span>
        </div>
        <div className="company-grid">
          {companies.map(({ symbol: ticker, name, sector }) => (
            <Link
              className="company-card"
              to={`/stocks/${ticker}`}
              key={ticker}
            >
              <div className="company-card-top">
                <span className="ticker">{ticker}</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </div>
              <h3>{name}</h3>
              <p>{sector}</p>
            </Link>
          ))}
        </div>
      </section>
      <aside className="workspace-note">
        <span className="note-mark" aria-hidden="true">
          ↗
        </span>
        <p>
          <strong>A wider lens.</strong> Good research connects companies with
          the politics and nations around them.
        </p>
        <Link className="text-link" to="/">
          About Triglobe <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </aside>
    </div>
  )
}
