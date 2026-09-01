// Resolves knex column references that name no table LITERALLY, by binding them
// to a table through the statement they sit in -- the two shapes every other
// rename gate here is structurally blind to.
//
// THE GAP THIS CLOSES, and why it is not the one it looks like.
//
// `37cc9f36b` fixed a live 42703 that had aborted every
// `generate-league-team-player-seasonlogs` run:
// `libs-server/league-team-player-seasonlogs/compute-roster-slot-metrics.mjs`
// named `rosters_players.year` at two sites after the season_grain conform
// renamed it to `season_year`. Neither site was reachable by any gate:
//
//   .where({ lid, year })                      <- OBJECT SHORTHAND. Names no
//                                                 table. The statement's FROM
//                                                 target IS db('rosters_players'),
//                                                 so the binding is available --
//                                                 nothing was reading it.
//   .andOn('r.year', '=', 'n.season_year')     <- ALIAS-QUALIFIED. `r` is bound
//                                                 by .join('rosters_players as r'),
//                                                 so the binding is again
//                                                 available and unread.
//
// That defect was initially diagnosed as an instance of gate 2's documented
// join-only blind spot, and the prescribed remedy was to widen
// `check-renamed-column-consumers`'s `from_re` to `.join`/`.leftJoin` literals.
// THAT REMEDY WAS MEASURED AND DOES NOT WORK. At `37cc9f36b~1` with
// `--base 8f1abd79d~1`, widening `from_re` takes the candidate set from 259 to
// 284 sites and reopens 37 adjudications -- the exact cost that gate's header
// predicts -- and still reports this file ZERO times.
//
// The reason is that gate 2 is answering a different question. Both statements
// above carry an explicit projection (`.select('tid', 'pid')` and
// `.select('r.tid', 'g.pid')`), so gate 2 skips them BY DESIGN and correctly:
// its class is the SILENT one, where a wholesale select drops the old key with
// no error. A stale column in a predicate is the LOUD class -- Postgres raises
// 42703 -- which is gate 1's question, and gate 1 only reads
// `'<realtable>.<column>'` literals. The uncovered surface is therefore not
// "joined tables" at all. It is "column references that do not name a table",
// which is most of them.
//
// WHAT THIS GATE DOES. For each knex statement it builds the alias environment
// the statement itself declares -- the FROM target, every `.from(...)`, and every
// join -- and then resolves each column reference in that statement against
// `db/schema.postgres.sql`:
//
//   QUALIFIED   'r.year'          -> `r` is bound to rosters_players -> resolve
//   UNQUALIFIED .where({ year })  -> resolve ONLY when exactly one table is in
//                                    scope, because with a join present an
//                                    unqualified name is genuinely ambiguous and
//                                    guessing a table would invent findings
//   BARE STRING .where('status')  -> same single-table restriction
//
// THE BARE-STRING HALF, added later, is the shape this codebase writes most and
// the one `check-api-response-shapes` stumbled into rather than resolved.
// `api/routes/wagers.mjs` filtered `whereIn('status', wager_status)` against
// `placed_wagers`, which has no `status` column -- a live 42703 on every request
// carrying that filter, fixed in `2f0ca9a0f`. Gate 1 cannot see it (no table in
// the literal) and the object-key half cannot either (no object). It reads the
// first argument of the predicate family (`.where`, `.whereIn`, `.whereNull`,
// `.orderBy`, ...) and every argument of the list family (`.groupBy`,
// `.onConflict`, `.merge`) -- the last of which CLAUDE.md records as its own
// recurring defect, since payload keys, conflict target and merge list are three
// separate column references and a rename fix touching one need not touch them.
//
// A FOURTH SHAPE, added later, is the only one whose columns are not in the
// statement at all: an INSERT or UPDATE payload passed by NAME.
//
//   INDIRECT    .insert(inserts)  -> resolve `inserts` back to the object
//                                    literals that built it, in this file, and
//                                    read their keys against the bound table
//
// It is here because the three above cover the MINORITY of this tree's writes:
// `.insert({ ... })` inline appears 61 times and `.insert(<identifier>)` 206.
// A payload accumulated into an array and handed to `batch_insert` carries no
// column literal any of the passes above can see, which is how `72346e579`
// renamed `player_gamelogs.pos` to `player_position` across 204 columns, missed
// `scripts/import-nflverse-weekly-rosters.mjs`, and left this gate printing
// GATE OK over an importer that died on 42703 every run for weeks. The
// resolution itself, the two shapes it must DECLINE, and why, are in
// `insert-payload-resolution.mjs`; controls 12-15 drive it as two
// report/decline pairs.
//
// An OUTPUT ALIAS the statement declares for itself is excluded, because a bare
// reference to one is correct SQL: `.count('* as count')` then `.orderBy('count')`
// resolves against the projection, not the table. Same concept as the shadowed
// CTE prefixes, one level down. Measured on this corpus, the exclusion is the
// difference between 9 findings and 1 -- the 8 it removes are all that shape, and
// the 1 that survives is real. Control 6 exists because an exclusion that removes
// 8 of 9 findings is indistinguishable from a collector that finds nothing.
//
// WHAT THIS RESOLVES IS NAMES, NOT TYPES -- do not over-trust a green.
// `.where('public', true)` against `placed_wagers.public`, a `smallint`, PASSES
// this gate and every other name-resolution gate here: the column exists, and it
// is the bound VALUE that is wrong. Postgres rejects it only at execution, with
// `invalid input syntax for type smallint: "true"`. That defect shipped in the
// same route as the `status` 42703 above and broke every authenticated caller
// viewing another user's wagers. No static name check can see that class; only
// executing the predicate against a real schema distinguishes it, which is why
// the spec for that route seeds rows and runs the round trip.
//
// It needs NO rename list and NO base ref: a reference either resolves against
// the current schema or it does not, which makes it the same shape as gate 1 --
// it cannot drift, and it cannot go red on a sibling's in-flight migration the
// way a base-diffing gate can. It is therefore CI-eligible on the same terms as
// gate 1, and it is in the CI step.
//
// Usage:
//   node db/gates/check-knex-column-resolution.mjs
//   node db/gates/check-knex-column-resolution.mjs --json
//   node db/gates/check-knex-column-resolution.mjs --unadjudicated
//
// Exit 1 on an unadjudicated finding, on a stale adjudication, on a failed
// negative control, or on a declared corpus root that is PRESENT and contributing
// nothing. A root that is not on disk at all narrows the verdict instead, through
// the CORPUS block. Exit 2 on a missing schema file.
//
// ACCEPTANCE TEST -- proven, not asserted. In a worktree at `37cc9f36b~1` with
// this gate and its adjudications copied in (the gate is a SCANNER, so the code
// it reads is the unmodified pre-fix code; nothing was extracted to make it
// testable, which is the failure mode CLAUDE.md warns about):
//
//   node db/gates/check-knex-column-resolution.mjs --unadjudicated
//
// reports exactly the two sites above and exits 1. At `37cc9f36b` or later it
// reports neither and exits 0.
//
// NEGATIVE CONTROLS run on EVERY invocation and a control reporting STAYED GREEN
// fails the run, per the runner's rule. There are eleven, and four of them run in
// the OVER-EAGER direction, because half of what this gate does is decide that a
// token is NOT a column reference and an over-eager filter fails in the direction
// that looks like success. See run_negative_controls.
//
// The first four are also what proves the scan is not vacuous, which is why this
// gate carries no coverage-floor number. Measured by emptying the corpus, by making
// statement extraction return nothing, and by making alias binding always fail: all
// four go red with NO MATERIAL in every case, because each one has to FIND real
// corpus material of its shape before it can mutate it. Coverage is asserted only
// where those controls are blind -- per root, since one root going dark leaves
// plenty of material for a control to pick. See ROOT_EXPECTATIONS.
//
// BLIND SPOTS -- a floor, not a proof.
//   - A `db.raw(...)` body is not parsed. Raw SQL is arbitrary text and a
//     half-parse invents findings; those statements are counted as UNCHECKED and
//     printed in the coverage block rather than passed over silently.
//   - An unqualified or bare reference inside a MULTI-table statement is
//     ambiguous and is not resolved. Counted as UNCHECKED.
//   - A bare reference to an alias the statement projects for itself is not
//     resolved. Counted as UNCHECKED, and printed.
//   - A table name held in a constant binds no alias, so its statement resolves
//     nothing. Same hazard CLAUDE.md records for table-anchored counts generally.
//   - A prefix bound to a subquery (`.as('x')`) or a CTE (`.with('x', ...)`) is
//     recorded as SHADOWED and skipped -- it legitimately projects columns no
//     physical table has.
//
// Uses console.log deliberately, never `debug`: the ESM import graph clobbers the
// namespace set before a module-scope `debug.enable` runs, and an oracle whose
// verdict depends on winning that negotiation has no audit trail.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  build_alias_environment,
  collect_statements,
  each_call,
  parse_schema,
  split_top_level,
  unwrap_array_argument,
  walk_files as walk_files_in
} from './knex-statement-machinery.mjs'
import { resolve_insert_payload } from './insert-payload-resolution.mjs'
import {
  format_corpus,
  resolve_corpus,
  verdict_suffix
} from './scan-corpus.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')

