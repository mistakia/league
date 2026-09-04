#!/usr/bin/env node

/**
 * SPA reads of a column name the schema retired and no producer sends.
 *
 * WHY THIS EXISTS, AND WHY IT IS A SEPARATE GATE.
 *
 * `app/views/components/selected-player-matchup-table/index.js` filtered the
 * schedule tab's gamelogs with `gamelog.pos !== position`. The shorthand conform
 * renamed `player_gamelogs.pos` to `player_position` and the gamelogs route
 * projects `player_gamelogs.*`, so every row arrived carrying `player_position`
 * and `gamelog.pos` was `undefined` on every one of them. `undefined !==` a
 * position is true, the filter dropped every row, and the tab rendered an empty
 * table with nothing red anywhere -- no throw, green suite, green deploy. Five
 * more sites of the same shape shipped alongside it, found by hand on 2026-09-04
 * and fixed in `3b3b25fce`: two reads of `rank` where the seasonlogs route sends
 * `points_rank`, one `play.play.dwn` where the scoreboard socket sends
 * `down_number`, and the markets chart reading `timestamp` and `year` where the
 * prop-market tables carry `observed_at` and `season_year`.
 *
 * THE EXISTING GATES COULD NOT HAVE CAUGHT THESE, for three separate reasons,
 * and only the third is a bug:
 *
 *   1. `check-returned-property-reads.mjs` declares `app/` out of its corpus,
 *      on the stated grounds that covering it needs a second resolution scheme
 *      for the webpack aliases and that the SPA's cross-module values are props
 *      rather than returned option objects. That reasoning holds for the edge
 *      IT resolves -- a callee's return contract -- and none of these six sites
 *      read a local callee. They read a row that arrived over HTTP.
 *
 *   2. `check-renamed-column-consumers.mjs` gate 2 DOES scan `app/` and DOES
 *      collect `gamelog.pos` -- as the `property` shape, which is excluded from
 *      its HIGH_SIGNAL_SHAPES and so never reaches a reviewer. That exclusion is
 *      correct on its own terms: without the subtraction below, `.pos` and
 *      `.rid` and `.year` are overwhelmingly legitimate, and a reviewer handed
 *      that list adjudicates the real sites away with the noise.
 *
 *   3. Gate 2 is INCREMENTAL. It reports a column removed since a base ref, so
 *      it can only speak during its own cluster's window. Once the conform is in
 *      master there is no diff left to derive the old name from, and a site
 *      missed at the time is invisible forever after. That is what happened
 *      here, and it is why promoting the `property` shape inside that gate would
 *      not have closed this: the gate had already stopped looking.
 *
 * So this gate is non-incremental. Its old-name universe is the checked-in
 * rename maps, which outlive the diff that produced them.
 *
 * THE ORACLE, and the discriminator that makes the `property` shape readable.
 *
 * A name is a candidate when all three hold:
 *
 *   RETIRED    it appears as an old name in a checked-in rename map.
 *   DEAD       it is not a live column on ANY table in the current schema. A
 *              name still live somewhere is ambiguous -- the read may be a
 *              perfectly good read of the other table -- so it is not judged.
 *   UNALIASED  no server file aliases it back onto the wire.
 *
 * The third is the load-bearing one and is what no existing gate models. A
 * conform renames the physical column and the producer keeps the old name on the
 * wire on purpose: `get-roster.mjs` selects `player_position as pos, roster_id
 * as rid` because `pos`/`rid` is the roster's in-memory and wire vocabulary, and
 * the data-view column definitions alias a good many more. Every SPA read of
 * those is CORRECT. Subtracting them is the difference between a hit list nobody
 * can read and a candidate set a reviewer can actually settle -- the run prints
 * both counts, so the size of that difference is a measurement rather than a
 * claim in this comment.
 *
 * WHAT THIS DOES NOT COVER, stated rather than left to be discovered.
 *   - A name renamed with no entry in any rename map is invisible. The maps are
 *     the universe; a cluster that lands without recording one is not covered,
 *     and that is the gate's single biggest dependency.
 *   - A name that is dead in the schema but is ALSO a plain application word
 *     (`value`, `total`, `min`) produces sites this gate cannot distinguish from
 *     real ones. They are reported and adjudicated per site, never suppressed by
 *     name -- see the adjudications file.
 *   - Depth-one only. `market.selections` is judged, the keys inside a selection
 *     are judged against their own receiver, and a read three levels down a
 *     locally-built object is not attributed to any producer.
 *   - THE REFERENCE DEFECT ITSELF IS NOT IN THE GATING TIER, and that is worth
 *     knowing before trusting a green. Alias-back is global -- this gate cannot
 *     prove WHICH producer fed a given SPA read -- so one producer keeping a
 *     name on the wire clears every read of it. `get-roster.mjs` aliases
 *     `player_position as pos` for the roster's own vocabulary, which clears
 *     `gamelog.pos` too. Dropping those silently would make a green a lie, so
 *     they are reported in the ALIAS-AMBIGUOUS tier: printed with their sites,
 *     excluded from the pass/fail verdict, and named in the verdict line. Five
 *     of the six defects of 2026-09-04 are in the gating tier; `pos` is the one
 *     that is not, and it is the one a reader has to check by hand.
 *   - A CLIENT-side normalization clears a name exactly as a server alias-back
 *     does and is equally invisible here: `league_team_daily_values` sends
 *     `observed_at` and the reducer renames it to `timestamp` before anything
 *     reads it. Those surface as findings and are settled in the adjudications
 *     file, which is the right place for them -- the reason names the reducer.
 *
 * ACCEPTANCE TEST -- run as a PAIR, because a red proves nothing until the
 * unperturbed case is shown to be green. Verified 2026-09-04:
 *
 *   printf 'export const probe = (play) => play.dwn\n' > app/__probe__.js
 *   node db/gates/check-spa-stale-column-reads.mjs --unadjudicated   # 1 finding, exit 1
 *   rm app/__probe__.js
 *   node db/gates/check-spa-stale-column-reads.mjs --unadjudicated   # 0 findings, exit 0
 *
 * The two readings differ, so the red is the probe rather than something
 * already broken.
 *
 * NEGATIVE CONTROLS -- each was made to FAIL by removing the exclusion it
 * covers, one at a time, on 2026-09-04. A control that cannot be made to fail
 * is not a control:
 *
 *   drop the `property` read shape    -> all three go STAYED GREEN, because
 *                                        every control asserts the reportable
 *                                        half. This is the two-sided design
 *                                        doing its job: no control can pass a
 *                                        run in which the gate reports nothing.
 *   drop the `aliased.has` branch     -> subtracts-alias-back alone goes green
 *   drop the store-slice skip         -> subtracts-store-slice alone goes green
 *
 * Usage:
 *   node db/gates/check-spa-stale-column-reads.mjs
 *   node db/gates/check-spa-stale-column-reads.mjs --json
 *   node db/gates/check-spa-stale-column-reads.mjs --unadjudicated
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  count_files_by_root,
  format_corpus,
  resolve_corpus,
  verdict_suffix
} from './scan-corpus.mjs'
import { format_negative_controls } from './negative-control.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')
const adjudications_path = path.join(
  __dirname,
  'spa-stale-column-read-adjudications.json'
)

const READER_ROOTS = ['app']

// Where an alias-back can live. A producer is any server file that can put a
// name on the wire, which includes `libs-shared` -- the data-view field
// factories are isomorphic and several alias there.
const PRODUCER_ROOTS = ['api', 'libs-server', 'libs-shared']

const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage'])

// The checked-in rename maps. Each is REQUIRED: a map that has moved or been
// deleted shrinks the old-name universe silently, and a gate reporting over a
// smaller universe than its verdict claims is the failure mode scan-corpus.mjs
// exists to prevent. Missing one is a hard exit, never a narrower pass.
const RENAME_MAP_SOURCES = [
  { kind: 'shorthand', file: 'db/archive/shorthand-rename-map.json' },
  {
    kind: 'boolean_prefix',
    file: 'db/archive/column-repoint-maps/boolean-prefix.json'
  },
  {
    kind: 'module',
    file: 'db/archive/check-player-column-repoint.mjs',
    export_name: 'PLAYER_COLUMN_RENAMES',
    table: 'player'
  },
  {
    kind: 'module',
    file: 'db/gates/check-plays-column-repoint.mjs',
    export_name: 'PLAYS_COLUMN_RENAMES',
    table: 'nfl_plays'
  },
  {
    kind: 'module',
    file: 'db/archive/fantasy-stat-renames.mjs',
    export_name: 'FANTASY_STAT_RENAMES',
    table: 'fantasy_stat'
  }
]

/**
 * Old name -> the (table, new name) pairs that retired it.
 *
 * @param {object} [params]
 * @param {(p: string, e: string) => string} [params.read_file] injected so the
 *   negative control can plant a source without patching an ESM namespace,
 *   which is frozen and would fail open.
 * @returns {Promise<Map<string, Array<{ table: string, new_name: string }>>>}
 */
