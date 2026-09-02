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

export class AgentToolError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AgentToolError'
    this.code = code
  }
}

const read_stdin = async () => {
  if (process.stdin.isTTY) return ''
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').trim()
}

/**
 * Read the tool's single JSON input from stdin, falling back to argv.
 *
 * @returns {Promise<object>}
 */
export const read_tool_input = async () => {
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
      `input is not valid JSON: ${error.message}`
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AgentToolError('invalid_input', 'input must be a JSON object')
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
 * @param {(input: object) => Promise<object>} opts.run
 */
export const run_agent_tool = async ({ tool, run }) => {
  try {
    const input = await read_tool_input()
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