const adjudications_path = path.join(
  __dirname,
  'knex-column-resolution-adjudications.json'
)

// The corpus, declared as an EXPECTATION per root rather than as a bare list.
// `queries_the_database` is what each root must prove about itself: every root
// here opens knex statements except `libs-shared`, which is isomorphic and reaches
// the SPA bundle, where there is no knex and no `process`. So the `false` is not a
// coverage exemption -- it is an architectural assertion, and a knex statement
// appearing there is a finding rather than a number moving.
//
// This is asserted PER ROOT, and it replaced three global minimums on files
// scanned, statements parsed and references resolved. Two reasons, one measured.
// The global floors were redundant: with the corpus emptied, FOUR of the negative
// controls below already fail with NO MATERIAL, as they do when statement
// extraction returns nothing or alias binding always fails, so nothing was left
// for a floor to catch on the vacuous-scan case it was written for. And they could
// not see the failure that is actually reachable here -- ONE root going dark, which
// `walk_files` swallows by design, since it treats an unreadable directory as
// empty. `jobs` contributes 4 statements of 1493, so no plausible global number
// notices its loss; the three that stood sat at 22%, 54% and 45% of live coverage,
// loose enough that a scan could silently halve and still pass. They were also
// hand-maintained numbers, which operation-log entry 005 records as the same class
// of thing as a header someone must remember to rewrite: ordinary churn moves them,
// so an exact match turns unrelated commits red and a loose band is what you get.
//
// Nothing below is a measurement, so nothing here needs maintaining when coverage
// changes. `SERVER_ROOTS` derives from it so the two cannot disagree.
//
// `private` is a submodule NO workflow checks out, so on a CI runner it is a
// present, EMPTY directory rather than a root that went dark. That is the
// distinction `evaluate_root_coverage` draws through the corpus below: unread
// narrows the verdict, dark fails it.
const ROOT_EXPECTATIONS = {
  api: { queries_the_database: true },
  'libs-server': { queries_the_database: true },
  'libs-shared': { queries_the_database: false },
  scripts: { queries_the_database: true },
  jobs: { queries_the_database: true },
  private: { queries_the_database: true }
}

const SERVER_ROOTS = Object.keys(ROOT_EXPECTATIONS)

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// corpus
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// statement extraction
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// alias environment
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// column references
// ---------------------------------------------------------------------------