export const load_rename_universe = async ({
  read_file = fs.readFileSync
} = {}) => {
  const universe = new Map()
  const add = (table, old_name, new_name) => {
    if (!universe.has(old_name)) universe.set(old_name, [])
    universe.get(old_name).push({ table, new_name })
  }

  for (const source of RENAME_MAP_SOURCES) {
    const absolute = path.join(repo_root, source.file)
    if (!fs.existsSync(absolute)) {
      throw new Error(
        `rename map missing: ${source.file} -- the old-name universe would be silently narrower than this gate claims`
      )
    }
    if (source.kind === 'shorthand') {
      const parsed = JSON.parse(read_file(absolute, 'utf8'))
      for (const record of parsed.records) {
        if (record.disposition !== 'rename') continue
        add(record.table, record.column, record.proposed_name)
      }
    } else if (source.kind === 'boolean_prefix') {
      const parsed = JSON.parse(read_file(absolute, 'utf8'))
      for (const record of parsed.renames) {
        add(record.table, record.old_name, record.new_name)
      }
    } else {
      const module_exports = await import(absolute)
      const map = module_exports[source.export_name]
      if (!map) {
        throw new Error(
          `rename map ${source.file} no longer exports ${source.export_name}`
        )
      }
      for (const [old_name, new_name] of Object.entries(map)) {
        add(
          source.table,
          old_name,
          typeof new_name === 'string' ? new_name : JSON.stringify(new_name)
        )
      }
    }
  }
  return universe
}

