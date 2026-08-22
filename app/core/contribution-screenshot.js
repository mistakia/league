// Renders the page the submitter is looking at into a JPEG.
//
// WHY THIS IS HAND-ROLLED RATHER THAN A LIBRARY. The foreignObject-based
// capture packages (modern-screenshot, @zumer/snapdom) exist to solve a
// fidelity tail this app does not have. Measured against production on
// 2026-08-22, before any of this was written:
//
//   - Shadow DOM, <canvas>, <iframe> and CSS url() references: ZERO
//     occurrences in app/. Charts are Highcharts SVG and icons are inline MUI
//     SVG, both of which serialize natively.
//   - Pseudo-elements: one decorative `content: ''` rule (app/styles/tabs.styl).
//   - Web fonts: the ONLY real gap, and it is 0.34%. Both the name and the
//     number cells compute to `"IBM Plex Mono", monospace`, and real Plex
//     against the generic monospace fallback measures 100.80px vs 101.14px on
//     the same string. Column widths are fixed, so nothing reflows and nothing
//     clips. A full hand-rolled capture of a 2662-cell data view came back
//     pixel-faithful with all 75 team logos inlined and zero failures.
//
// Against that, a package that by construction reads the entire DOM -- a
// logged-in user's league, team and account surfaces included -- is a
// permanent supply-chain surface bought for a third of a percent. If the font
// difference ever starts to matter, note that inlining IS available and cheap:
// fonts.googleapis.com and fonts.gstatic.com both send CORS headers, so
// fetching the stylesheet, rewriting each url() to a base64 woff2 and
// appending it to the <style> below is about twenty lines. It was proven to
// work and then deliberately left out, because 75 KB of font bytes in every
// bug report is a worse trade than the fallback.

// The capture is bounded on both axes before it is bounded on bytes. A tall
// page would otherwise produce a strip that is unreadable at any quality the
// budget permits.
export const MAXIMUM_SCREENSHOT_WIDTH = 1200
export const MAXIMUM_SCREENSHOT_HEIGHT = 900

// Decoded JPEG bytes. The image no longer travels inside captured_context --
// it goes to contribution_screenshots as bytea -- so this budget is its own
// and is not competing with the redux snapshot for the JSONB ceiling.
export const MAXIMUM_SCREENSHOT_BYTES = 600000

// Tried in order until one fits the budget. Quality falls first because a
// smaller image of the whole page beats a sharp image of part of it: the
// submitter framed the report around what is on screen.
export const SCREENSHOT_QUALITY_LADDER = Object.freeze([0.75, 0.6, 0.45, 0.3])

// Excluded from the capture because they are the reporting UI itself, not the
// thing being reported. Without this the screenshot is a picture of the dialog
// the submitter is typing into.
const EXCLUDED_SELECTOR =
  '.contribution-dialog, .MuiDialog-root, .MuiBackdrop-root, .MuiPopover-root, .MuiTooltip-popper'

// Base64 padding aside, a data URI carries 4 characters per 3 bytes. Measuring
// the decoded size means the budget is stated in the units the bytea column
// actually stores, rather than in transport characters.
export const decoded_byte_length = (data_uri) => {
  const comma = data_uri.indexOf(',')
  if (comma === -1) return 0
  const payload = data_uri.slice(comma + 1)
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.floor((payload.length * 3) / 4) - padding
}

