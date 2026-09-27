import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

test.use({ timezoneId: "America/Los_Angeles" })

const instrument = {
  symbol: "AAPL",
  name: "Apple Inc.",
  asset_type: "EQUITY",
  exchange: "NASDAQ",
  last_synced_at: "2026-09-26T10:00:00Z",
  candle_count: 3,
}
const company = {
  id: "bd6951c6-e7fb-438e-832b-c38ced5d7018",
  company_id: "5deab8df-0fc2-4f06-9bb4-33016809ae26",
  cik: "0000320193",
  symbol: "AAPL",
  yahoo_symbol: "AAPL",
  name: "Apple Inc.",
  exchange: "NASDAQ",
  currency: "USD",
  sector: "Technology",
  industry: "Consumer Electronics",
  gics_sector: "Information Technology",
  gics_sub_industry: "Technology Hardware, Storage & Peripherals",
  is_sp500: true,
  catalog_synced_at: "2026-09-26T10:00:00Z",
  profile_synced_at: "2026-09-26T11:00:00Z",
  candle_count: 3,
  description: "Apple designs consumer devices and software.",
  website: "https://www.apple.com",
  country: "United States",
}

const candles = [
  {
    time: "2026-09-23T04:00:00Z",
    open: 200,
    high: 204,
    low: 199,
    close: 202,
    volume: 1200,
  },
  {
    time: "2026-09-24T04:00:00Z",
    open: 202,
    high: 208,
    low: 201,
    close: 206,
    volume: 1500,
  },
  {
    time: "2026-09-25T04:00:00Z",
    open: 206,
    high: 212,
    low: 205,
    close: 210,
    volume: 2300,
  },
]
const history = {
  instrument,
  interval: "1d",
  range: "1y",
  candles,
  source: "Example Market Data",
  last_synced_at: instrument.last_synced_at,
}

async function authenticate(page: Page) {
  await page.route("**/api/market/catalog/*", (route) =>
    route.fulfill(
      new URL(route.request().url()).pathname.endsWith("/AAPL")
        ? { json: company }
        : { status: 404, json: { detail: "Company not found" } }
    )
  )

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "researcher",
        email: "researcher@example.com",
        created_at: "2026-01-01T00:00:00Z",
      },
    })
  )
}