/**
 * Every column name live on any table in the current schema.
 *
 * @param {string} sql
 * @returns {Set<string>}
 */
export const parse_live_columns = (sql) => {
  const live = new Set()
  let inside = false
  for (const line of sql.split('\n')) {
    if (/^CREATE TABLE /.test(line)) {
      inside = true
      continue
    }
    if (inside && /^\);/.test(line)) {
      inside = false
      continue
    }
    if (!inside) continue
    const match = line.match(/^ {4}([a-z_][a-z0-9_]*) /)
    if (!match) continue
    if (/^(CONSTRAINT|PARTITION|PRIMARY|UNIQUE|CHECK|FOREIGN)$/i.test(match[1]))
      continue
    live.add(match[1])
  }
  return live
}

const walk_files = (roots, extensions) => {
  const files = []
  const walk = (directory) => {
    let entries
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith('.'))
        continue
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (extensions.some((extension) => entry.name.endsWith(extension)))
        files.push(full)
    }
  }
  for (const root of roots) walk(path.join(repo_root, root))
  return files
}

/**
 * The names a producer still puts on the wire under their retired spelling.
 *
 * Matches the three knex alias spellings -- `.select('x as pos')`,
 * `.select('x', 'y as pos')` and a raw `x AS pos` -- plus `select_as: () =>
 * '<name>'`, which is how the data-view column factories name a wire key.
 *
 * @param {Iterable<string>} columns
 * @param {(p: string, e: string) => string} read_file
 * @returns {Map<string, string[]>} column -> producer files that alias it
 */
export const collect_alias_backs = (columns, read_file = fs.readFileSync) => {
  const aliased = new Map()
  const patterns = new Map(
    [...columns].map((column) => [
      column,
      new RegExp(
        `\\bas\\s+${column}\\b|\\bas\\s+['"\`]${column}['"\`]|['"\`][\\w.]+\\s+as\\s+${column}['"\`]|select_as[^\\n]*['"\`]${column}['"\`]`,
        'i'
      )
    ])
  )
  for (const file of walk_files(PRODUCER_ROOTS, ['.mjs', '.js'])) {
    const source = read_file(file, 'utf8')
    for (const [column, pattern] of patterns) {
      if (!pattern.test(source)) continue
      if (!aliased.has(column)) aliased.set(column, [])
      aliased.get(column).push(path.relative(repo_root, file))
    }
  }
  return aliased
}