// EVERY cross-origin image must be inlined as a data URI first, or the canvas
// is tainted and toDataURL throws a SecurityError. a.espncdn.com is the only
// cross-origin image origin in the SPA -- headshots and team logos both come
// from the one combiner endpoint in app/core/utils/player-image.js -- and it
// answers with `access-control-allow-origin: *`, which is what makes the CORS
// fetch legal. The negative control matters here: drawing the same image
// WITHOUT the fetch throws, so a green from this path is not vacuous.
//
// credentials are omitted deliberately. These are public assets and an
// image request that carried the session cookie would be a wider request than
// the page itself makes.
const inline_images = async (root) => {
  const images = Array.from(root.querySelectorAll('img'))
  const by_source = new Map()

  await Promise.all(
    images.map(async (image) => {
      const source = image.src
      if (!source || source.startsWith('data:')) return

      if (!by_source.has(source)) {
        by_source.set(
          source,
          (async () => {
            const response = await window.fetch(source, {
              mode: 'cors',
              credentials: 'omit'
            })
            if (!response.ok) throw new Error(`image ${response.status}`)
            const blob = await response.blob()
            return await new Promise((resolve, reject) => {
              const reader = new window.FileReader()
              reader.onload = () => resolve(reader.result)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
          })()
        )
      }

      try {
        image.src = await by_source.get(source)
      } catch (_error) {
        // ONE image failing must not cost the whole screenshot. A missing
        // logo is a cosmetic hole; a thrown capture is no screenshot at all.
        image.removeAttribute('src')
      }
    })
  )
}

// The Google Fonts stylesheet is cross-origin, so reading its cssRules throws
// SecurityError -- which is why no @font-face rule reaches the clone and the
// capture renders in the fallback. Every same-origin sheet is readable and is
// what carries the layout, the colors and the conditional formatting.
const read_document_css = () => {
  let css = ''
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += `${rule.cssText}\n`
    } catch (_error) {
      // Cross-origin sheet. Expected, and not worth reporting.
    }
  }
  return css
}

const draw_to_canvas = ({ svg_markup, width, height, scale }) =>
  new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const context = canvas.getContext('2d')
      // JPEG has no alpha, so an unpainted background encodes as black rather
      // than as the page's white.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas)
    }
    image.onerror = () => reject(new Error('svg rasterization failed'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      svg_markup
    )}`
  })

/**
 * Capture the current page as a JPEG data URI.
 *
 * Returns null on any failure. NOTHING HERE MAY THROW INTO THE SUBMIT PATH --
 * a report that fails to send because its screenshot could not be rendered is
 * strictly worse than a report with no screenshot, which is the same contract
 * every field in contribution-context.js holds to.
 */
export const capture_screenshot = async ({
  target = null,
  maximum_bytes = MAXIMUM_SCREENSHOT_BYTES
} = {}) => {
  try {
    if (typeof window === 'undefined' || !document.body) return null

    const element = target || document.body
    const bounds = element.getBoundingClientRect()
    const width = Math.min(
      Math.ceil(bounds.width) || window.innerWidth,
      MAXIMUM_SCREENSHOT_WIDTH
    )
    const height = Math.min(
      Math.ceil(bounds.height) || window.innerHeight,
      MAXIMUM_SCREENSHOT_HEIGHT
    )
    if (width < 1 || height < 1) return null

    const clone = element.cloneNode(true)
    for (const node of clone.querySelectorAll(EXCLUDED_SELECTOR)) {
      node.remove()
    }
    await inline_images(clone)

    // xmlns on the wrapper is load-bearing: the serialized markup is parsed as
    // XML inside the foreignObject, and without the XHTML namespace the whole
    // subtree renders as nothing at all.
    const wrapper = document.createElement('div')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
    wrapper.style.cssText = `background:#ffffff;width:${width}px;`

    const style = document.createElement('style')
    style.textContent = read_document_css()
    wrapper.appendChild(style)
    wrapper.appendChild(clone)

    const svg_markup =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      '<foreignObject width="100%" height="100%">' +
      new window.XMLSerializer().serializeToString(wrapper) +
      '</foreignObject></svg>'

    // Rasterized once at full size; only the JPEG encode is repeated per
    // quality step, which is the cheap half.
    const canvas = await draw_to_canvas({
      svg_markup,
      width,
      height,
      scale: 1
    })

    for (const quality of SCREENSHOT_QUALITY_LADDER) {
      const data_uri = canvas.toDataURL('image/jpeg', quality)
      if (decoded_byte_length(data_uri) <= maximum_bytes) return data_uri
    }

    // Every quality step was still too large, so the last resort is fewer
    // pixels rather than a refusal.
    const halved = await draw_to_canvas({
      svg_markup,
      width,
      height,
      scale: 0.5
    })
    const data_uri = halved.toDataURL(
      'image/jpeg',
      SCREENSHOT_QUALITY_LADDER[SCREENSHOT_QUALITY_LADDER.length - 1]
    )
    return decoded_byte_length(data_uri) <= maximum_bytes ? data_uri : null
  } catch (_error) {
    return null
  }
}

export default capture_screenshot
