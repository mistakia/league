import config from '#config'

// The container's progress beacon: one POST per tool call, so the user watching
// the panel can see the run moving.
//
// SAME DOOR AS THE EMISSION, and for the same reasons. `THREAD_ID` is what
// authenticates it, base sets that in the session environment at spawn, and
// league recorded it on the job row when the drainer dispatched. Nothing is
// copied out of the prompt and no secret transits the timeline. See
// deliver-emission.mjs, which this deliberately mirrors rather than reinvents.
//
// WHERE IT DIFFERS FROM THE EMISSION, and the difference is the whole contract:
// AN EMISSION MUST ARRIVE AND A BEACON MUST NOT COST ANYTHING. The emission is
// the deliverable, so a failed delivery is a failed run and says so loudly. A
// beacon is decoration on a run that is otherwise fine, so every failure here is
// swallowed -- an unreachable league, a 404 for a job that already finished, a
// slow round trip -- and the tool proceeds as if it had never been sent. A
// progress report that could fail a tool call would be a new way for generation
// to break in exchange for a status line.
//
// THE TIMEOUT IS SHORT FOR THE SAME REASON. This runs before every tool, on a
// fifteen-minute clock the user is watching, so a beacon is allowed one second
// of that budget and then gives up. The emission's thirty seconds would let a
// stalled league API add half a minute to a ten-call run.

// One second, and never retried. See the header.
const REQUEST_TIMEOUT_MS = 1000

/**
 * Whether this process is the generation agent, and therefore has a run to
 * report progress for.
 *
 * Keyed on NODE_ENV exactly as is_generation_environment is in
 * deliver-emission.mjs. Under the suite and under a hand-run tool there is no
 * job on the other end, and posting to the operator's own league would be
 * reporting a step against somebody else's run.
 *
 * @returns {boolean}
 */
export const is_generation_environment = () =>
  process.env.NODE_ENV === 'sandbox'

/**
 * Tell league which tool is about to run.
 *
 * NEVER THROWS, NEVER REJECTS. The return value says what happened for the
 * benefit of a test; no caller is expected to branch on it.
 *
 * @param {object} params
 * @param {string} params.tool - the tool's name, as the tool contract spells it
 * @param {(url: string, init: object) => Promise<Response>} [params.fetch_impl]
 * @returns {Promise<{reported: boolean, reason?: string}>}
 */
export const report_progress = async ({ tool, fetch_impl = fetch }) => {
  if (!is_generation_environment()) {
    return { reported: false, reason: 'not the generation environment' }
  }

  const thread_id = process.env.THREAD_ID
  if (!thread_id) return { reported: false, reason: 'THREAD_ID is not set' }

  const base_url = config.url
  if (!base_url) return { reported: false, reason: 'config.url is not set' }

  try {
    const response = await fetch_impl(
      `${String(base_url).replace(/\/$/, '')}/api/data-views/generation-progress`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id, tool }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      }
    )
    if (!response.ok) {
      return { reported: false, reason: `league answered ${response.status}` }
    }
    return { reported: true }
  } catch (error) {
    return { reported: false, reason: error.message }
  }
}

export default {
  is_generation_environment,
  report_progress
}