// The shapes a row read takes in this SPA. `property` is the one the reference
// defect took and the one the sibling gate suppresses; it is high signal HERE
// only because the alias-back subtraction has already run.
//
// `(?!\s*\()` drops method calls, so `.total()` is not read as a column.
const read_shapes = (column) => [
  ['property', new RegExp(`\\.${column}\\b(?!\\s*\\()`)],
  [
    'accessor',
    new RegExp(`\\.get(?:In)?\\(\\s*(?:\\[\\s*)?['"\`]${column}['"\`]`)
  ],
  ['index', new RegExp(`\\[\\s*['"\`]${column}['"\`]\\s*\\]`)],
  [
    'field_key',
    new RegExp(
      `(?:column_id|accessorKey|player_value_path|column_name)\\s*:\\s*['"\`]${column}['"\`]`
    )
  ]
]

// Receiver shapes that are structurally not database rows. This is a list of
// BINDING FORMS, not of column names -- the distinction matters, because
// quieting this gate by column name is what made its predecessor unreadable.
// `event.target.value` is a DOM read whatever the schema calls `value`, and it
// stays a DOM read after the next conform.
const NON_ROW_RECEIVERS = [
  /\.target$/,
  /\.current$/,
  /^this\.state$/,
  /^this\.props$/,
  /^props$/
]

// A name shorter than this cannot be matched without swamping the report --
// `.to`, `.td`, `.f`. The sibling gate uses the same floor for the same reason.
// The COUNT is printed, so the narrowing is visible rather than silent.
const MIN_MATCHABLE_COLUMN_LENGTH = 3

/**
 * The redux store's top-level slice names, read off the root reducer.
 *
 * `state.getIn(['app', 'year'])` reads a store slice, not a row, and `app` is
 * also a retired column on `matchups`. Subtracting these is structural -- the
 * oracle is the checked-in reducer, so a slice that is renamed or removed moves
 * the subtraction with it -- and it only applies to the FIRST path segment. The
 * reference defect reads `rank` as a LATER segment
 * (`seasonlogs.getIn(['nfl_teams', team, key, 'rank'])`) and is untouched.
 *
 * @param {(p: string, e: string) => string} [read_file]
 * @returns {Set<string>}
 */
export const parse_store_slices = (read_file = fs.readFileSync) => {
  const source = read_file(
    path.join(repo_root, 'app', 'core', 'reducers.js'),
    'utf8'
  )
  const block = source.match(/combineReducers\(\{([\s\S]*?)\n {2}\}\)/)
  if (!block) {
    throw new Error(
      'could not parse combineReducers in app/core/reducers.js -- the store-slice subtraction would silently stop applying'
    )
  }
  return new Set(
    [...block[1].matchAll(/^\s{4}([a-z_][\w]*)\s*[,:]/gm)].map(
      (match) => match[1]
    )
  )
}

const receiver_of = (text, column, shape) => {
  const pattern =
    shape === 'property'
      ? new RegExp(`([A-Za-z_$][\\w$.]*)\\.${column}\\b`)
      : new RegExp(
          `([A-Za-z_$][\\w$.]*)\\.get(?:In)?\\(\\s*\\[?\\s*['"\`]${column}['"\`]`
        )
  const match = text.match(pattern)
  return match ? match[1] : null
}

const is_comment = (line) => {
  const trimmed = line.trim()
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  )
}

/**
 * Every SPA read of a candidate name, with the file, line and receiver.
 *
 * @param {object} params
 * @param {Map<string, Array<{table: string, new_name: string}>>} params.candidates
 * @param {string[]} [params.files]
 * @param {(p: string, e: string) => string} [params.read_file]
 * @returns {{ findings: object[], files: string[] }}
 */
