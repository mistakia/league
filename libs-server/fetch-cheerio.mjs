import * as cheerio from 'cheerio'

import require_served_response from '#libs-server/require-served-response.mjs'

/**
 * Fetch a URL and load its body into cheerio, refusing anything that is not a
 * served page.
 *
 * The status check is here rather than at the call sites because the failure it
 * prevents is invisible there. Every caller of this helper follows the parse
 * with a zero-row guard, and an unserved body -- a rate-limit 403, a 5xx, a WAF
 * challenge -- parses to zero rows just like a redesign does. Without the
 * status the two are indistinguishable, so the guard fires with the wrong
 * diagnosis: it reports that the vendor moved the markup when the truth is that
 * we were refused. Measured against fftoday, which rate-limits with a 403 after
 * roughly a dozen rapid requests and serves a body that reads exactly like a
 * redesign.
 *
 * `require_served_response` carries the rule itself, including why it is
 * `!== 200` rather than `!response.ok` and why the error carries `http_status`.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<cheerio.CheerioAPI>}
 */
export default async function fetch_cheerio(url, options = {}) {
  const response = await fetch(url, options)
  require_served_response(response, url)

  const html = await response.text()
  return cheerio.load(html)
}
