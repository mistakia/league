/**
 * Throw unless the response is one upstream actually served.
 *
 * The single definition of "served" for the fetch helpers, so `fetch_cheerio`
 * and `fetch_json` cannot drift apart on the question.
 *
 * NOT `!response.ok`. 202 sits inside the 2xx range and is the dangerous case
 * rather than an acceptable one — a WAF challenge is an empty body dressed as
 * success, so `ok` is true for exactly the response this exists to reject.
 * `scripts/import-espn-line-win-rates.mjs` carries the same `!== 200` check
 * with the measurement behind it, and `fetch_with_retry` gates on `ok`, which
 * is why a caller that needs this guarantee cannot simply defer to it.
 *
 * `http_status` rides on the error so a caller that must tell "upstream has not
 * published this slice" from "upstream is broken" can branch on it, matching
 * what `fetch_with_retry` attaches. Assigned via `Object.assign` because
 * `Error` declares no such member and a direct assignment is a TS2339.
 *
 * @param {Response} response
 * @param {string} url
 * @returns {Response} the same response, when it is a 200
 */
export default function require_served_response(response, url) {
  if (response.status !== 200) {
    throw Object.assign(
      new Error(
        `HTTP ${response.status}: ${response.statusText} for ${url}`.trim()
      ),
      { http_status: response.status }
    )
  }

  return response
}