// A quoted `'prefix.column'` literal anywhere in the statement. This is the
// alias-qualified shape (`'r.year'`); when the prefix happens to be a real table
// name gate 1 already covers it, and agreeing with gate 1 costs nothing.
const QUALIFIED_REFERENCE_RE =
  /['"`]([a-z_][a-z_0-9]*)\.([a-z_][a-z_0-9]*)['"`]/g

// `'transactions.json'` parses as a qualified column because the stem is a real
// table. A file extension is never a column.
const FILE_EXTENSION_SUFFIXES = new Set([
  'csv',
  'json',
  'js',
  'mjs',
  'md',
  'sql',
  'txt',
  'yml',
  'yaml',
  'html',
  'css'
])

// A SQL function or wildcard is not a column: `.count('rp.*')`, `'r.pid as x'`
// is handled by the regex not matching past the identifier.
const is_not_a_column = (name) =>
  name === '*' || FILE_EXTENSION_SUFFIXES.has(name)

// The predicate methods whose FIRST argument may be an object literal of column
// keys. `.where({ lid, year })` is the shape that broke; `.andWhere`, `.orWhere`
// and the join-clause `.on` family write it too.
const OBJECT_PREDICATE_METHODS = [
  'where',
  'andWhere',
  'orWhere',
  'whereNot',
  'having',
  'first',
  'insert',
  'update',
  'onConflict'
]

// The keys of an object literal passed to a predicate method. Both the explicit
// `{ season_year: year }` and the shorthand `{ lid, year }` forms; the shorthand
// is the one no grep finds, because it reads as a local variable.
//
// Deliberately does NOT descend into a nested object or a function body: a
// `.where(function () { ... })` callback carries its own qualified references,
// which the qualified scan already reads.
const collect_object_predicate_keys = (statement) => {
  const keys = []
  const method_re = new RegExp(
    `\\.(?:${OBJECT_PREDICATE_METHODS.join('|')})\\(\\s*\\{`,
    'g'
  )
  let match
  while ((match = method_re.exec(statement)) !== null) {
    const open_index = statement.indexOf('{', match.index)
    let depth = 0
    let end = -1
    for (let index = open_index; index < statement.length; index++) {
      if (statement[index] === '{') depth += 1
      else if (statement[index] === '}') {
        depth -= 1
        if (depth === 0) {
          end = index
          break
        }
      }
    }
    if (end === -1) continue
    const body = statement.slice(open_index + 1, end)
    // Only top-level keys of THIS object; a nested object is a different scope.
    let nesting = 0
    for (const segment of body.split(',')) {
      const before = nesting
      nesting += (segment.match(/[{[(]/g) || []).length
      nesting -= (segment.match(/[}\])]/g) || []).length
      if (before !== 0) continue
      const key_match = segment.match(/^\s*([a-z_][a-z_0-9]*)\s*(:|$)/i)
      if (!key_match) continue
      keys.push({
        column: key_match[1],
        offset: open_index + 1 + body.indexOf(segment)
      })
    }
    method_re.lastIndex = end
  }
  return keys
}

// The BARE-STRING argument shape, which is most of what this codebase writes:
// `.where('status', x)`, `.whereIn('status', [...])`, `.orderBy('week')`,
// `.groupBy('pid')`, `.onConflict(['pid'])`, `.merge([...])`. It carries no
// table and no `.`, so gate 1 cannot see it and the qualified scan above does
// not match it -- this is the `placed_wagers.status` 42703's shape.
//
// Two argument conventions, and conflating them would resolve DATA as columns.
// For the predicate family only the FIRST argument is a column: `.where('type',
// 'TRADE')` binds a string VALUE second. For the list family every argument is
// a column, and the whole list may arrive inside one array.
const BARE_FIRST_ARGUMENT_METHODS = new Set([
  'where',
  'andWhere',
  'orWhere',
  'whereNot',
  'orWhereNot',
  'whereIn',
  'whereNotIn',
  'orWhereIn',
  'orWhereNotIn',
  'whereNull',
  'whereNotNull',
  'orWhereNull',
  'orWhereNotNull',
  'whereBetween',
  'whereNotBetween',
  'having',
  'orderBy'
])

const BARE_COLUMN_LIST_METHODS = new Set(['groupBy', 'onConflict', 'merge'])

// The methods whose argument may be an IDENTIFIER naming a payload object built
// elsewhere. `insert` and `update` only: every other method taking a bare
// identifier takes a VALUE, and reading one as a column list would resolve data.
const PAYLOAD_METHODS = new Set(['insert', 'update'])

// The methods that DECLARE an output alias. A bare reference to one is legal
// SQL -- Postgres resolves `.orderBy('count')` against the `.count('* as
// count')` projection, not against the table -- so those references must be
// excluded or the gate reports correct code. Same concept as
// collect_shadowed_prefixes, one level down: that one excludes PREFIXES bound
// to a non-table, this one excludes NAMES projected by the statement itself.
const OUTPUT_ALIAS_METHODS = new Set([
  'select',
  'raw',
  'count',
  'countDistinct',
  'sum',
  'min',
  'max',
  'avg',
  'first'
])

// A whole argument that is exactly one quoted identifier. Anchored on both
// ends deliberately: `'* as count'` is a projection and `'r.year'` belongs to
// the qualified scan, and neither must reach the bare resolver.
const BARE_LITERAL_RE = /^\s*['"`]([a-z_][a-z_0-9]*)['"`]\s*$/i

const collect_bare_predicate_columns = (statement) => {
  const references = []
  const methods = new Set([
    ...BARE_FIRST_ARGUMENT_METHODS,
    ...BARE_COLUMN_LIST_METHODS
  ])
  for (const call of each_call(statement, methods)) {
    const is_list = BARE_COLUMN_LIST_METHODS.has(call.method)
    const { text, offset } = is_list
      ? unwrap_array_argument(call.body)
      : { text: call.body, offset: 0 }
    const all_segments = split_top_level(text)
    const segments = is_list ? all_segments : all_segments.slice(0, 1)
    for (const segment of segments) {
      const literal = segment.text.match(BARE_LITERAL_RE)
      if (!literal) continue
      // Point at the OPENING QUOTE, not at the segment. A segment carries the
      // leading whitespace of a wrapped argument list, and an offset that lands
      // on a newline silently mis-slices anything reading the literal back.
      references.push({
        column: literal[1],
        offset:
          call.body_offset +
          offset +
          segment.offset +
          segment.text.indexOf(literal[1]) -
          1
      })
    }
  }
  return references
}

const collect_output_aliases = (statement) => {
  const aliases = new Set()
  for (const call of each_call(statement, OUTPUT_ALIAS_METHODS)) {
    // Both spellings: a quoted `'tid as teamid'` projection and a bare
    // `AS teamid` inside a raw SQL body.
    const alias_re = /\bas\s+['"`]?([a-z_][a-z_0-9]*)['"`]?/gi
    let match
    while ((match = alias_re.exec(call.body)) !== null) aliases.add(match[1])
  }
  return aliases
}

const RAW_CALL_RE = /\.raw\(|db\.raw\(|knex\.raw\(/

// ---------------------------------------------------------------------------
// the scan
// ---------------------------------------------------------------------------

const is_comment_line = (line) => {
  const trimmed = line.trim()
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  )
}

const scan_source = ({ source, relative_path, tables, stats }) => {
  const findings = []
  const line_starts = []
  {
    let index = 0
    for (const line of source.split('\n')) {
      line_starts.push(index)
      index += line.length + 1
    }
  }
  const line_of = (offset) => {
    let low = 0
    let high = line_starts.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (line_starts[mid] <= offset) low = mid
      else high = mid - 1
    }
    return low + 1
  }
  const lines = source.split('\n')

  for (const statement of collect_statements(source)) {
    stats.statements += 1
    const { bindings, tables_in_scope, shadowed } = build_alias_environment(
      statement.text,
      tables
    )
    if (!tables_in_scope.size) {
      stats.unchecked_no_binding += 1
      continue
    }
    if (RAW_CALL_RE.test(statement.text)) stats.statements_with_raw += 1

    // A file offset, so a reference that lives OUTSIDE the statement -- an insert
    // payload built elsewhere and passed by name -- is reported at the literal it
    // was actually written on rather than at the statement that consumes it.
    const report_at = (column, table, shape, file_offset) => {
      const line = line_of(file_offset)
      if (is_comment_line(lines[line - 1] || '')) return
      findings.push({
        table,
        column,
        shape,
        file: relative_path,
        line,
        text: (lines[line - 1] || '').trim().slice(0, 140)
      })
    }

    const report = (column, table, shape, offset) =>
      report_at(column, table, shape, statement.offset + offset)

    // QUALIFIED -- 'prefix.column', prefix resolved through the environment.
    QUALIFIED_REFERENCE_RE.lastIndex = 0
    let match
    while ((match = QUALIFIED_REFERENCE_RE.exec(statement.text)) !== null) {
      const [, prefix, column] = match
      if (is_not_a_column(column)) continue
      if (shadowed.has(prefix)) {
        stats.unchecked_shadowed += 1
        continue
      }
      const table = bindings.get(prefix)
      if (!table) {
        stats.unchecked_unbound_prefix += 1
        continue
      }
      stats.resolved += 1
      if (tables.get(table).has(column)) continue
      report(column, table, 'qualified', match.index)
    }

    // UNQUALIFIED -- resolvable only when exactly one table is in scope.
    const keys = collect_object_predicate_keys(statement.text)
    const bare_references = collect_bare_predicate_columns(statement.text)
    if (tables_in_scope.size !== 1) {
      stats.unchecked_ambiguous += keys.length + bare_references.length
      continue
    }
    const [only_table] = tables_in_scope
    for (const key of keys) {
      stats.resolved += 1
      if (tables.get(only_table).has(key.column)) continue
      report(key.column, only_table, 'unqualified', key.offset)
    }

    // BARE STRING -- same single-table restriction, minus the names the
    // statement projects for itself.
    const output_aliases = collect_output_aliases(statement.text)
    for (const reference of bare_references) {
      if (output_aliases.has(reference.column)) {
        stats.unchecked_output_alias += 1
        continue
      }
      stats.resolved += 1
      if (tables.get(only_table).has(reference.column)) continue
      report(reference.column, only_table, 'bare', reference.offset)
    }

    // INDIRECT PAYLOAD -- `.insert(inserts)` / `.update(payload)`, where the keys
    // live in an object literal built elsewhere in the file. The dominant write
    // shape here and the one every other pass is structurally blind to, since the
    // statement text contains no column at all.
    for (const call of each_call(statement.text, PAYLOAD_METHODS)) {
      const identifier = call.body.match(/^\s*([a-z_][a-z_0-9]*)\s*$/i)
      if (!identifier) continue
      const payload = resolve_insert_payload({
        source,
        identifier: identifier[1],
        statement_offset: statement.offset
      })
      if (payload.status !== 'resolved') {
        stats.unchecked_payload += 1
        stats.payload_decline_reasons.push(
          `${relative_path}:${line_of(statement.offset)} ${payload.reason}`
        )
        continue
      }
      stats.payloads_resolved += 1
      if (payload.partial) stats.payloads_partial += 1
      for (const key of payload.keys) {
        stats.resolved += 1
        if (tables.get(only_table).has(key.column)) continue
        report_at(key.column, only_table, 'indirect-payload', key.offset)
      }
    }
  }
  return findings
}

const run_scan = (tables, { source_override } = {}) => {
  const stats = {
    files: 0,
    statements: 0,
    resolved: 0,
    statements_with_raw: 0,
    unchecked_no_binding: 0,
    unchecked_shadowed: 0,
    unchecked_unbound_prefix: 0,
    unchecked_ambiguous: 0,
    unchecked_output_alias: 0,
    unchecked_payload: 0,
    payloads_resolved: 0,
    payloads_partial: 0,
    // Kept as text rather than a count: a payload this cannot read is the
    // denominator question, and a bare number does not tell you whether the
    // resolver lost a shape it used to see.
    payload_decline_reasons: [],
    // Per root, so the coverage verdict can name WHICH root went dark rather than
    // reporting a total that moves with every ordinary commit.
    by_root: {}
  }
  const findings = []
  for (const root of SERVER_ROOTS) {
    const at_root_start = {
      files: stats.files,
      statements: stats.statements,
      resolved: stats.resolved
    }
    for (const file of walk_files_in([root], ['.mjs', '.js'], repo_root)) {
      const relative_path = path.relative(repo_root, file)
      const source =
        source_override && source_override.file === relative_path
          ? source_override.source
          : fs.readFileSync(file, 'utf8')
      stats.files += 1
      findings.push(...scan_source({ source, relative_path, tables, stats }))
    }
    stats.by_root[root] = {
      files: stats.files - at_root_start.files,
      statements: stats.statements - at_root_start.statements,
      resolved: stats.resolved - at_root_start.resolved
    }
  }
  return { findings, stats }
}

// ---------------------------------------------------------------------------
// coverage
// ---------------------------------------------------------------------------

/**
 * The coverage verdict, as a pure function of the per-root counts so a control can
 * drive it with a root deliberately darkened.
 *
 * Every root must contribute at least one FILE -- a root contributing none is the
 * path-depth failure `db/README.md` records, where this tooling resolves the repo
 * root as `path.join(__dirname, '..', '..')` and a move to a different depth
 * silently empties the scan set at exit 0. A root that queries the database must
 * additionally contribute at least one STATEMENT, and one that does not must
 * contribute exactly zero.
 *
 * `unread` carries the roots that are ABSENT OR EMPTY ON DISK, and those are
 * excluded here rather than failed. The two conditions are different defects
 * and want different verdicts: a root that is not on disk at all --
 * `private`, an uninitialized submodule, on every CI runner -- narrows what
 * this run can claim, which the CORPUS block states and `verdict_suffix`
 * carries into the verdict line. A root that IS on disk and still contributes
 * nothing is the scan failing to reach it, which is a real coverage failure.
 * Collapsing the two would turn every CI run red on a condition CI is
 * configured for.
 *
 * `unread` must therefore be resolved from the FILESYSTEM, never from this
 * run's own file counts. Deriving it from counts is what the first version of
 * this wiring did, and it silently disabled both branches below: a
 * zero-file root lands in the counts-derived missing set by construction, so
 * every root that could fail was skipped before it was tested. Nothing in the
 * output changed -- the gate kept printing GATE OK, and the path-depth
 * regression the paragraph above exists to catch went back to exiting 0.
 * Control 11 drives this distinction on the live path.
 *
 * Every root being unread is NOT a narrowed verdict, it is the path-depth
 * failure itself, so it fails rather than qualifying.
 *
 * @param {object} by_root per-root { files, statements, resolved } counts
 * @param {string[]} [unread] roots absent or empty ON DISK
 * @returns {string[]}
 */
const evaluate_root_coverage = (by_root, unread = []) => {
  const failures = []
  const roots = Object.keys(ROOT_EXPECTATIONS)
  if (roots.every((root) => unread.includes(root)))
    failures.push(
      'no declared root is readable at all -- the scan is not reaching the ' +
        'repository (check the repo root this file resolves)'
    )
  for (const [root, expectation] of Object.entries(ROOT_EXPECTATIONS)) {
    if (unread.includes(root)) continue
    const counts = by_root[root]
    if (!counts) {
      failures.push(`${root} was not walked at all`)
      continue
    }
    if (!counts.files) {
      failures.push(
        `${root} contributed no files -- the scan is not reaching it`
      )
      continue
    }
    if (expectation.queries_the_database && !counts.statements)
      failures.push(
        `${root} contributed ${counts.files} file(s) and no knex statements`
      )
    if (!expectation.queries_the_database && counts.statements)
      failures.push(
        `${root} is isomorphic and must open no knex statement, but ` +
          `${counts.statements} were parsed there`
      )
  }
  return failures
}

/**
 * The ONLY source of the coverage verdict's exclusion set, resolved from the
 * filesystem and deliberately taking no counts.
 *
 * It is a named function with exactly two callers -- `main` and control 11 --
 * so that rewiring it to this run's file counts, which is the mistake that
 * silently disabled the whole assertion once, fails the control rather than
 * passing quietly. A control that reached for `resolve_corpus` itself would
 * pin the module's behavior instead of this gate's choice, and stay green over
 * exactly that rewiring.
 *
 * @returns {string[]} declared roots that are absent or empty on disk
 */
const coverage_exclusions = () =>
  resolve_corpus({ roots: SERVER_ROOTS, repo_root }).missing

// ---------------------------------------------------------------------------
// adjudication
// ---------------------------------------------------------------------------

// Per (file, table, column) with a required reason. Never per NAME: a stoplist
// of common column names is what hid `scoring_format_player_projection_points
// .total` from the gate built to catch it, over a defect that wiped a year of
// projection values. An entry that suppresses nothing is itself a finding, so a
// repaired site forces its entry out rather than leaving a standing exemption.
const load_adjudications = () => {
  if (!fs.existsSync(adjudications_path)) return []
  return JSON.parse(fs.readFileSync(adjudications_path, 'utf8')).adjudications
}

const apply_adjudications = (findings, adjudications) => {
  const used = new Set()
  const applied = findings.map((finding) => {
    const index = adjudications.findIndex(
      (entry) =>
        entry.file === finding.file &&
        entry.table === finding.table &&
        entry.column === finding.column
    )
    if (index !== -1) used.add(index)
    return {
      ...finding,
      adjudicated: index !== -1,
      verdict: index !== -1 ? adjudications[index].verdict : null,
      reason: index !== -1 ? adjudications[index].reason : null
    }
  })
  const stale = adjudications.filter((_, index) => !used.has(index))
  return { applied, stale }
}

// ---------------------------------------------------------------------------
// negative controls
// ---------------------------------------------------------------------------

// Eleven controls, run on EVERY invocation. Four of them assert the gate stays
// SILENT on a mutation, because half of what this gate does is decide a token is
// NOT a column reference -- and an over-eager filter fails in the direction that
// looks like success. `check-league-schema-consumers` shipped exactly that:
// its control mutated a `FROM` inside a COMMENT, the query came back identical,
// EXPLAIN succeeded, and the control reported STAYED GREEN over a working gate.
//
// Each control mutates REAL corpus material rather than a synthetic fixture, so
// a control passing is also evidence the extraction still reaches the corpus.
const run_negative_controls = (tables) => {
  const controls = []

  // Pick a real statement of each shape to mutate, so a control cannot go
  // vacuous by being aimed at material that no longer exists.
  const pick = (predicate) => {
    for (const file of walk_files_in(
      SERVER_ROOTS,
      ['.mjs', '.js'],
      repo_root
    )) {
      const source = fs.readFileSync(file, 'utf8')
      const relative_path = path.relative(repo_root, file)
      for (const statement of collect_statements(source)) {
        const environment = build_alias_environment(statement.text, tables)
        const hit = predicate({ statement, environment, source, relative_path })
        if (hit) return { file: relative_path, source, statement, hit }
      }
    }
    return null
  }

  const run = ({ name, direction, target, mutate, expectation }) => {
    if (!target) {
      controls.push({
        name,
        result: 'NO MATERIAL',
        detail:
          'no corpus statement of this shape -- the extraction may be blind'
      })
      return
    }
    const mutated_source = mutate(target)
    if (mutated_source === target.source) {
      controls.push({
        name,
        result: 'MUTATION DID NOT APPLY',
        detail: `${target.file} unchanged -- the control proved nothing`
      })
      return
    }
    const { findings } = run_scan(tables, {
      source_override: { file: target.file, source: mutated_source }
    })
    const reported = findings.some(
      (finding) => finding.file === target.file && expectation(finding)
    )
    const passed = direction === 'must-report' ? reported : !reported
    controls.push({
      name,
      result: passed
        ? 'WENT RED'
        : direction === 'must-report'
          ? 'STAYED GREEN'
          : 'FALSE POSITIVE',
      detail: `${target.file}:${target.statement.line}`,
      passed
    })
  }

  // 1. ALIAS-QUALIFIED resolution. A real join-bound alias reference, mutated to
  //    a column its table does not have, must be reported. This is defect site 2
  //    of `37cc9f36b`.
  const alias_target = pick(({ statement, environment }) => {
    if (environment.tables_in_scope.size < 2) return null
    QUALIFIED_REFERENCE_RE.lastIndex = 0
    let match
    while ((match = QUALIFIED_REFERENCE_RE.exec(statement.text)) !== null) {
      const [full, prefix, column] = match
      const table = environment.bindings.get(prefix)
      if (!table || table === prefix) continue
      if (is_not_a_column(column)) continue
      if (!tables.get(table).has(column)) continue
      return { full, prefix, column, table }
    }
    return null
  })
  run({
    name: 'alias-qualified reference resolves through a join binding',
    direction: 'must-report',
    target: alias_target,
    mutate: (target) =>
      target.source.replace(
        target.hit.full,
        `'${target.hit.prefix}.zzz_control_absent'`
      ),
    expectation: (finding) =>
      finding.column === 'zzz_control_absent' && finding.shape === 'qualified'
  })

  // 2. OBJECT-SHORTHAND resolution on a single-table statement. This is defect
  //    site 1 of `37cc9f36b`.
  const shorthand_target = pick(({ statement, environment }) => {
    if (environment.tables_in_scope.size !== 1) return null
    const [table] = environment.tables_in_scope
    const keys = collect_object_predicate_keys(statement.text)
    const key = keys.find((candidate) =>
      tables.get(table).has(candidate.column)
    )
    return key ? { key, table, statement_text: statement.text } : null
  })
  run({
    name: 'unqualified object key resolves against a single-table statement',
    direction: 'must-report',
    target: shorthand_target,
    mutate: (target) => {
      const original = target.hit.statement_text
      const replaced = original.replace(
        new RegExp(`([{,]\\s*)${target.hit.key.column}(\\s*[,}:])`),
        `$1zzz_control_absent$2`
      )
      return original === replaced
        ? target.source
        : target.source.replace(original, replaced)
    },
    expectation: (finding) =>
      finding.column === 'zzz_control_absent' && finding.shape === 'unqualified'
  })

  // 3. OVER-EAGER, direction one: an UNBOUND prefix must NOT be reported. If the
  //    gate resolved `unknown_alias.year` against some table it guessed at, it
  //    would invent a finding on every subquery in the tree.
  run({
    name: 'unbound prefix is NOT reported as a column finding',
    direction: 'must-stay-silent',
    target: alias_target,
    mutate: (target) =>
      target.source.replace(
        target.hit.full,
        `'zzz_unbound_prefix.zzz_control_absent'`
      ),
    expectation: (finding) => finding.column === 'zzz_control_absent'
  })

  // 4. OVER-EAGER, direction two: an unqualified key in a MULTI-table statement
  //    must NOT be resolved. Postgres itself cannot tell which table such a name
  //    belongs to; a gate that picked one would report against the wrong table
  //    and its reason would be unfalsifiable.
  const ambiguous_target = pick(({ statement, environment }) => {
    if (environment.tables_in_scope.size < 2) return null
    const keys = collect_object_predicate_keys(statement.text)
    return keys.length ? { key: keys[0], statement_text: statement.text } : null
  })
  run({
    name: 'unqualified key in a multi-table statement is NOT resolved',
    direction: 'must-stay-silent',
    target: ambiguous_target,
    mutate: (target) => {
      const original = target.hit.statement_text
      const replaced = original.replace(
        new RegExp(`([{,]\\s*)${target.hit.key.column}(\\s*[,}:])`),
        `$1zzz_control_absent$2`
      )
      return original === replaced
        ? target.source
        : target.source.replace(original, replaced)
    },
    expectation: (finding) => finding.column === 'zzz_control_absent'
  })

  // 5. BARE-STRING resolution on a single-table statement. This is the
  //    `placed_wagers.status` shape: a predicate naming a column and no table.
  const bare_target = pick(({ statement, environment }) => {
    if (environment.tables_in_scope.size !== 1) return null
    const [table] = environment.tables_in_scope
    const aliases = collect_output_aliases(statement.text)
    const reference = collect_bare_predicate_columns(statement.text).find(
      (candidate) =>
        !aliases.has(candidate.column) &&
        tables.get(table).has(candidate.column)
    )
    return reference
      ? { reference, table, statement_text: statement.text }
      : null
  })

  // Rewrite a bare literal IN PLACE by offset rather than by pattern. A pattern
  // would also rewrite the same word used as a bound VALUE elsewhere in the
  // statement, which mutates something the control is not aiming at.
  const rewrite_bare_literal = (target, replacement) => {
    const original = target.hit.statement_text
    const { offset, column } = target.hit.reference
    const literal = original.slice(offset, offset + column.length + 2)
    if (!literal.includes(column)) return target.source
    const replaced =
      original.slice(0, offset) +
      literal.replace(column, replacement) +
      original.slice(offset + literal.length)
    return original === replaced
      ? target.source
      : target.source.replace(original, replaced)
  }

  run({
    name: 'bare-string predicate resolves against a single-table statement',
    direction: 'must-report',
    target: bare_target,
    mutate: (target) => rewrite_bare_literal(target, 'zzz_control_absent'),
    expectation: (finding) =>
      finding.column === 'zzz_control_absent' && finding.shape === 'bare'
  })

  // 6. OVER-EAGER, direction three: a bare reference to an OUTPUT ALIAS the
  //    statement declares must NOT be reported. `.count('* as count')` then
  //    `.orderBy('count')` is correct SQL -- Postgres resolves the projection,
  //    not the table. Without this exclusion the corpus yields 8 such findings
  //    against 1 real one, so this control is what separates "the exclusion
  //    works" from "the bare collector is broken and finds nothing".
  const output_alias_target = pick(({ statement, environment }) => {
    if (environment.tables_in_scope.size !== 1) return null
    const [table] = environment.tables_in_scope
    const aliases = [...collect_output_aliases(statement.text)].filter(
      (alias) => !tables.get(table).has(alias)
    )
    if (!aliases.length) return null
    const reference = collect_bare_predicate_columns(statement.text).find(
      (candidate) => tables.get(table).has(candidate.column)
    )
    return reference
      ? { reference, alias: aliases[0], table, statement_text: statement.text }
      : null
  })
  run({
    name: 'bare reference to an output alias the statement declares is NOT reported',
    direction: 'must-stay-silent',
    target: output_alias_target,
    mutate: (target) => rewrite_bare_literal(target, target.hit.alias),
    expectation: (finding) => finding.column === output_alias_target.hit.alias
  })

  // 7. OVER-EAGER, direction four: a bare predicate in a MULTI-table statement
  //    must NOT be resolved, for the same reason its object-key sibling is not.
  const bare_ambiguous_target = pick(({ statement, environment }) => {
    if (environment.tables_in_scope.size < 2) return null
    const [reference] = collect_bare_predicate_columns(statement.text)
    return reference ? { reference, statement_text: statement.text } : null
  })
  run({
    name: 'bare predicate in a multi-table statement is NOT resolved',
    direction: 'must-stay-silent',
    target: bare_ambiguous_target,
    mutate: (target) => rewrite_bare_literal(target, 'zzz_control_absent'),
    expectation: (finding) => finding.column === 'zzz_control_absent'
  })

  // 8. THE ACCEPTANCE TEST, run as a control rather than asserted in prose.
  //    `scripts/validate-charting-import.mjs` called `.whereNotNull('sumer_id')`
  //    on `db('player')` where the column is `sumer_player_id` -- a live 42703,
  //    fixed in the same commit that added this gate's bare-string half. The
  //    pre-fix source is reconstructed by mutation rather than by shelling out
  //    to git, so the control works in a CI checkout of any depth.
  const acceptance_target = (() => {
    const file = 'scripts/validate-charting-import.mjs'
    const full_path = path.join(repo_root, file)
    if (!fs.existsSync(full_path)) return null
    const source = fs.readFileSync(full_path, 'utf8')
    const predicate = "whereNotNull('sumer_player_id')"
    if (!source.includes(predicate)) return null
    return { file, source, statement: { line: 0 }, hit: { predicate } }
  })()
  run({
    name: 'the sumer_id 42703 is reported at its pre-fix revision',
    direction: 'must-report',
    target: acceptance_target,
    mutate: (target) =>
      target.source.replace(target.hit.predicate, "whereNotNull('sumer_id')"),
    expectation: (finding) =>
      finding.table === 'player' &&
      finding.column === 'sumer_id' &&
      finding.shape === 'bare'
  })

  // 9. STALE ADJUDICATION. A suppression that no longer suppresses anything must
  //    fail the run rather than standing forever as an exemption for the name.
  //    Driven synthetically because it is a property of the adjudication pass,
  //    not of the scan.
  {
    const adjudications = [
      {
        file: 'zzz/control/absent.mjs',
        table: 'zzz_control',
        column: 'zzz_control_absent',
        verdict: 'control',
        reason: 'negative control'
      }
    ]
    const { stale } = apply_adjudications([], adjudications)
    const passed = stale.length === 1
    controls.push({
      name: 'an adjudication that suppresses nothing is reported as stale',
      result: passed ? 'WENT RED' : 'STAYED GREEN',
      detail: 'synthetic',
      passed
    })
  }

  // 10. ROOT COVERAGE, both directions on one input. Synthetic for the same reason
  //    control 5 is: the verdict is a property of the assertion, not of the scan,
  //    and darkening a real root would mean mutating the filesystem. Both
  //    directions matter because an assertion that reported every root as dark
  //    would fail the run for the wrong reason on every invocation, which reads as
  //    a broken corpus rather than a broken oracle.
  {
    const healthy = {}
    for (const [root, expectation] of Object.entries(ROOT_EXPECTATIONS))
      healthy[root] = {
        files: 1,
        statements: expectation.queries_the_database ? 1 : 0,
        resolved: 1
      }

    const [first_querying_root] = Object.entries(ROOT_EXPECTATIONS).find(
      ([, expectation]) => expectation.queries_the_database
    )
    const darkened = {
      ...healthy,
      [first_querying_root]: { files: 1, statements: 0, resolved: 0 }
    }
    const [isomorphic_root] = Object.entries(ROOT_EXPECTATIONS).find(
      ([, expectation]) => !expectation.queries_the_database
    )
    const leaked = {
      ...healthy,
      [isomorphic_root]: { files: 1, statements: 1, resolved: 1 }
    }

    const reports_a_dark_root = evaluate_root_coverage(darkened).length === 1
    const reports_a_knex_leak = evaluate_root_coverage(leaked).length === 1
    const stays_silent_on_healthy = evaluate_root_coverage(healthy).length === 0
    const passed =
      reports_a_dark_root && reports_a_knex_leak && stays_silent_on_healthy
    controls.push({
      name: 'a root contributing no statements is reported, and a healthy set is not',
      result: passed ? 'WENT RED' : 'STAYED GREEN',
      detail: `synthetic -- darkened ${first_querying_root}, leaked into ${isomorphic_root}`,
      passed
    })

    // 11. WHERE `unread` COMES FROM, driven on the live filesystem rather than
    //    on a hand-built argument. This is the control that would have caught
    //    the first version of this wiring, which derived `unread` from this
    //    run's own file COUNTS: a zero-count root lands in the counts-derived
    //    missing set by construction, so it was skipped before it could be
    //    tested and both file-count failures went dead with no output change.
    //
    //    The two resolutions must DISAGREE for a root that is on disk but read
    //    nothing, and the coverage verdict must follow the on-disk one. A
    //    control asserting only the exclusion would stay green over exactly
    //    that collapse.
    const zeroed = {
      ...healthy,
      [first_querying_root]: { files: 0, statements: 0, resolved: 0 }
    }
    const zero_count = new Map([[first_querying_root, 0]])
    const counts_view = resolve_corpus({
      roots: [first_querying_root],
      repo_root,
      counts: zero_count
    })
    // Read through the SAME function main uses, not resolve_corpus directly,
    // so a rewiring of the exclusion set fails this control.
    const exclusions = coverage_exclusions()

    // The root is on disk -- this gate is running out of it -- so the two
    // views must differ, and the coverage verdict must follow the disk.
    const views_disagree =
      counts_view.missing.includes(first_querying_root) &&
      !exclusions.includes(first_querying_root)
    const reports_a_present_root_that_read_nothing = evaluate_root_coverage(
      zeroed,
      exclusions
    ).some((failure) =>
      failure.startsWith(`${first_querying_root} contributed no files`)
    )
    const excludes_an_absent_root =
      evaluate_root_coverage(zeroed, [first_querying_root]).length === 0
    // Every root unread is the path-depth failure, not a narrowed verdict.
    const fails_when_nothing_is_readable = evaluate_root_coverage(
      healthy,
      Object.keys(ROOT_EXPECTATIONS)
    ).some((failure) => failure.startsWith('no declared root is readable'))

    const unread_passed =
      views_disagree &&
      reports_a_present_root_that_read_nothing &&
      excludes_an_absent_root &&
      fails_when_nothing_is_readable
    controls.push({
      name: 'unread is resolved from the FILESYSTEM: a present root that read nothing still fails, an absent one only narrows, and an all-unread corpus fails',
      result: unread_passed ? 'WENT RED' : 'STAYED GREEN',
      detail: `live -- ${first_querying_root} on disk, zero files read`,
      passed: unread_passed
    })
  }

  // 12-15. THE INDIRECT PAYLOAD PASS, as two report/decline PAIRS over the SAME
  //    corpus site. A pair is what makes each half mean something: the
  //    must-report halves show the pass can see a stale column in a payload built
  //    outside the statement, and the must-not-report halves show it declines the
  //    two shapes a naive version reports on real, correct code. Run singly,
  //    "reported" and "did not report" are each consistent with a scanner that is
  //    simply broken in one direction.
  const payload_target = pick(({ statement, environment, source }) => {
    if (environment.tables_in_scope.size !== 1) return null
    const [table] = environment.tables_in_scope
    for (const call of each_call(statement.text, PAYLOAD_METHODS)) {
      const identifier = call.body.match(/^\s*([a-z_][a-z_0-9]*)\s*$/i)
      if (!identifier) continue
      const payload = resolve_insert_payload({
        source,
        identifier: identifier[1],
        statement_offset: statement.offset
      })
      if (payload.status !== 'resolved') continue
      // A key whose spelling appears ONCE in the file, so rewriting it cannot
      // collide with an unrelated occurrence and mutate something else.
      const key = payload.keys.find(
        (candidate) =>
          tables.get(table).has(candidate.column) &&
          source.split(candidate.column).length === 2
      )
      if (key) return { table, identifier: identifier[1], key }
    }
    return null
  })

  const bogus = 'zzz_no_such_column'
  const rewrite_key = (target) =>
    target.source.slice(0, target.hit.key.offset) +
    bogus +
    target.source.slice(target.hit.key.offset + target.hit.key.column.length)
  const names_bogus = (finding) =>
    finding.column === bogus && finding.shape === 'indirect-payload'

  run({
    name: 'a stale column in a payload built OUTSIDE the statement is reported',
    direction: 'must-report',
    target: payload_target,
    mutate: rewrite_key,
    expectation: names_bogus
  })

  // The DECOY for the delete-before-write shape. Both seasonlog generators carry
  // a scratch key on the row object for an intermediate ranking pass and delete
  // it before the insert; a resolver that reads the literal alone reports every
  // one of them, on code that is correct. Same mutation as control 12 plus the
  // delete that makes it legitimate, and it must go the other way.
  run({
    name: 'a payload key DELETED before the write is not reported (decoy)',
    direction: 'must-not-report',
    target: payload_target,
    mutate: (target) =>
      `${rewrite_key(target)}\ndelete ${target.hit.identifier}.${bogus}\n`,
    expectation: names_bogus
  })

  // The DECOY for same-name accumulators in different scopes. This module reads
  // text and has no scope model, so a second binding of the payload name must
  // make the site UNRESOLVED rather than letting one function's literal be read
  // against another function's table -- the shape that reported five findings on
  // correct code in `scripts/process-projections.mjs` before it was guarded.
  run({
    name: 'a payload name bound a second time is declined, not guessed (decoy)',
    direction: 'must-not-report',
    target: payload_target,
    mutate: (target) =>
      `const { ${target.hit.identifier} } = build_something()\n${rewrite_key(target)}`,
    expectation: names_bogus
  })

  // A comment between two keys must not swallow the key after it. Prose contains
  // commas, the segment split is comma-driven, and the key pattern anchors at the
  // segment start -- so without blanking, a commented key is dropped SILENTLY and
  // the gate reports a confident green. That is the exact shape of the
  // `player_gamelogs.player_position` site this pass was built for, whose key
  // carries a three-line comment about that very column.
  run({
    name: 'a key preceded by a comment containing commas is still read',
    direction: 'must-report',
    target: payload_target,
    mutate: (target) => {
      const mutated = rewrite_key(target)
      const at = mutated.lastIndexOf('\n', target.hit.key.offset) + 1
      return `${mutated.slice(0, at)}// one, two, three: a comment, with commas\n${mutated.slice(at)}`
    },
    expectation: names_bogus
  })

  return controls
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const parse_argv = () => {
  const argv = process.argv.slice(2)
  return {
    json: argv.includes('--json'),
    unadjudicated: argv.includes('--unadjudicated')
  }
}

const main = () => {
  const options = parse_argv()

  if (!fs.existsSync(schema_path)) {
    console.error(`missing schema file: ${schema_path}`)
    process.exit(2)
  }
  const tables = parse_schema(fs.readFileSync(schema_path, 'utf8'))

  const { findings, stats } = run_scan(tables)
  const adjudications = load_adjudications()
  const { applied, stale } = apply_adjudications(findings, adjudications)
  const unadjudicated = applied.filter((finding) => !finding.adjudicated)
  const controls = run_negative_controls(tables)
  const failed_controls = controls.filter((control) => !control.passed)

  // TWO resolutions, because this gate asks two different questions of the
  // same roots and one answer cannot serve both.
  //
  // The REPORTED corpus is counts-driven: what this run actually read is
  // authoritative about what it could have gone red on, which is exactly what
  // the CORPUS block and the verdict suffix claim.
  //
  // The COVERAGE verdict needs the other question -- is the root on disk at
  // all -- so it resolves WITHOUT counts and lets readdirSync draw the line.
  // Feeding it the counts-derived set makes its input identical to its own
  // failure condition, which disables it silently; see evaluate_root_coverage.
  const files_by_root = new Map(
    SERVER_ROOTS.map((root) => [root, stats.by_root[root]?.files ?? 0])
  )
  const corpus = resolve_corpus({
    roots: SERVER_ROOTS,
    repo_root,
    counts: files_by_root
  })
  const coverage_failures = evaluate_root_coverage(
    stats.by_root,
    coverage_exclusions()
  )

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          stats,
          corpus,
          findings: applied,
          stale,
          controls,
          coverage_failures
        },
        null,
        2
      )
    )
  } else {
    console.log(`Parsed ${tables.size} tables from db/schema.postgres.sql\n`)

    console.log(format_corpus({ corpus, counts: files_by_root }))
    console.log('')

    console.log('COVERAGE -- what this run could and could not check')
    console.log(
      `  ${stats.files} files, ${stats.statements} knex statements, ` +
        `${stats.resolved} column references resolved`
    )
    console.log(
      `  NOT checked: ${stats.unchecked_ambiguous} unqualified key(s) in ` +
        `multi-table statements (genuinely ambiguous), ` +
        `${stats.unchecked_unbound_prefix} reference(s) on an unbound prefix, ` +
        `${stats.unchecked_shadowed} on a subquery/CTE alias, ` +
        `${stats.unchecked_no_binding} statement(s) binding no known table, ` +
        `${stats.unchecked_output_alias} bare reference(s) to an output alias the statement declares`
    )
    console.log(
      `  ${stats.statements_with_raw} statement(s) contain a .raw() body, which is not parsed`
    )
    console.log(
      `  indirect insert/update payloads: ${stats.payloads_resolved} resolved ` +
        `(${stats.payloads_partial} partial -- a spread or an opaque push leaves ` +
        `keys this cannot enumerate), ${stats.unchecked_payload} declined`
    )
    // Printed per root because that is what the coverage assertion reads. A total
    // cannot show a single root having gone dark.
    for (const [root, expectation] of Object.entries(ROOT_EXPECTATIONS))
      console.log(
        `  ${root}: ${stats.by_root[root].files} file(s), ` +
          `${stats.by_root[root].statements} statement(s), ` +
          `${stats.by_root[root].resolved} resolved` +
          (expectation.queries_the_database
            ? ''
            : '  (isomorphic -- must be 0)')
      )
    console.log('')

    console.log('NEGATIVE CONTROLS')
    for (const control of controls)
      console.log(
        `  [${control.passed ? 'ok' : 'FAIL'}] ${control.result}  ${control.name}  (${control.detail})`
      )
    console.log('')

    console.log('FINDINGS -- knex column references that do not resolve')
    const reported = options.unadjudicated ? unadjudicated : applied
    if (!reported.length) console.log('  none')
    for (const finding of reported) {
      console.log(
        `  [${finding.shape}] ${finding.table}.${finding.column}  ` +
          `${finding.file}:${finding.line}  -- ` +
          `${finding.adjudicated ? `ADJUDICATED ${finding.verdict}` : 'UNADJUDICATED'}`
      )
      console.log(`     ${finding.text}`)
      if (finding.adjudicated) console.log(`     reason: ${finding.reason}`)
    }

    if (stale.length) {
      console.log('\nSTALE ADJUDICATIONS -- these suppress nothing and must go')
      for (const entry of stale)
        console.log(`  ${entry.file}  ${entry.table}.${entry.column}`)
    }

    if (coverage_failures.length) {
      console.log('\nCOVERAGE FAILURE -- the scan is not reaching the corpus')
      for (const failure of coverage_failures) console.log(`  ${failure}`)
    }

    const total =
      unadjudicated.length +
      stale.length +
      failed_controls.length +
      coverage_failures.length
    console.log(
      total
        ? `\nGATE FAIL: ${unadjudicated.length} unadjudicated finding(s), ` +
            `${stale.length} stale adjudication(s), ` +
            `${failed_controls.length} failed control(s), ` +
            `${coverage_failures.length} coverage failure(s).`
        : `\nGATE OK.${verdict_suffix(corpus)}`
    )
  }

  process.exitCode =
    unadjudicated.length ||
    stale.length ||
    failed_controls.length ||
    coverage_failures.length
      ? 1
      : 0
}

main()
