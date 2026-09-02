import * as cheerio from 'cheerio'

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
 * NOT `!response.ok`. 202 sits inside the 2xx range and is precisely the
 * response this exists to catch -- a WAF challenge is an empty body dressed as
 * success, so `ok` is true for the dangerous case and would hand cheerio the
 * empty body. `scripts/import-espn-line-win-rates.mjs` carries the same
 * `!== 200` check with the measurement behind it. A served page is 200 and
 * nothing else.
 *
 * `http_status` rides on the error so a caller that must tell "upstream has not
 * published this slice" from "upstream is broken" can branch on it, matching
 * what `fetch_with_retry` attaches. Assigned via `Object.assign` because
 * `Error` declares no such member and a direct assignment is a TS2339.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<cheerio.CheerioAPI>}
 */
export default async function fetch_cheerio(url, options = {}) {
  const response = await fetch(url, options)

  if (response.status !== 200) {
    throw Object.assign(
      new Error(
        `HTTP ${response.status}: ${response.statusText} for ${url}`.trim()
      ),
      { http_status: response.status }
    )
  }

  const html = await response.text()
  return cheerio.load(html)
}