export const collect_read_sites = ({
  candidates,
  files = walk_files(READER_ROOTS, ['.js', '.mjs']),
  read_file = fs.readFileSync,
  store_slices = new Set()
}) => {
  const patterns = new Map(
    [...candidates.keys()].map((column) => [column, read_shapes(column)])
  )
  const findings = []
  for (const file of files) {
    const relative_path = path.relative(repo_root, file)
    const lines = read_file(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (is_comment(line)) return
      for (const [column, shapes] of patterns) {
        const matched = shapes.find(([, pattern]) => pattern.test(line))
        if (!matched) continue
        const [shape] = matched
        const receiver = receiver_of(line.trim(), column, shape)
        if (receiver && NON_ROW_RECEIVERS.some((re) => re.test(receiver)))
          continue
        // A store slice read off `state` is not a row read. Anchored on the
        // receiver being `state` AND the name being a declared slice, so a row
        // that happens to be named `state` elsewhere is still judged.
        if (
          shape !== 'property' &&
          receiver === 'state' &&
          store_slices.has(column)
        )
          continue
        findings.push({
          column,
          shape,
          receiver,
          file: relative_path,
          line: index + 1,
          text: line.trim().slice(0, 140),
          retired_by: candidates
            .get(column)
            .map(({ table, new_name }) => `${table}.${column} -> ${new_name}`)
        })
      }
    })
  }
  return { findings, files }
}

/**
 * The candidate universe: retired, dead in the schema, and unaliased.
 *
 * @param {object} params
 * @returns {{ candidates: Map, subtracted: object }}
 */
export const build_candidates = ({ universe, live_columns, aliased }) => {
  const candidates = new Map()
  const still_live = []
  const alias_cleared = []
  const unmatchable = []
  for (const [column, retired_by] of universe) {
    if (column.length < MIN_MATCHABLE_COLUMN_LENGTH) {
      unmatchable.push(column)
      continue
    }
    if (live_columns.has(column)) {
      still_live.push(column)
      continue
    }
    if (aliased.has(column)) {
      alias_cleared.push(column)
      continue
    }
    candidates.set(column, retired_by)
  }
  // The alias-cleared names are NOT dropped. They are handed back so the caller
  // can scan them into a separate, non-gating tier -- see the header. A name
  // this gate cannot judge must still be visible to the reader.
  const ambiguous = new Map(
    alias_cleared.map((column) => [column, universe.get(column)])
  )

  return {
    candidates,
    ambiguous,
    subtracted: { still_live, alias_cleared, unmatchable }
  }
}

const load_adjudications = () => {
  if (!fs.existsSync(adjudications_path)) return []
  return JSON.parse(fs.readFileSync(adjudications_path, 'utf8')).adjudications
}

// Keyed on (column, file) with a required reason, per db/gates/README.md. A
// name-keyed entry would be a stoplist, which is the thing this gate exists to
// avoid; a NEW file reading an already-settled column is reported.
const apply_adjudications = (findings, adjudications) =>
  findings.map((finding) => {
    const entry = adjudications.find(
      (candidate) =>
        candidate.column === finding.column &&
        candidate.files.includes(finding.file)
    )
    return {
      ...finding,
      adjudicated: Boolean(entry),
      verdict: entry ? entry.verdict : null,
      reason: entry ? entry.reason : null
    }
  })

/**
 * The always-on controls. Both are TWO-SIDED: each plants a read the gate must
 * report alongside the read it must stay silent on, so a control cannot pass by
 * reporting nothing at all. A one-sided silent control is the shape
 * db/gates/README.md records as passing over anything.
 *
 * Verified to FAIL by construction on 2026-09-04: removing the `aliased.has`
 * branch in build_candidates takes `subtracts-alias-back` red, and removing the
 * `property` entry from read_shapes takes `detects-retired-unaliased-read` red.
 *
 * @param {object} params
 * @returns {Array<{ name: string, went_red: boolean }>}
 */
