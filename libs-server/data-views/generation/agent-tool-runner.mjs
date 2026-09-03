// The shared contract every data-view agent tool obeys.
//
// The agent's tools are CLI scripts it invokes through Bash -- not an HTTP
// surface and not MCP. That choice is what makes the tool surface reachable from
// a container session at all: the harness already has Bash, the profile mounts
// the league checkout read-only, and nothing new has to be stood up or
// authenticated.
//
// ONE CONTRACT, because five scripts each inventing their own is five ways for
// the agent to misread a refusal:
//
//   - input is ONE JSON object, on stdin or as a single argv token. stdin is the
//     form to prefer: an argument is recorded verbatim in the thread timeline
//     and a table_state is large enough to bury the rest of a tool call
//   - success writes ONE JSON object to stdout and exits 0
//   - a refusal writes ONE JSON object carrying `error` and `code` to STDERR and
//     exits NON-ZERO
//
// The refusal rule is the whole point of this file. A tool that refuses by
// printing a plausible empty result on stdout and exiting 0 teaches the agent
// that the question had no answer, which is a different claim from "the tool
// would not answer it" -- and the agent cannot tell them apart. Every refusal
// here is loud, named, and on the error channel.
//
// STDERR IS SHARED, SO THE REFUSAL IS ITS **LAST LINE**, NOT ITS WHOLE BODY.
// Node writes its own diagnostics there and this repo reliably provokes one:
// importing the client field modules raises MODULE_TYPELESS_PACKAGE_JSON,
// several lines of it, before any tool code runs. A reader that parsed the whole
// stderr buffer as JSON would therefore fail on every refusal, and read that
// failure as the tool crashing rather than as the tool refusing. The exit code
// is the signal; the last stderr line is the reason.

import { assert_sandbox_credentials } from '#config'

export class AgentToolError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AgentToolError'
    this.code = code
  }
}

/**
 * Refuse, through the tool contract, to run a tool that needs a database
 * connection without the sandbox credential.
 *
 * TWO OF THE SIX TOOLS NEED THIS, AND FOUR DO NOT. search_columns,
 * describe_column, validate_table_state and emit are registry and schema
 * operations that never open a connection; preview_view and run_sql do. The
 * credential requirement lived at config import until 2026-09-02, which gated
 * all six on it and killed the four registry tools with a message about
 * Postgres. Asserting it here keeps the fail-by-name property exactly where the
 * dependency is real.
 *
 * The wrapper earns its keep on ONE thing: the named code. run_agent_tool
 * already renders any thrown Error as a single JSON object on stderr, so the
 * agent was never going to see a stack trace either way -- an earlier version
 * of this comment claimed otherwise and was wrong. What it would have seen is
 * the generic `tool_failed`, which does not distinguish "this environment has
 * no database credential" from "the tool broke".
 */
export const require_database_credential = () => {
  try {
    assert_sandbox_credentials()
  } catch (error) {
    throw new AgentToolError('sandbox_credential_missing', error.message)
  }
}

const read_stdin = async () => {
  if (process.stdin.isTTY) return ''
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').trim()
}

/**
 * Quote the neighbourhood of a JSON syntax error.
 *
 * A POSITION IS NOT A DIAGNOSTIC WHEN THE AGENT CANNOT SEE ITS OWN INPUT. The
 * payload arrives as one line of a Bash command, so "position 502" names a byte
 * the agent has no way to look at -- measured 2026-09-03, a run spent eight
 * turns finding a single surplus brace by writing the payload to a file and
 * then byte-slicing it back out, having first tried a Write tool the profile
 * does not carry. Echoing the window costs a few dozen characters and replaces
 * all of it.
 *
 * @param {string} raw
 * @param {string} message - the JSON.parse message, which carries the offset
 * @returns {string} '' when no offset can be read, so the caller degrades to
 *   the bare message rather than to a wrong window
 */
const quote_json_error_site = (raw, message) => {
  const match = /at position (\d+)/.exec(message)
  if (!match) return ''

  const position = Number(match[1])
  if (!Number.isFinite(position) || position > raw.length) return ''

  const start = Math.max(0, position - 40)
  const end = Math.min(raw.length, position + 40)
  const window = raw.slice(start, end)
  const caret = `${' '.repeat(position - start)}^`

  return `\n${window}\n${caret} here`
}

/**
 * Read the tool's single JSON input from stdin, falling back to argv.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.input_keys] - every key this tool accepts. Supplying
 *   it turns an unrecognized key into a NAMED refusal; omitting it accepts
 *   anything, which is the behaviour that cost a run four wasted turns.
 * @returns {Promise<object>}
 */
export const read_tool_input = async ({ input_keys } = {}) => {
  const from_stdin = await read_stdin()
  const raw = from_stdin || (process.argv[2] || '').trim()

  if (!raw) {
    throw new AgentToolError(
      'missing_input',
      'expected one JSON object on stdin (preferred) or as the single argument'
    )
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new AgentToolError(
      'invalid_json',
      `input is not valid JSON: ${error.message}${quote_json_error_site(raw, error.message)}`
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AgentToolError('invalid_input', 'input must be a JSON object')
  }

  // AN UNRECOGNIZED KEY IS A REFUSAL, NOT A DEFAULT. Reading input.query off an
  // object that carries `phrase` yields undefined, and every tool here then
  // answers that undefined honestly -- search_columns returned match_count 0 and
  // EXIT 0, which says "the registry has no such column" rather than "you named
  // the parameter wrong". The agent cannot tell those apart, and on 2026-09-03
  // it spent two calls, an `ls scripts/` and two source reads discovering the
  // key was spelled `query`. This file's own header forbids exactly that shape.
  if (input_keys) {
    const unknown = Object.keys(parsed).filter(
      (key) => !input_keys.includes(key)
    )
    if (unknown.length) {
      throw new AgentToolError(
        'unknown_parameter',
        `unrecognized input key(s): ${unknown.join(', ')}. This tool accepts: ${input_keys.join(', ')}`
      )
    }
  }

  return parsed
}

/**
 * Run one tool end to end: read input, run it, print the result, exit.
 *
 * Every script's `main` is this call and nothing else, so no script can drift
 * from the contract by forgetting a branch of it.
 *
 * @param {object} opts
 * @param {string} opts.tool - the tool's name, echoed on both channels so a
 *   refusal read out of a mixed log names which tool refused
 * @param {string[]} [opts.input_keys] - every key this tool accepts; anything
 *   else is refused by name rather than silently ignored
 * @param {(input: object) => Promise<object>} opts.run
 */
export const run_agent_tool = async ({ tool, input_keys, run }) => {
  try {
    const input = await read_tool_input({ input_keys })
    const result = await run(input)
    process.stdout.write(`${JSON.stringify({ tool, ...result }, null, 2)}\n`)
    process.exit(0)
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        tool,
        error: error.message,
        code: error.code || 'tool_failed'
      })}\n`
    )
    process.exit(1)
  }
}

/**
 * Require a key on the tool input, refusing by name rather than proceeding with
 * an undefined that fails further down under an unrelated message.
 */
export const require_input = (input, key) => {
  const value = input[key]
  if (value === undefined || value === null || value === '') {
    throw new AgentToolError('missing_parameter', `${key} is required`)
  }
  return value
}
