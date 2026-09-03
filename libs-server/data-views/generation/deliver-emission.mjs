import config from '#config'

// The container's only write door, and the last leg of the transport.
//
// THE GAP THIS CLOSES. Until this existed, `emit` validated the agent's
// deliverable and printed "ok" -- and the envelope went nowhere. League's job
// row had a `result` column nothing ever wrote, so a run that worked perfectly
// ended with the user's view sitting in a container transcript on another host.
//
// WHY AN HTTP PUSH RATHER THAN READING IT OFF THE THREAD. League polls base for
// the run's liveness and trajectory anyway (generation-collector.mjs), so
// scraping the emission out of the same thread looks free. It is not: the
// emission reaches the timeline as the INPUT to a Bash tool call, which is an
// arbitrary shell command string. The agent can pipe a heredoc, cat a file it
// wrote to its own overlay, or build the JSON inline -- and recovering an
// envelope from any of those is a guess, not a contract. Pushing it makes the
// wire shape the contract and makes `emit` honest: its exit code now means
// "delivered", not "well-formed".
//
// WHAT AUTHENTICATES IT. `THREAD_ID`, which base sets in the session
// environment at spawn and which league recorded on the job row when the
// drainer dispatched it. Nothing is copied out of the prompt and no secret
// transits the timeline, which is synced and full-text indexed. The client
// never learns a thread_id -- project_generation_job withholds it -- so the
// pairing "knows the thread id AND that job is still running" is satisfiable
// only by the session base actually dispatched.
//
// LEAGUE STILL RE-VALIDATES. This module is inside the sandbox and everything
// it sends is agent-controlled; the receiving route re-runs validate_emission
// rather than trusting the container's own verdict.

const REQUEST_TIMEOUT_MS = 30 * 1000

export class EmissionDeliveryError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'EmissionDeliveryError'
    this.code = code
  }
}

/**
 * Whether this process is the generation agent, and therefore MUST deliver.
 *
 * Keyed on NODE_ENV rather than on the presence of THREAD_ID, deliberately.
 * Keying on THREAD_ID would make a missing one mean "nothing to deliver to",
 * so an agent whose environment lost it would emit, print ok, exit 0, and
 * silently produce nothing -- the exact failure this module exists to remove.
 * `sandbox` IS the generation environment, so under it a missing THREAD_ID is a
 * refusal by name.
 *
 * @returns {boolean}
 */
export const is_generation_environment = () =>
  process.env.NODE_ENV === 'sandbox'

/**
 * Deliver one validated emission to league.
 *
 * @param {object} params
 * @param {object} params.emission - the envelope, exactly as validated
 * @param {Array<string>} [params.tool_calls]
 * @param {string} [params.branch] - registry | query | refusal
 * @param {(url: string, init: object) => Promise<Response>} [params.fetch_impl]
 * @returns {Promise<{delivered: boolean, generation_id: string|null}>}
 */
export const deliver_emission = async ({
  emission,
  tool_calls = [],
  branch,
  fetch_impl = fetch
}) => {
  if (!is_generation_environment()) {
    // Running the tool by hand or under the suite. Nothing to deliver to, and
    // saying so is more useful than a network error against a URL that is not
    // the caller's.
    return { delivered: false, generation_id: null }
  }

  const thread_id = process.env.THREAD_ID
  if (!thread_id) {
    throw new EmissionDeliveryError(
      'emission_undeliverable',
      'THREAD_ID is not set, so this emission cannot be attributed to a generation job'
    )
  }

  const base_url = config.url
  if (!base_url) {
    throw new EmissionDeliveryError(
      'emission_undeliverable',
      'config.url is not set, so there is no league API to deliver this emission to'
    )
  }

  let response
  try {
    response = await fetch_impl(
      `${String(base_url).replace(/\/$/, '')}/api/data-views/generation-emission`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id, emission, tool_calls, branch }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      }
    )
  } catch (error) {
    throw new EmissionDeliveryError(
      'emission_delivery_failed',
      `the emission could not be delivered to league: ${error.message}`
    )
  }

  if (!response.ok) {
    const text = await response.text()
    throw new EmissionDeliveryError(
      'emission_refused',
      `league refused the emission with ${response.status}: ${text.slice(0, 300)}`
    )
  }

  const { generation_id } = await response.json()
  return { delivered: true, generation_id: generation_id ?? null }
}

export default {
  EmissionDeliveryError,
  deliver_emission,
  is_generation_environment
}