export const run_negative_controls = ({
  universe,
  live_columns,
  aliased,
  store_slices
}) => {
  const { candidates } = build_candidates({ universe, live_columns, aliased })
  const control_file = path.join(repo_root, 'app', '__negative_control__.js')

  // `pos` is retired, dead and unaliased ONLY as far as this gate's own
  // subtraction is concerned -- `get-roster.mjs` aliases it, so it is cleared.
  // The control therefore needs a name each side of the line, chosen from the
  // live universe rather than invented, so it moves when the schema does.
  const reportable = [...candidates.keys()].find((column) => column === 'dwn')
  const cleared = aliased.has('rid') ? 'rid' : null

  const slice = [...store_slices].find((name) => universe.has(name))

  if (!reportable || !cleared || !slice) {
    // A control that cannot be constructed has not passed. Say so.
    return [
      { name: 'detects-retired-unaliased-read', went_red: false },
      { name: 'subtracts-alias-back', went_red: false },
      { name: 'subtracts-store-slice', went_red: false }
    ]
  }

  const planted = [
    `const a = gamelog.${reportable}`,
    `const b = roster_player.${cleared}`,
    `const c = state.getIn(['${slice}', 'league_id'])`
  ].join('\n')

  const { findings } = collect_read_sites({
    candidates,
    files: [control_file],
    read_file: () => planted,
    store_slices
  })
  const columns = new Set(findings.map((finding) => finding.column))

  // Each control is two-sided: the silent half is asserted ALONGSIDE the half
  // that must fire, so a run that reports nothing at all fails rather than
  // passing over everything.
  return [
    {
      name: `detects-retired-unaliased-read (${reportable})`,
      went_red: columns.has(reportable)
    },
    {
      name: `subtracts-alias-back (${cleared} silent, ${reportable} reported)`,
      went_red: !columns.has(cleared) && columns.has(reportable)
    },
    {
      name: `subtracts-store-slice (${slice} silent, ${reportable} reported)`,
      went_red: !columns.has(slice) && columns.has(reportable)
    }
  ]
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('json', { type: 'boolean', default: false })
    .option('unadjudicated', {
      type: 'boolean',
      default: false,
      describe: 'report only findings no adjudication covers'
    })
    .parse()

  if (!fs.existsSync(schema_path)) {
    console.error(`missing schema file: ${schema_path}`)
    process.exit(2)
  }

  let universe
  try {
    universe = await load_rename_universe()
  } catch (error) {
    console.error(String(error.message))
    process.exit(2)
  }

  const live_columns = parse_live_columns(fs.readFileSync(schema_path, 'utf8'))
  const aliased = collect_alias_backs(universe.keys())
  let store_slices
  try {
    store_slices = parse_store_slices()
  } catch (error) {
    console.error(String(error.message))
    process.exit(2)
  }
  const { candidates, ambiguous, subtracted } = build_candidates({
    universe,
    live_columns,
    aliased
  })

  const files = walk_files(READER_ROOTS, ['.js', '.mjs'])
  const corpus_counts = count_files_by_root({
    files,
    roots: READER_ROOTS,
    repo_root
  })
  const corpus = resolve_corpus({
    roots: READER_ROOTS,
    repo_root,
    counts: corpus_counts
  })

  const { findings } = collect_read_sites({ candidates, files, store_slices })
  const ambiguous_findings = collect_read_sites({
    candidates: ambiguous,
    files,
    store_slices
  }).findings
  const adjudicated = apply_adjudications(findings, load_adjudications())
  const reportable = argv.unadjudicated
    ? adjudicated.filter((finding) => !finding.adjudicated)
    : adjudicated
  const unadjudicated = adjudicated.filter((finding) => !finding.adjudicated)

  const controls = run_negative_controls({
    universe,
    live_columns,
    aliased,
    store_slices
  })

  if (argv.json) {
    console.log(
      JSON.stringify(
        {
          corpus,
          candidates: [...candidates.keys()],
          findings: reportable,
          alias_ambiguous: ambiguous_findings,
          controls
        },
        null,
        2
      )
    )
    process.exit(unadjudicated.length ? 1 : 0)
  }

  console.log(format_corpus({ corpus, counts: corpus_counts }))
  console.log('')
  console.log('UNIVERSE')
  console.log(
    `  ${universe.size} retired names across ${RENAME_MAP_SOURCES.length} rename maps`
  )
  console.log(
    `  ${subtracted.still_live.length} still live on some table -- not judged`
  )
  console.log(
    `  ${subtracted.alias_cleared.length} aliased back onto the wire -- not judged: ${subtracted.alias_cleared.sort().join(', ')}`
  )
  console.log(
    `  ${subtracted.unmatchable.length} shorter than ${MIN_MATCHABLE_COLUMN_LENGTH} characters -- not matchable`
  )
  // The full candidate list is a wall of several hundred names nobody reads on
  // a green run. The COUNT is the load-bearing number; --json carries the list.
  console.log(`  ${candidates.size} candidates judged (full list under --json)`)
  console.log('')
  console.log(format_negative_controls({ controls }))
  console.log('')

  // Printed BEFORE the findings, for the same reason the corpus block is: a
  // reader who stops early should already know what the verdict does not cover.
  const ambiguous_by_column = new Map()
  for (const finding of ambiguous_findings) {
    if (!ambiguous_by_column.has(finding.column))
      ambiguous_by_column.set(finding.column, [])
    ambiguous_by_column.get(finding.column).push(finding)
  }
  console.log(
    'ALIAS-AMBIGUOUS -- read in the SPA, aliased back by SOME producer'
  )
  console.log(
    '  Not judged and NOT covered by the verdict below. This gate cannot prove'
  )
  console.log(
    '  which producer fed a given read, so a name one producer keeps on the wire'
  )
  console.log('  is cleared everywhere. Check these by hand against the route')
  console.log('  that actually feeds each component.')
  for (const [column, sites] of [...ambiguous_by_column].sort()) {
    console.log(
      `  ${column} -- ${sites.length} site(s), aliased by ${aliased.get(column).join(', ')}`
    )
    for (const site of sites)
      console.log(
        `      ${site.file}:${site.line} [${site.shape}] ${site.text.slice(0, 90)}`
      )
  }
  if (!ambiguous_by_column.size) console.log('  none')
  console.log('')

  for (const finding of reportable.sort(
    (a, b) =>
      a.column.localeCompare(b.column) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
  )) {
    const mark = finding.adjudicated
      ? `[${finding.verdict}]`
      : '[UNADJUDICATED]'
    console.log(
      `${mark} ${finding.column} ${finding.file}:${finding.line} [${finding.shape}] ${finding.text}`
    )
    console.log(`    retired by: ${finding.retired_by.join(' | ')}`)
    if (finding.reason) console.log(`    ${finding.reason}`)
  }

  // "An adjudication that suppresses nothing is itself a finding" --
  // db/gates/README.md. A repaired site must force its entry out rather than
  // leaving a standing exemption for the name, which is how a per-site
  // adjudication file decays into the stoplist it was written to replace.
  const covered = new Set(
    findings.map((finding) => `${finding.column}|${finding.file}`)
  )
  const stale_adjudications = []
  for (const entry of load_adjudications()) {
    for (const file of entry.files) {
      if (!covered.has(`${entry.column}|${file}`))
        stale_adjudications.push(`${entry.column} ${file}`)
    }
  }

  const blind = controls.some((control) => !control.went_red)
  console.log('')
  if (stale_adjudications.length) {
    console.log(
      `STALE ADJUDICATIONS -- ${stale_adjudications.length} entr(ies) suppress nothing; the site was repaired or moved and the exemption must come out:`
    )
    for (const entry of stale_adjudications) console.log(`  ${entry}`)
    console.log('')
  }
  if (blind) {
    console.log(
      'GATE BLIND -- a negative control did not fire; the verdict below means nothing'
    )
    process.exit(2)
  }
  if (unadjudicated.length || stale_adjudications.length) {
    const parts = []
    if (unadjudicated.length)
      parts.push(`${unadjudicated.length} unadjudicated stale SPA read(s)`)
    if (stale_adjudications.length)
      parts.push(
        `${stale_adjudications.length} adjudication(s) suppressing nothing`
      )
    console.log(`GATE FAILED${verdict_suffix(corpus)} -- ${parts.join(', ')}`)
    process.exit(1)
  }
  const ambiguous_note = ambiguous_by_column.size
    ? ` (ALIAS-AMBIGUOUS not covered: ${[...ambiguous_by_column.keys()].sort().join(', ')})`
    : ''
  console.log(
    `GATE OK${verdict_suffix(corpus)} -- ${findings.length} site(s), all adjudicated${ambiguous_note}`
  )
}

main()