test("stored daily prices load, retain exchange dates, and support range and keyboard inspection", async ({
  page,
}) => {
  await authenticate(page)
  const requests: string[] = []
  await page.route("**/api/market/history/AAPL?*", (route) => {
    const range = new URL(route.request().url()).searchParams.get("range")!
    requests.push(range)
    return route.fulfill({ json: { ...history, range } })
  })
  await page.goto("/stocks/AAPL")
  await expect(
    page.getByRole("img", { name: "AAPL historical daily closing prices" })
  ).toBeVisible()
  await expect(page.locator(".stock-price")).toHaveText("$210.00")
  await expect(page.locator(".stock-change")).toContainText("+$4.00 (+1.94%)")
  await expect(page.locator(".stock-candle-date dd")).toHaveText("Sep 25, 2026")
  await expect(page.locator(".stock-history-footer")).toContainText(
    "Not live prices"
  )
  await expect(page.locator(".stock-history-footer")).toContainText(
    "Source: Example Market Data"
  )
  const slider = page.getByRole("slider", { name: "Inspect a session" })
  await slider.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(slider).toHaveAttribute(
    "aria-valuetext",
    "Sep 24, 2026, close $206.00"
  )
  await expect(page.locator(".stock-candle-details")).toContainText("1,500")
  await page.getByRole("button", { name: "1M", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "1M", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(slider).toHaveAttribute(
    "aria-valuetext",
    "Sep 25, 2026, close $210.00"
  )
  expect([...new Set(requests)]).toEqual(["1y", "1m"])
  await page.screenshot({
    path: "test-results/historical-chart-desktop.png",
    fullPage: true,
  })
})

test("history failures allow retry and empty history is explicit", async ({
  page,
}) => {
  await authenticate(page)
  let failed = true
  await page.route("**/api/market/history/AAPL?*", (route) =>
    route.fulfill(
      failed
        ? { status: 503, json: { detail: "Unavailable" } }
        : { json: { ...history, candles: [], last_synced_at: null } }
    )
  )
  await page.goto("/stocks/AAPL")
  await expect(page.getByRole("alert")).toContainText(
    "Historical prices couldn't be loaded."
  )
  await expect(page.locator(".stock-history-footer")).toContainText(
    "Historical market data"
  )
  await expect(page.locator(".stock-history-footer")).not.toContainText(
    "Source:"
  )
  failed = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(
    page.locator(".stock-history").getByRole("status")
  ).toContainText("No historical data for this range.")
  await expect(
    page.getByRole("img", { name: /historical daily closing prices/ })
  ).toHaveCount(0)
  await expect(page.locator(".stock-price")).toHaveCount(0)
})

test("unknown symbols return a company catalog link", async ({ page }) => {
  await authenticate(page)
  await page.route("**/api/market/history/UNKNOWN?*", (route) =>
    route.fulfill({ status: 404, json: { detail: "Instrument not found" } })
  )
  await page.goto("/stocks/UNKNOWN")
  await expect(page.getByRole("alert")).toContainText(
    "No price history is available for this symbol"
  )
  await expect(
    page.getByRole("link", { name: "View company catalog" })
  ).toHaveAttribute("href", "/home")
})

test("catalog supports company-name search, sectors, and pagination without implying a personal watchlist", async ({
  page,
}) => {
  await authenticate(page)
  const listings = [
    company,
    { ...company, id: "msft", symbol: "MSFT", name: "Microsoft Corporation" },
    {
      ...company,
      id: "jpm",
      symbol: "JPM",
      name: "JPMorgan Chase & Co.",
      exchange: "NYSE",
      sector: "Financials",
      gics_sector: "Financials",
      candle_count: 0,
    },
    ...Array.from({ length: 23 }, (_, index) => ({
      ...company,
      id: `fixture-${index}`,
      symbol: `TEST${index}`,
      name: `Example Company ${index}`,
    })),
  ]
  const requests: URLSearchParams[] = []
  await page.route("**/api/market/catalog?*", (route) => {
    const params = new URL(route.request().url()).searchParams
    requests.push(params)
    const q = (params.get("q") ?? "").toLowerCase()
    const sector = params.get("sector")
    const filtered = listings.filter(
      (item) =>
        (!q ||
          item.name.toLowerCase().includes(q) ||
          item.symbol.toLowerCase().includes(q)) &&
        (!sector || (item.sector || item.gics_sector) === sector)
    )
    const offset = Number(params.get("offset"))
    const limit = Number(params.get("limit"))
    return route.fulfill({
      json: {
        instruments: filtered.slice(offset, offset + limit),
        total: filtered.length,
        sectors: ["Technology", "Financials"],
      },
    })
  })
  await page.goto("/home")
  await expect(
    page.getByRole("heading", { name: "Company catalog" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: /AAPL Apple Inc./ })
  ).toHaveAttribute("href", "/stocks/AAPL")
  await expect(page.getByRole("link", { name: /JPM JPMorgan/ })).toContainText(
    "Price history not imported"
  )
  await expect(page.locator(".home-pagination")).toContainText(
    "1–24 of 26 listings"
  )
  await page.screenshot({
    path: "test-results/company-catalog-desktop.png",
    fullPage: true,
  })
  await page.setViewportSize({ width: 320, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: "test-results/company-catalog-mobile.png",
    fullPage: true,
  })
  await page.setViewportSize({ width: 1280, height: 720 })

  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page.locator(".home-pagination")).toContainText(
    "25–26 of 26 listings"
  )
  await expect(
    page.getByRole("button", { name: "Next", exact: true })
  ).toBeDisabled()
  await expect(page.getByRole("link", { name: /AAPL Apple Inc./ })).toHaveCount(
    0
  )
  await page.getByLabel("Sector", { exact: true }).selectOption("Financials")
  await expect(page.locator(".home-pagination")).toContainText(
    "1–1 of 1 listings"
  )
  await expect(
    page.getByRole("button", { name: "Previous", exact: true })
  ).toBeDisabled()
  await expect(page.locator(".home-company-card")).toHaveCount(1)
  await page.getByRole("button", { name: "Clear filters" }).click()
  await page
    .getByRole("searchbox", { name: "Company name or ticker" })
    .fill("Apple")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(page.locator(".home-company-card")).toHaveCount(1)
  await expect(
    page.getByRole("link", { name: /AAPL Apple Inc./ })
  ).toBeVisible()
  await page
    .getByRole("searchbox", { name: "Company name or ticker" })
    .fill("MSFT")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(page.getByRole("link", { name: /MSFT Microsoft/ })).toBeVisible()
  expect(requests.every((params) => params.get("sp500_only") === "true")).toBe(
    true
  )
  expect(requests.some((params) => params.get("offset") === "24")).toBe(true)
  expect(
    requests.some(
      (params) =>
        params.get("sector") === "Financials" && params.get("offset") === "0"
    )
  ).toBe(true)
})

test("catalog failures retry and empty catalog differs from no search results", async ({
  page,
}) => {
  await authenticate(page)
  let fail = true
  await page.route("**/api/market/catalog?*", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { detail: "Unavailable" } }
        : { json: { instruments: [], total: 0, sectors: [] } }
    )
  )
  await page.goto("/home")
  await expect(page.getByRole("alert")).toContainText(
    "The company catalog could not be loaded."
  )
  fail = false
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.locator(".home-catalog-state")).toContainText(
    "has not been populated yet"
  )
  await page
    .getByRole("searchbox", { name: "Company name or ticker" })
    .fill("Unknown")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(page.locator(".home-catalog-state")).toContainText(
    "No companies match these filters"
  )
})

