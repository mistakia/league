import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { chromium } from 'playwright-core'

// Renders every Open Graph card in scripts/social-cards/ to a PNG under
// static/images/social/. The cards are HTML because the site's own type and
// palette are CSS — a card authored any other way drifts from the product it
// is advertising, which is how the previous single card ended up being a
// screenshot nobody could re-make.
//
// Output is COMMITTED. The API serves static/ straight off the checkout
// (api/index.mjs), nothing builds it, so the PNGs ship with `yarn deploy`
// rather than `yarn deploy:dist`.
//
// Render host matters for one card: the constitution card uses the same
// system-serif stack the constitution page declares ($markdown_serif, no
// webfont by design), so whichever machine runs this bakes in its own
// resolution of that stack. Generate on macOS, where it resolves to Iowan Old
// Style, which is what the page's own readers see.
//
// main() is called bare rather than through is_main: this is invoked by hand,
// is_main compares process.argv[1] verbatim, and a relative-path invocation
// would otherwise exit 0 having done nothing.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templates_dir = path.join(__dirname, 'social-cards')
const output_dir = path.join(__dirname, '..', 'static', 'images', 'social')

// Open Graph's expected card size, and the one app/index.html hardcodes as
// og:image:width / og:image:height. Every template is authored against it.
const card_width = 1200
const card_height = 630

const cards = [
  {
    name: 'league-front-door',
    template: 'league-front-door.html'
  },
  {
    name: 'constitution',
    template: 'constitution.html'
  },
  {
    name: 'data-views',
    template: 'data-views.html'
  },
  {
    name: 'plays',
    template: 'plays.html'
  },
  {
    name: 'glossary',
    template: 'glossary.html'
  },
  {
    name: 'resources',
    template: 'resources.html'
  },
  {
    name: 'league-surface',
    template: 'league-surface.html'
  },
  {
    name: 'waitlist',
    template: 'waitlist.html'
  },
  {
    name: 'default',
    template: 'default.html'
  }
]

const render_card = async ({ browser, card }) => {
  const template_path = path.join(templates_dir, card.template)
  if (!fs.existsSync(template_path)) {
    throw new Error(`template not found: ${template_path}`)
  }

  const page = await browser.newPage({
    viewport: { width: card_width, height: card_height },
    deviceScaleFactor: 1
  })

  try {
    await page.goto(`file://${template_path}`, { waitUntil: 'networkidle' })

    // The webfonts are fetched over the network, and a card rendered before
    // they land silently falls back to a system face — a wrong card that looks
    // like a right one. Fail rather than ship that.
    await page.waitForFunction(() => document.fonts.status === 'loaded', null, {
      timeout: 15000
    })

    const output_path = path.join(output_dir, `${card.name}.png`)
    await page.screenshot({ path: output_path })

    const { size } = fs.statSync(output_path)
    console.log(`${card.name}.png  ${(size / 1024).toFixed(1)}kb`)
  } finally {
    await page.close()
  }
}

const main = async () => {
  const requested = process.argv.slice(2)
  const selected = requested.length
    ? cards.filter((card) => requested.includes(card.name))
    : cards

  if (!selected.length) {
    throw new Error(
      `no card matched ${requested.join(', ')} — known: ${cards
        .map((card) => card.name)
        .join(', ')}`
    )
  }

  fs.mkdirSync(output_dir, { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome' })

  try {
    for (const card of selected) {
      await render_card({ browser, card })
    }
  } finally {
    await browser.close()
  }

  console.log(`\nwrote ${selected.length} card(s) to ${output_dir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
