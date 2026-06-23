import path from 'path'
import { existsSync, readFileSync } from 'fs'

import { SourceMapConsumer } from 'source-map'

// Resolve minified client stack frames against the build's sourcemaps so the
// emitted log_error signal carries original file:line:col instead of the
// minified chunk coordinate (e.g. 9545.530a1ed2.chunk.js:1:468 ->
// app/views/components/error-test/error-test.js:12:10). This replaces the
// symbolication Bugsnag previously did against its uploaded sourcemaps.
//
// The sourcemaps live on a PRIVATE path on the league host (never served from
// public dist/) and resolution happens entirely server-side, so source is
// never exposed to clients.

// Capture a frame location: an optional path/url, the file basename ending in
// .js, then :line:column. Works for both
//   at A (https://xo.football/dist/9545.530a1ed2.chunk.js:1:468)
//   at https://xo.football/dist/main.abc123.js:1:468
const FRAME_LOCATION = /((?:[^\s()]+\/)?([^\s()/]+\.js)):(\d+):(\d+)/
// Capture the (minified) function name in `at <name> (` so it can be replaced
// with the original symbol when the sourcemap provides one.
const FRAME_NAME = /\bat\s+([^\s(]+)\s+\(/

const clean_source = (source) =>
  String(source || '')
    .replace(/^webpack:\/{2,3}/, '')
    .replace(/^\.\//, '')
    .replace(/\?.*$/, '')

const load_consumer = async (sourcemap_dir, basename) => {
  const map_path = path.join(sourcemap_dir, `${basename}.map`)
  if (!existsSync(map_path)) return null
  try {
    const raw = JSON.parse(readFileSync(map_path, 'utf8'))
    return await new SourceMapConsumer(raw)
  } catch (_load_error) {
    return null
  }
}

const symbolicate_line = async (line, sourcemap_dir, consumer_cache) => {
  const match = FRAME_LOCATION.exec(line)
  if (!match) return line

  const [full_location, , basename, line_str, col_str] = match
  const lineno = Number(line_str)
  const colno = Number(col_str)

  if (!consumer_cache.has(basename)) {
    consumer_cache.set(basename, await load_consumer(sourcemap_dir, basename))
  }
  const consumer = consumer_cache.get(basename)
  if (!consumer) return line

  const original = consumer.originalPositionFor({ line: lineno, column: colno })
  if (!original || !original.source) return line

  const resolved_location = `${clean_source(original.source)}:${original.line}:${original.column}`
  let rewritten = line.replace(full_location, resolved_location)

  if (original.name) {
    const name_match = FRAME_NAME.exec(rewritten)
    if (name_match) {
      rewritten = rewritten.replace(
        `at ${name_match[1]} (`,
        `at ${original.name} (`
      )
    }
  }

  return rewritten
}

/**
 * Resolve a minified client stack trace against on-disk sourcemaps.
 *
 * Never throws and never rejects: any parse/IO/resolution failure leaves the
 * affected frame (or the whole stack) untouched, so error reporting degrades
 * to the raw minified stack rather than dropping the report.
 *
 * @param {string} stack - raw stack string from the client error report
 * @param {object} opts
 * @param {string} opts.sourcemap_dir - directory holding the *.js.map files
 * @returns {Promise<string>} the symbolicated stack (or the original on failure)
 */
export const symbolicate_stack = async (stack, { sourcemap_dir } = {}) => {
  if (typeof stack !== 'string' || !stack) return stack
  if (!sourcemap_dir || !existsSync(sourcemap_dir)) return stack

  const consumer_cache = new Map()
  try {
    const lines = stack.split('\n')
    const resolved = []
    for (const line of lines) {
      resolved.push(await symbolicate_line(line, sourcemap_dir, consumer_cache))
    }
    return resolved.join('\n')
  } catch (_symbolicate_error) {
    return stack
  } finally {
    for (const consumer of consumer_cache.values()) {
      if (consumer) consumer.destroy()
    }
  }
}

export default symbolicate_stack
