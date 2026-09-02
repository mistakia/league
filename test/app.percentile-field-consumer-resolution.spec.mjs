/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { extended_player_stats } from '#constants'
import { percentile_field_vocabulary } from '#scripts/generate-nfl-team-seasonlogs.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const player_fields_path = path.join(__dirname, '../app/core/player-fields.js')

chai.should()

// `db/checks/registry.mjs`'s percentile-field-resolution grades values that
// EXIST in the percentiles table. This spec asks the mirror question, over the
// values a CONSUMER requests, and the two are not redundant: a check over
// stored rows is structurally blind to a request nobody ever wrote a row for.
// An unserved percentile_field renders a BLANK CELL and never raises, so the
// only thing that reports it is a gate like this one.
//
// The trap is that player-fields.js has TWO percentile families reading two
// different sources, and grading either against the other's vocabulary is
// confidently wrong in both directions:
//
//   - The WORKER family pins `percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS'`.
//     Nothing stores those. app/core/stats/sagas.js runs the browser worker,
//     which calls calculatePercentiles with `stats: extended_player_stats`, and
//     app/core/percentiles/reducer.js writes the result into state under that
//     key. The percentiles TABLE holds zero rows under it and always has.
//   - The STORED family reaches its key through `opponent_field()` or its own
//     `get_percentile_key`, resolving to `${pos}_AGAINST_ADJ...` at render.
//     Those rows come from scripts/generate-nfl-team-seasonlogs.mjs.
//
// Grading the worker family against the table is what produced the inherited
// "44 of 84 requested values are unserved" figure on 2026-09-02. Forty-three of
// those forty-four were fine. The one real defect was `dryprecy`, a misspelling
// of the writer's `drprecy` that had been rendering an empty Dropped Receiving
// Yards column -- in a DEFAULT view -- for as long as it had existed.
const worker_key = 'PLAYER_PLAY_BY_PLAY_STATS'

// Blank comment CONTENT to spaces rather than deleting it: every offset below
// is an index into the original text, so removing characters would slide each
// entry onto a neighbouring line. Quote-aware, or a '//' inside a string value
// swallows the rest of its line.
const blank_comments = (source) => {
  let out = ''
  let quote = null
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (quote) {
      if (char === '\\') {
        out += source.slice(index, index + 2)
        index += 2
        continue
      }
      if (char === quote) quote = null
      out += char
      index += 1
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
      out += char
      index += 1
      continue
    }

    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') {
        out += ' '
        index += 1
      }
      continue
    }

    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      for (; index < stop; index += 1) {
        out += source[index] === '\n' ? '\n' : ' '
      }
      continue
    }

    out += char
    index += 1
  }

  return out
}

const entry_start_re = /^ {4}('?[A-Za-z0-9_.]+'?): \{\s*$/

const collect_percentile_entries = (source) => {
  const lines = blank_comments(source).split('\n')
  const entries = []
  let current = null

  for (const [offset, line] of lines.entries()) {
    const match = line.match(entry_start_re)
    if (match) {
      if (current) entries.push(current)
      current = {
        name: match[1].replace(/'/g, ''),
        line: offset + 1,
        body: []
      }
      continue
    }
    if (current) current.body.push(line)
  }
  if (current) entries.push(current)

  return entries
    .map((entry) => {
      const body = entry.body.join('\n')
      const field = body.match(/percentile_field: '([^']+)'/)
      if (!field) return null

      const value_path = body.match(/player_value_path: '([^']+)'/)
      const pins_worker_key = body.includes(`percentile_key: '${worker_key}'`)
      const resolves_key_at_render =
        body.includes('opponent_field(') || body.includes('get_percentile_key:')

      return {
        name: entry.name,
        line: entry.line,
        field: field[1],
        player_value_path: value_path ? value_path[1] : null,
        family: pins_worker_key
          ? 'worker'
          : resolves_key_at_render
            ? 'stored'
            : 'unclassified'
      }
    })
    .filter(Boolean)
}

describe('app/core/player-fields percentile field resolution', function () {
  const source = fs.readFileSync(player_fields_path, 'utf8')
  const entries = collect_percentile_entries(source)
  const worker_entries = entries.filter((entry) => entry.family === 'worker')
  const stored_entries = entries.filter((entry) => entry.family === 'stored')

  it('parses both percentile families out of player-fields.js', () => {
    // The entry regex is anchored on an indentation level, so a reformat that
    // moves the fields object would match nothing and leave every assertion
    // below iterating an empty list. These floors sit under the real counts and
    // far above zero.
    worker_entries.length.should.be.above(40)
    stored_entries.length.should.be.above(30)
    entries
      .filter((entry) => entry.family === 'unclassified')
      .should.deep.equal([])

    // The floors above only catch a parse that collapses ENTIRELY. An entry
    // whose opening line stops matching is absorbed into its predecessor's
    // body, which drops it from the corpus while leaving the counts healthy --
    // a silent loss of exactly the shape this whole spec exists to report. So
    // pin the corpus to the raw occurrence count instead: every request in the
    // file must have been attributed to an entry.
    const requested = blank_comments(source).match(/percentile_field: '/g) || []
    entries.length.should.equal(requested.length)
  })

  it('requests only worker stats the browser percentile pass emits', () => {
    const unserved = worker_entries
      .filter((entry) => !extended_player_stats.includes(entry.field))
      .map((entry) => `${entry.name} (line ${entry.line}): ${entry.field}`)

    unserved.should.deep.equal([])
  })

  it('requests only stored stats the seasonlog writer emits', () => {
    const unserved = stored_entries
      .filter((entry) => !percentile_field_vocabulary.includes(entry.field))
      .map((entry) => `${entry.name} (line ${entry.line}): ${entry.field}`)

    unserved.should.deep.equal([])
  })

  it('reads each worker stat from the key its percentile is graded on', () => {
    // What makes the membership assertion above cover the whole column rather
    // than only its shading. The percentile is keyed on `percentile_field` and
    // the VALUE is read from `player_value_path`; where the two disagree, a
    // served percentile can sit beside an empty cell. Every worker entry states
    // the same stat key three times, so one membership check settles all three.
    const mismatched = worker_entries
      .filter(
        (entry) =>
          entry.player_value_path !== `stats.${entry.field}` ||
          entry.name !== entry.player_value_path
      )
      .map(
        (entry) =>
          `${entry.name} (line ${entry.line}): path ${entry.player_value_path}, field ${entry.field}`
      )

    mismatched.should.deep.equal([])
  })
})