test("company information loads independently before any historical prices", async ({
  page,
}) => {
  await authenticate(page)
  await page.setViewportSize({ width: 320, height: 812 })
  await page.route("**/api/market/catalog/AAPL", (route) =>
    route.fulfill({ json: { ...company, candle_count: 0 } })
  )
  let releaseHistory!: () => void
  const pendingHistory = new Promise<void>((resolve) => {
    releaseHistory = resolve
  })
  await page.route("**/api/market/history/AAPL?*", async (route) => {
    await pendingHistory
    await route.fulfill({
      json: { ...history, candles: [], last_synced_at: null },
    })
  })
  await page.goto("/stocks/AAPL")
  await expect(page.locator(".stock-name")).toHaveText("Apple Inc.")
  await expect(
    page.getByRole("region", { name: "Company overview" })
  ).toContainText("Technology")
  await expect(page.locator(".stock-company-details")).toContainText(
    "0000320193"
  )
  await expect(
    page.getByRole("link", { name: /www.apple.com/ })
  ).toHaveAttribute("href", "https://www.apple.com/")
  await expect(
    page.locator(".stock-history").getByRole("status")
  ).toContainText("Loading historical prices")
  releaseHistory()
  await expect(
    page.locator(".stock-history").getByRole("status")
  ).toContainText("Price history has not been imported yet.")
  await expect(page.locator(".stock-price")).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: "test-results/company-profile-mobile.png",
    fullPage: true,
  })
})

test("legacy instruments keep their chart when no company profile exists", async ({
  page,
}) => {
  await authenticate(page)
  await page.route("**/api/market/history/SPY?*", (route) =>
    route.fulfill({
      json: {
        ...history,
        instrument: { ...instrument, symbol: "SPY", name: "SPDR S&P 500 ETF" },
      },
    })
  )
  await page.goto("/stocks/SPY")
  await expect(
    page.getByRole("img", { name: "SPY historical daily closing prices" })
  ).toBeVisible()
  await expect(page.locator(".stock-name")).toHaveText("SPDR S&P 500 ETF")
  await expect(page.locator(".stock-profile")).toHaveCount(0)
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("single-session history renders on narrow screens without an invalid chart or overflow", async ({
  page,
}) => {
  await authenticate(page)
  await page.setViewportSize({ width: 320, height: 812 })
  await page.route("**/api/market/history/AAPL?*", (route) =>
    route.fulfill({ json: { ...history, candles: [candles[0]] } })
  )
  await page.goto("/stocks/AAPL")
  await expect(
    page.getByRole("img", { name: "AAPL historical daily closing prices" })
  ).toBeVisible()
  await expect(page.getByRole("slider")).toBeDisabled()
  await expect(page.locator(".stock-change")).toHaveCount(0)
  expect(await page.locator(".stock-chart-line").getAttribute("d")).not.toMatch(
    /NaN|Infinity/
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: "test-results/historical-chart-mobile.png",
    fullPage: true,
  })
})

test("range changes discard an earlier request and show loading until the selected range arrives", async ({
  page,
}) => {
  await authenticate(page)
  let releaseInitial!: () => void
  const waitForRelease = new Promise<void>((resolve) => {
    releaseInitial = resolve
  })
  await page.route("**/api/market/history/AAPL?*", async (route) => {
    const range = new URL(route.request().url()).searchParams.get("range")
    if (range === "1y") await waitForRelease
    await route
      .fulfill({
        json: {
          ...history,
          range,
          candles: range === "1m" ? [candles[0]] : candles,
        },
      })
      .catch(() => {})
  })
  await page.goto("/stocks/AAPL")
  await expect(
    page.locator(".stock-history").getByRole("status")
  ).toContainText("Loading historical prices")
  await expect(page.locator(".stock-history-footer")).toContainText(
    "Historical market data"
  )
  await page.getByRole("button", { name: "1M", exact: true }).click()
  await expect(page.locator(".stock-price")).toHaveText("$202.00")
  releaseInitial()
  await expect(
    page.getByRole("button", { name: "1M", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".stock-price")).toHaveText("$202.00")
})
