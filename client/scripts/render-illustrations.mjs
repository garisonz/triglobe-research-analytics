// Re-export the editable minimal SVGs as PNGs. Run from client/ with Playwright installed.
// Pass asset names to render a subset, or omit them to render the complete set.
import { chromium } from "playwright"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const directory = fileURLToPath(
  new URL("../public/images/minimal/", import.meta.url)
)
const supplied = process.argv.slice(2)
const names = supplied.length
  ? supplied
  : (await readdir(path.join(directory, "sources")))
      .filter((name) => name.endsWith(".svg"))
      .map((name) => name.slice(0, -4))
const browser = await chromium.launch({ headless: true })
try {
  for (const name of names) {
    if (!/^[a-z-]+$/.test(name)) throw new Error(`Invalid asset name: ${name}`)
    const svg = await readFile(
      path.join(directory, "sources", `${name}.svg`),
      "utf8"
    )
    const dimensions = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
    if (!dimensions) throw new Error(`Missing viewBox dimensions: ${name}`)
    const [, width, height] = dimensions.map(Number)
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    })
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`
    )
    await page.screenshot({
      path: path.join(directory, `${name}.png`),
      omitBackground: true,
    })
    await page.close()
    console.log(`Rendered ${name}.png (${width} × ${height})`)
  }
} finally {
  await browser.close()
}
