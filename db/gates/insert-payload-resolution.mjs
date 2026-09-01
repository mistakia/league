// Resolves a knex INSERT/UPDATE payload that arrives as an IDENTIFIER back to the
// object literals that built it -- the one dataflow hop `check-knex-column-resolution`
// needs in order to see the majority shape of this codebase's writes.
//
// THE GAP THIS CLOSES. That gate already reads `.insert({ ... })` as a column
// reference list, because an inline object literal sits INSIDE the statement text
// and its `collect_object_predicate_keys` walks it. But this tree writes the
// inline form 61 times and the indirect form -- `.insert(inserts)`, `.insert(batch)`,
// `.insert(formatted_data)` -- 206 times, so the covered shape is the minority one.
// A payload built into an array and passed by name is invisible to every gate here:
// the keys are not in the statement, and no `'table.column'` literal exists to read.
//
// That is not a hypothetical blind spot. `72346e579` renamed `player_gamelogs.pos`
// to `player_position` across 204 columns and missed
// `scripts/import-nflverse-weekly-rosters.mjs`, whose row builder pushes an object
// literal into an `inserts` array that reaches the table through
// `batch_insert({ items, save })`. Every run died on
// `column "pos" of relation "player_gamelogs" does not exist` for weeks. Measured at
// the pre-fix source: the column-resolution gate printed `GATE OK` with zero
// findings, and the importer's own spec was green throughout, because it asserts on
// the vendor CSV's response shape and stops one layer above the mapping.
//
// WHAT IT RESOLVES, and what it declines. Three binding forms, each requiring the
// identifier to have EXACTLY ONE declaration in the file:
//
//   const rows = []          rows.push({ ... })       ACCUMULATOR -- the shape that broke
//   const row = { ... }      db('t').insert(row)      SINGLE LITERAL
//   const rows = xs.map(x => ({ ... }))               CONCISE-RETURN MAP
//
// plus two rebinding hops that feed those forms:
//
//   batch_insert({ items: rows, save: async (batch) => db('t').insert(batch) })
//       `batch` is a callback PARAMETER and declares nothing, so it resolves only
//       through the enclosing `batch_insert` call -- the statement offset must fall
//       inside that call and the callback's sole parameter must be the identifier.
//       This is the single most common payload name in the corpus.
//   for (const item of rows) { db('t').insert(item) }
//       rebinds to the iterated identifier and recurses.
//
// THE SINGLE-DECLARATION RULE IS THE FALSE-POSITIVE GUARD, and it is doing the work
// a scope analysis would otherwise have to. This module reads a file as TEXT with no
// scope model, so two functions each declaring their own `const inserts = []` against
// two different tables would let literals from one leak into the other's key set and
// manufacture a finding on correct code. Requiring one declaration makes that shape
// UNRESOLVED rather than wrong. A gate reporting confident false positives gets read
// as broken, and the response a broken-looking gate invites is weakening it.
//
// Everything else declines: a payload built by a called function, a spread of an
// unknown base, a `.map` with a block body, an identifier declared twice, a
// parameter with no `batch_insert` around it. A declined site is UNCHECKED and
// counted, never silently passed -- a green over a payload nobody could read is the
// vacuous result this whole cluster exists to prevent.
//
// A SPREAD IN THE LITERAL NARROWS THE CLAIM RATHER THAN VOIDING IT. `{ ...base, pid }`
// carries keys this module cannot enumerate, but `pid` is still a column reference
// and still resolves or does not. The unknown half is reported as `partial` so the
// caller can count it; nothing here treats an unreadable key as absent.

import { end_of_call, split_top_level } from './knex-statement-machinery.mjs'

// How many rebinding hops to follow before declining. Three covers
// `batch` -> `items` -> accumulator with a hop to spare; an unbounded walk would
// loop on `const a = b; const b = a`.
const MAX_REBIND_DEPTH = 4

/**
 * The TOP-LEVEL keys of an object literal body.
 *
 * Deliberately does NOT descend into a nested object or a function body: a nested
 * object is a different scope and its keys are values, not columns. Both the
 * explicit `{ season_year: year }` and the shorthand `{ pid, esbid }` forms, since
 * the shorthand is the one no grep finds -- it reads as a local variable.
 *
 * @param {string} body the text between the braces
 * @param {number} body_offset file offset of the first character of `body`
 * @returns {{ keys: Array<{column: string, offset: number}>, has_spread: boolean }}
 */
