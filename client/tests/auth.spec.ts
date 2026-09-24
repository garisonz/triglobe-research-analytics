import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

const password = "a thoughtful research password"
const newEmail = () => `research-${randomUUID()}@example.com`

async function register(page: Page, email: string) {
  await page.goto("/sign-up")
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill(password)
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await expect(page.getByRole("status")).toContainText("Your account is ready")
}

async function signIn(page: Page, email: string) {
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true })
  ).toBeVisible()
}

test("registration, deep-link return, cookie persistence, account identity, and logout", async ({
  page,
  context,
}) => {
  const email = newEmail()
  await page.goto("/stocks/AAPL?view=overview")
  await expect(page).toHaveURL(/\/sign-in$/)
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click()
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill(password)
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await expect(page.getByRole("status")).toContainText("Your account is ready")
  await signIn(page, email)
  await expect(page).toHaveURL(/\/stocks\/AAPL\?view=overview$/)
  await page.reload()
  await expect(page.getByRole("heading", { name: "AAPL" })).toBeVisible()
  const cookies = await context.cookies()
  expect(
    cookies.find((cookie) => cookie.name === "triglobe_session")
  ).toMatchObject({ httpOnly: true, sameSite: "Lax" })
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "triglobe_session"
  )
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
  await page.getByRole("link", { name: "Settings", exact: true }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto("/settings")
  await expect(page).toHaveURL(/\/sign-in$/)
  expect((await page.request.get("/api/auth/me")).status()).toBe(401)
})

test("duplicate account and wrong password are reported without opening the workspace", async ({
  page,
}) => {
  const email = newEmail()
  await register(page, email)
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Create an account", exact: true })
  ).toBeVisible()
  await page.getByLabel("Email address").fill(email.toUpperCase())
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill(password)
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await expect(page.getByRole("alert")).toContainText("already exists")
  await page.getByRole("link", { name: "Sign in", exact: true }).last().click()
  await expect(
    page.getByRole("heading", { name: "Sign in to Triglobe", exact: true })
  ).toBeVisible()
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill("wrong password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText(
    "Invalid email or password"
  )
  await expect(page).toHaveURL(/\/sign-in$/)
})

test("confirmation errors and password visibility work on mobile without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/sign-up")
  await page.getByLabel("Email address").fill(newEmail())
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill("different long password")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await expect(page.getByRole("alert")).toContainText("don't match")
  await expect(page.getByLabel("Confirm password")).toBeFocused()
  await page.getByRole("button", { name: "Show password", exact: true }).click()
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text"
  )
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }).first()
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})

test("session-check failures have a retry and never display private content", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 503, json: { detail: "Database unavailable" } })
  )
  await page.goto("/home")
  await expect(page.getByRole("alert")).toContainText(
    "couldn't check your session"
  )
  await expect(
    page.getByRole("heading", { name: "Start with a question." })
  ).toHaveCount(0)
  await page.unroute("**/api/auth/me")
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
})

test("a revoked session is detected when returning to the tab", async ({
  page,
}) => {
  const email = newEmail()
  await register(page, email)
  await signIn(page, email)
  const response = await page.request.post("/api/auth/logout", {
    headers: { Origin: "http://localhost:5174" },
  })
  expect(response.status()).toBe(204)
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(page).toHaveURL(/\/sign-in$/)
})

test("failed sign-out keeps the session visible and allows a retry", async ({
  page,
}) => {
  const email = newEmail()
  await register(page, email)
  await signIn(page, email)
  await page.route("**/api/auth/logout", (route) => route.abort())
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Unable to reach")
  await expect(
    page.getByRole("heading", { name: "Start with a question." })
  ).toBeVisible()
  await page.unroute("**/api/auth/logout")
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
})
