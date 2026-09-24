import { expect, test } from "@playwright/test"

test("desktop lens navigation resolves cross-page anchors by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/sign-in")
  const link = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Politics", exact: true })
  await link.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/#politics$/)
  await expect(
    page.getByRole("heading", { name: "Politics", exact: true })
  ).toBeInViewport()
  await expect(link).toHaveAttribute("aria-current", "location")
})
for (const width of [375, 320]) {
  test(`mobile navigation works without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 })
    await page.goto("/sign-in")
    const menu = page.locator(".menu-toggle")
    await menu.click()
    await expect(menu).toHaveAttribute("aria-expanded", "true")
    await page.keyboard.press("Escape")
    await expect(menu).toHaveAttribute("aria-expanded", "false")
    await expect(menu).toBeFocused()

    await menu.click()
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Politics", exact: true })
      .click()
    await expect(page).toHaveURL(/\/#politics$/)
    await expect(menu).toHaveAttribute("aria-expanded", "false")
    await expect(
      page.getByRole("heading", { name: "Politics", exact: true })
    ).toBeInViewport()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)

    // Visit each lazy image so the check includes the lens illustrations.
    for (const image of await page.locator("main img").all()) {
      await image.scrollIntoViewIfNeeded()
      await expect
        .poll(() =>
          image.evaluate(
            (element: HTMLImageElement) =>
              element.complete &&
              element.naturalWidth > 0 &&
              element.alt.length > 0
          )
        )
        .toBe(true)
    }
  })
}

test("scroll progress responds while reduced motion disables hero motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }))
  await expect
    .poll(() =>
      page
        .locator(".hero-globe")
        .evaluate((element: HTMLElement) =>
          parseFloat(element.style.getPropertyValue("--parallax-y"))
        )
    )
    .toBeGreaterThan(0)
  await expect
    .poll(() =>
      page
        .locator(".scroll-indicator")
        .evaluate((element: HTMLElement) =>
          Number(element.style.getPropertyValue("--scroll-progress"))
        )
    )
    .toBeGreaterThan(0)

  // A preference change must stop motion without requiring a page reload.
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect
    .poll(() =>
      page
        .locator("[data-parallax]")
        .evaluateAll((elements) =>
          elements.every(
            (element) =>
              parseFloat(
                (element as HTMLElement).style.getPropertyValue("--parallax-y")
              ) === 0
          )
        )
    )
    .toBe(true)
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().length))
    .toBe(0)
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "instant",
    })
  )
  await expect
    .poll(() =>
      page
        .locator(".scroll-indicator")
        .evaluate((element: HTMLElement) =>
          Number(element.style.getPropertyValue("--scroll-progress"))
        )
    )
    .toBe(1)
})