/**
 * Replace every comment's CONTENT with spaces, preserving length and newlines.
 *
 * Blanking rather than deleting is the whole point: every offset this module
 * reports is an index into the original text, so removing characters would
 * silently mis-place each finding onto a neighbouring line.
 *
 * This is not tidiness, it is the difference between reading a key and losing it.
 * `split_top_level` splits on TOP-LEVEL commas and a comment's prose contains
 * them, so a key preceded by an explanatory comment lands in a segment beginning
 * mid-sentence and the key pattern -- anchored at the segment start -- does not
 * match. The key is then dropped with no signal. Measured on
 * `scripts/import-nflverse-weekly-rosters.mjs`, whose `player_position` key
 * carries a three-line comment explaining that very column: without blanking, the
 * resolver returns the other seven keys and silently omits the one the comment is
 * about, so the gate reports a confident green over the defect it was built for.
 *
 * Quote-aware, so a `'https://host'` value does not read as a line comment and
 * blank the rest of its line -- which would lose any key sharing it.
 */
const blank_comments = (text) => {
  const out = text.split('')
  let quote = null
  let index = 0
  while (index < text.length) {
    const character = text[index]
    if (quote) {
      if (character === '\\') index += 1
      else if (character === quote) quote = null
      index += 1
      continue
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character
      index += 1
      continue
    }
    if (character === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') out[index++] = ' '
      continue
    }
    if (character === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      const stop = end === -1 ? text.length : end + 2
      while (index < stop) {
        if (text[index] !== '\n') out[index] = ' '
        index += 1
      }
      continue
    }
    index += 1
  }
  return out.join('')
}

export const object_literal_keys = (raw_body, body_offset = 0) => {
  const body = blank_comments(raw_body)
  const keys = []
  let has_spread = false
  let cursor = 0
  for (const segment of split_top_level(body)) {
    const text = segment.text
    if (/^\s*\.\.\./.test(text)) has_spread = true
    const key_match = text.match(/^\s*([a-z_][a-z_0-9]*)\s*(:|$)/i)
    if (key_match) {
      keys.push({
        column: key_match[1],
        offset: body_offset + cursor + text.indexOf(key_match[1])
      })
    }
    cursor += text.length + 1
  }
  return { keys, has_spread }
}

/**
 * The object literal whose opening brace is at `open_index`.
 *
 * @param {string} source file text
 * @param {number} open_index index of the `{`
 * @returns {{ keys: Array<{column: string, offset: number}>, has_spread: boolean }|null}
 */
export const literal_at = (source, open_index) => {
  if (source[open_index] !== '{') return null
  let depth = 0
  for (let index = open_index; index < source.length; index++) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0)
        return object_literal_keys(
          source.slice(open_index + 1, index),
          open_index + 1
        )
    }
  }
  return null
}

const escape = (identifier) => identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Every site in the file that BINDS this identifier, including destructures.
 *
 * The destructure half is load-bearing rather than completeness for its own sake.
 * `scripts/process-projections.mjs` declares `const season_value_inserts = []` in
 * one function and destructures a same-named binding out of a builder call in
 * another, against two different tables whose column sets legitimately differ.
 * Counting only `const x =` sees ONE declaration, and the resolver then reads the
 * first function's literal against the second function's table and reports five
 * findings on correct code. Counting the destructure makes it two bindings, which
 * is UNRESOLVED -- the honest answer for a file this cannot scope.
 */
