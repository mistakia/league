import require_served_response from '#libs-server/require-served-response.mjs'

/**
 * Fetch a URL and parse its body as JSON, refusing anything that is not a
 * served page.
 *
 * The JSON twin of `fetch_cheerio`, and it exists for the same reason: every
 * caller reads fields straight off the parsed body, so an unserved response
 * reaches them as a shape that is merely missing what they wanted. What that
 * produces is a `TypeError` naming an inner property — `cannot read properties
 * of undefined (reading 'data')` — which is loud but points at the parse rather
 * than at the refusal that caused it. Failing here keeps the cause legible.
 *
 * `fetch-h2` responses satisfy this too: the transport differs but `status`,
 * `statusText` and `json()` are the same Fetch surface.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>} the parsed JSON body
 */
export default async function fetch_json(url, options = {}) {
  const response = await fetch(url, options)
  require_served_response(response, url)
  return response.json()
}