const declaration_sites = (source, identifier) => {
  const sites = []
  const escaped = escape(identifier)
  const binding_re = new RegExp(
    `\\b(?:const|let|var)\\s+${escaped}\\s*(=|\\bof\\b)`,
    'g'
  )
  let match
  while ((match = binding_re.exec(source)) !== null) {
    sites.push({
      index: match.index,
      // `for (const item of rows)` binds by iteration, not by assignment.
      is_iteration: match[1] !== '=',
      after: match.index + match[0].length
    })
  }

  // DESTRUCTURE -- `const { a, season_value_inserts, c } = build(...)`. Recorded as
  // a binding but never as a resolvable one: what it destructures is a function
  // RESULT, so there is no literal here to read. Its only job is to make the
  // identifier ambiguous, which is why it carries no `after`.
  const destructure_re = /\b(?:const|let|var)\s*\{/g
  while ((match = destructure_re.exec(source)) !== null) {
    const open_index = match.index + match[0].length - 1
    let depth = 0
    let end = -1
    for (let index = open_index; index < source.length; index++) {
      if (source[index] === '{') depth += 1
      else if (source[index] === '}') {
        depth -= 1
        if (depth === 0) {
          end = index
          break
        }
      }
    }
    if (end === -1) continue
    const body = source.slice(open_index + 1, end)
    const binds = split_top_level(body).some((segment) => {
      // `{ a: renamed }` binds `renamed`, not `a`; `{ a }` binds `a`.
      const rename = segment.text.match(/:\s*([a-z_][a-z_0-9]*)\s*$/i)
      const bare = segment.text.match(/^\s*([a-z_][a-z_0-9]*)\s*(?:=|$)/i)
      return (rename ? rename[1] : bare && bare[1]) === identifier
    })
    if (binds) sites.push({ index: match.index, is_destructure: true })
  }

  return sites
}

/**
 * The keys REMOVED from a payload before it reaches the table.
 *
 * A scratch key carried on the row object for an intermediate pass and then
 * deleted is not a column reference, and reporting it is reporting correct code.
 * Both seasonlog generators do exactly this: they push `pos` so a later pass can
 * `groupBy(inserts, 'pos')` to rank within position, then `delete insert.pos`
 * before the write. The table has no `pos` and is right not to.
 *
 * Scoped to the payload identifier and to the ALIASES that iterate it -- a
 * `for...of` variable, a `.forEach`/`.map` parameter -- rather than to every
 * `delete` in the file. The file-wide form would be a name-keyed stoplist by
 * another route, and a stoplist of column names is what hid a real finding from
 * the gate built to catch it.
 *
 * @param {string} source file text
 * @param {string} identifier the payload name
 * @returns {Set<string>}
 */
export const deleted_keys = (source, identifier) => {
  const escaped = escape(identifier)
  const aliases = new Set([identifier])
  const iteration_re = new RegExp(
    `\\bfor\\s*\\(\\s*(?:const|let|var)\\s+([a-z_][a-z_0-9]*)\\s+of\\s+${escaped}\\b`,
    'g'
  )
  const callback_re = new RegExp(
    `\\b${escaped}\\.(?:forEach|map|filter)\\(\\s*(?:async\\s*)?\\(?\\s*([a-z_][a-z_0-9]*)`,
    'g'
  )
  let match
  while ((match = iteration_re.exec(source)) !== null) aliases.add(match[1])
  while ((match = callback_re.exec(source)) !== null) aliases.add(match[1])

  const keys = new Set()
  for (const alias of aliases) {
    const delete_re = new RegExp(
      `\\bdelete\\s+${escape(alias)}\\.([a-z_][a-z_0-9]*)`,
      'g'
    )
    while ((match = delete_re.exec(source)) !== null) keys.add(match[1])
  }
  return keys
}

/**
 * Rebind a `batch_insert({ items, save })` callback parameter to the ARRAY it
 * iterates.
 *
 * `batch` declares nothing anywhere in the file -- it is a parameter -- so the only
 * thing that can bind it is the call it belongs to. Both halves are required: the
 * statement must sit lexically INSIDE the `batch_insert(` call extent, and that
 * call's `save` callback must declare this exact identifier as its sole parameter.
 * Matching on the name alone would bind any `batch` in the file to any `items` in
 * it.
 *
 * @param {string} source file text
 * @param {string} identifier the payload name
 * @param {number} statement_offset file offset of the knex statement
 * @returns {string|null} the identifier `items` was given, or null
 */
export const rebind_through_batch_insert = (
  source,
  identifier,
  statement_offset
) => {
  const call_re = /\bbatch_insert\s*\(/g
  let match
  while ((match = call_re.exec(source)) !== null) {
    const open_index = match.index + match[0].length - 1
    const end = end_of_call(source, open_index, source.length)
    if (end === null) continue
    if (statement_offset < open_index || statement_offset >= end) continue
    const body = source.slice(open_index + 1, end - 1)
    const brace = body.indexOf('{')
    if (brace === -1) continue
    const literal = source.slice(
      open_index + 1 + brace + 1,
      source.lastIndexOf('}', end)
    )
    let items = null
    let save_parameter = null
    for (const segment of split_top_level(literal)) {
      const items_match = segment.text.match(
        /^\s*items\s*:\s*([a-z_][a-z_0-9]*)\s*$/i
      )
      if (items_match) items = items_match[1]
      // `items` shorthand: `batch_insert({ items, save })`.
      if (/^\s*items\s*$/.test(segment.text)) items = 'items'
      const save_match = segment.text.match(
        /^\s*save\s*:\s*(?:async\s*)?\(?\s*([a-z_][a-z_0-9]*)\s*\)?\s*=>/i
      )
      if (save_match) save_parameter = save_match[1]
    }
    if (items && save_parameter === identifier) return items
  }
  return null
}

/**
 * Resolve an insert/update payload identifier to the object literals that built it.
 *
 * @param {object} args
 * @param {string} args.source file text
 * @param {string} args.identifier the payload name as written in `.insert(x)`
 * @param {number} args.statement_offset file offset of the knex statement
 * @param {number} [args.depth] internal rebinding depth
 * @returns {{status: 'resolved'|'unresolved', reason: string|null, partial: boolean,
 *   keys: Array<{column: string, offset: number}>}}
 */
export const resolve_insert_payload = ({
  source,
  identifier,
  statement_offset,
  depth = 0
}) => {
  const decline = (reason) => ({
    status: 'unresolved',
    reason,
    partial: false,
    keys: []
  })
  if (depth > MAX_REBIND_DEPTH) return decline('rebinding depth exceeded')

  const sites = declaration_sites(source, identifier)

  if (sites.length === 0) {
    // No declaration at all means a parameter, an import, or a destructure. The
    // one form worth chasing is the batch_insert callback, which is the corpus's
    // most common payload name by a wide margin.
    const rebound = rebind_through_batch_insert(
      source,
      identifier,
      statement_offset
    )
    if (rebound)
      return resolve_insert_payload({
        source,
        identifier: rebound,
        statement_offset,
        depth: depth + 1
      })
    return decline(`'${identifier}' has no declaration in this file`)
  }
  if (sites.length > 1)
    return decline(
      `'${identifier}' is declared ${sites.length} times -- ambiguous without a scope model`
    )

  const [site] = sites
  if (site.is_destructure)
    return decline(
      `'${identifier}' is destructured from a call result, which carries no literal`
    )

  const stripped = deleted_keys(source, identifier)
  const without_deleted = (literal) => ({
    ...literal,
    keys: literal.keys.filter((key) => !stripped.has(key.column))
  })

  if (site.is_iteration) {
    const iterated = source
      .slice(site.after, site.after + 200)
      .match(/^\s*([a-z_][a-z_0-9]*)\s*[),]/i)
    if (!iterated) return decline(`'${identifier}' iterates a non-identifier`)
    return resolve_insert_payload({
      source,
      identifier: iterated[1],
      statement_offset,
      depth: depth + 1
    })
  }

  const tail = source.slice(site.after)
  const leading = tail.match(/^\s*/)[0].length
  const first = tail[leading]

  // SINGLE LITERAL -- `const row = { ... }`.
  if (first === '{') {
    const literal = literal_at(source, site.after + leading)
    if (!literal) return decline('unterminated object literal')
    return { status: 'resolved', reason: null, ...without_deleted(literal) }
  }

  // ACCUMULATOR -- `const rows = []` filled by `rows.push({ ... })`.
  if (first === '[') {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const push_re = new RegExp(`\\b${escaped}\\.push\\(\\s*`, 'g')
    const keys = []
    let has_spread = false
    let literal_count = 0
    let opaque_pushes = 0
    let match
    while ((match = push_re.exec(source)) !== null) {
      const argument_index = match.index + match[0].length
      if (source[argument_index] !== '{') {
        opaque_pushes += 1
        continue
      }
      const literal = literal_at(source, argument_index)
      if (!literal) {
        opaque_pushes += 1
        continue
      }
      literal_count += 1
      has_spread = has_spread || literal.has_spread
      keys.push(...literal.keys)
    }
    if (!literal_count)
      return decline(
        `'${identifier}' is an array no object literal is pushed to`
      )
    return {
      status: 'resolved',
      reason: null,
      partial: has_spread || opaque_pushes > 0,
      keys: keys.filter((key) => !stripped.has(key.column))
    }
  }

  // CONCISE-RETURN MAP -- `const rows = xs.map((x) => ({ ... }))`.
  const map_match = tail.match(/^\s*[^\n]*?\.map\(\s*[^=]*?=>\s*\(\s*\{/)
  if (map_match) {
    const brace = site.after + map_match[0].lastIndexOf('{')
    const literal = literal_at(source, brace)
    if (literal)
      return { status: 'resolved', reason: null, ...without_deleted(literal) }
  }

  // ALIAS -- `const payload = row`.
  const alias = tail.match(/^\s*([a-z_][a-z_0-9]*)\s*[\n;]/i)
  if (alias)
    return resolve_insert_payload({
      source,
      identifier: alias[1],
      statement_offset,
      depth: depth + 1
    })

  return decline(`'${identifier}' is built by an expression this cannot read`)
}
