// Documentation-vs-schema drift gate.
//
// WHY THIS EXISTS. Documentation is a schema consumer that no other gate reads.
// The mocha suite, the data-view goldens, `check-data-view-sql-validity`, the
// conformance ratchet and `check-api-response-shapes` all pass straight over
// prose, so a rename cluster that conforms a column and forgets its docs leaves
// drift that compounds cluster over cluster and is never flagged. On 2026-08-05
// that corpus was repaired by hand (league `494ba8e25`, user-base `2f2539742`)
// with throwaway scripts that were deleted. This makes the repair a ratchet.
//
// The corpus is not decoration. `guideline/nfl/`, `text/league/` and
// `workflow/nfl/` in user-base carry runnable SQL that agent sessions read as
// canonical instruction, and a 2026-07-29 sweep found ~20 stale files there
// tracing to at least four rename clusters, none of which had ever swept them.
//
//   GATE 1  qualified pairs -- every `table.column` token in the corpus whose
//           table is a real table must name a real column of that table. Static,
//           needs no database. Judged per (table, column), NEVER per column name:
//           `pff_player_seasonlogs.pff_id` survives while `player.pff_id` does
//           not, and a global rename would have damaged four of five such cases
//           in a 2026-07-30 sweep. It also reads every documented
//           `CREATE INDEX ... ON <table> (<columns>)`, which states the same
//           claim in the one form the pair regex cannot see -- the columns are
//           unqualified -- and which gate 2 cannot reach either, DDL being
//           un-EXPLAINable. That is the whole content of the index-naming
//           reference, which had no oracle at all until 2026-08-05.
//
//   GATE 2  executable SQL -- every fenced ```sql block is split into statements,
//           template placeholders are substituted, and each statement is
//           EXPLAINed against a throwaway database loaded from
//           `db/schema.postgres.sql`. This resolves UNQUALIFIED column references,
//           which gate 1 structurally cannot see. It is not redundant: on the
//           manual sweep it caught seven sites the regex missed, including
//           `FROM projections` (the table is `projections_history`) and a join on
//           a `prop_market_selections_index.esbid` that table has never had.
//
// ADJUDICATIONS, NOT A NAME DENYLIST. Dropped league column names include
// ordinary English words, so a bare-name filter is tempting and is exactly the
// mistake that hid a real defect: `check-renamed-column-consumers` carried a
// stoplist of common names (`total`, `year`, `value`, ...) that suppressed
// precisely the names renames concentrate on, and it returned 129 findings with
// not one of them `total` over a defect that wiped a year of projection values.
// So there is no name filter here. Genuine non-defects are adjudicated per SITE
// in `documentation-schema-drift-adjudications.json`, each with a reason, and an
// adjudication that no longer suppresses anything is itself a FINDING -- which is
// what keeps the file from silently becoming a denylist as the corpus moves.
//
// WHAT IS NOT A DEFECT: HISTORY. A migration doc, a task record or an
// observation describing what a rename DID is accurate, and only live
// instruction counts. That distinction is not derivable from the text, so it is
// adjudicated per site with `"kind": "history"` rather than guessed at from a
// path convention -- a path rule would have to assume a doc is wholly historical
// or wholly live, and the corpus's migration docs are neither.
//
// PROSE IS THE CORPUS, SO NOTHING IS STRIPPED. `check-saved-view-param-coverage`
// tokenized comments and so read prose ABOUT a legacy key as a consumer OF it,
// which made four keys permanently unreportable -- the incident note blinded the
// gate to its own incident. That failure was a gate treating prose as coverage.
// Here prose IS the thing under test, so a `table.column` in a sentence is a
// claim about the schema and is checked like any other.
//
// COVERAGE IS REPORTED, NOT IMPLIED. The run always prints how many files were
// read, how many pairs were checked, how many SQL statements EXPLAINed, and --
// the number that matters -- how many statements it could NOT check and why. A
// gate over part of a corpus that reads as full coverage is worse than no gate.
//
// NEGATIVE CONTROL, RUN EVERY TIME. Never accept a green you have not shown can
// go red, so the control is not behind a flag anyone could forget. Each run
// mutates its own oracles in every way this gate is supposed to catch and
// asserts each is reported; a control that stays green FAILS the run. The
// controls need real corpus material to mutate, so they are also what detects
// the extraction going blind -- there is deliberately no minimum-sites constant,
// because that case is already covered by a mechanism that has to work anyway.
//
// Several run in BOTH directions on one input, because half of what this gate
// does is decide that something is NOT a claim about the schema, and an
// over-eager filter fails silently in the direction that looks like success.
// The control that earns its keep most is the one that caught the gate-2
// mutation rewriting a `-- cross-join optimization` COMMENT rather than the
// query: the statement came back semantically identical, EXPLAIN succeeded, and
// the control reported STAYED GREEN over a gate that was working -- failing OPEN,
// which is the one direction a control must never fail.
//
// Usage:
//
//   yarn test:db:up                            # gate 2 only
//   node db/gates/check-documentation-schema-drift.mjs \
//     --root ../../../guideline/nfl --root ../../../text/league \
//     --root ../../../workflow/nfl
//
//   node db/gates/check-documentation-schema-drift.mjs --gate 1   # no database
//
// League roots (`docs/`, `api/swagger/`, `server/crontab-*`) are checked by
// default. The user-base trees live outside this checkout, so they are passed as
// `--root` rather than hardcoded -- this gate is about the league SCHEMA, and the
// corpus is a parameter of the run.
//
// Exit 0 = no findings; 1 = at least one finding or a control that stayed green;
// 2 = tooling error (container down, schema load failed).
//
// Uses console.log deliberately, never `debug` -- the ESM import graph clobbers
// the namespace set before a module-scope `debug.enable` runs, and an oracle
// whose verdict depends on winning that negotiation has no audit trail.

import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import Knex from 'knex'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

// Defaults itself onto the bundled PG16 test container rather than inheriting an
// ambient NODE_ENV that might point at production. This gate only ever reads a
// throwaway database it created itself.
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.LEAGUE_DB_HOST = process.env.LEAGUE_DB_HOST || '127.0.0.1'
process.env.LEAGUE_DB_PORT = process.env.LEAGUE_DB_PORT || '5433'

// `CLAUDE.md` is in the corpus because it is the densest schema-claiming prose in
// the repo and is read as instruction by every session. It is also the file with
// the highest history-to-defect ratio — a 2026-08-05 audit found 21 absent
// (table, column) pairs in it of which only 8 were defects — which is why the
// adjudication surface had to exist before it could be included.
const DEFAULT_ROOTS = [
  'CLAUDE.md',
  'docs',
  'api/swagger',
  'server/crontab-main',
  'server/crontab-worker-1'
]

// `.sh` is here for GATE 3. A shell script holding SQL in a bash variable is an
// EXECUTABLE schema consumer, not documentation -- see the gate 3 header for why
// it nonetheless belongs in this gate's corpus rather than in one of its own.
const SCANNED_EXTENSIONS = new Set(['.md', '.mjs', '.cron', '.sql', '.sh'])

const adjudications_file = path.join(
  repo_root,
  'db/gates/documentation-schema-drift-adjudications.json'
)

// ---------------------------------------------------------------------------
// schema.postgres.sql
// ---------------------------------------------------------------------------

// Parses CREATE TABLE bodies out of the exported schema. Views are collected by
// NAME only: a view's output columns come from its SELECT list, which a name-only
// parse of the dump cannot state, so gate 1 must not judge `view_x.column` at all
// -- it would report every column of every view as absent. Gate 2 handles views
// correctly for free, because the real database knows them.
const parse_schema = (sql) => {
  const tables = new Map()
  const table_re =
    /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\n\);/gi
  let match
  while ((match = table_re.exec(sql))) {
    const columns = new Set()
    for (const raw_line of match[2].split('\n')) {
      const line = raw_line.trim()
      const column_match = /^"?([a-z0-9_]+)"?\s+[a-z]/i.exec(line)
      if (!column_match) continue
      if (
        /^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE|LIKE|PARTITION)$/i.test(
          column_match[1]
        )
      ) {
        continue
      }
      columns.add(column_match[1])
    }
    tables.set(match[1], columns)
  }

  const views = new Set()
  const view_re = /CREATE (?:OR REPLACE )?VIEW (?:public\.)?"?([a-z0-9_]+)"?/gi
  while ((match = view_re.exec(sql))) views.add(match[1])

  return { tables, views }
}

// ---------------------------------------------------------------------------
// corpus
// ---------------------------------------------------------------------------

const walk_files = (dir, acc = []) => {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      walk_files(full, acc)
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(full)
    }
  }
  return acc
}

// A root may restrict which extensions it contributes. `--executable-root` uses
// this to bring in shell scripts WITHOUT bringing in their sibling `.mjs` files,
// and the reason is measured rather than stylistic: gate 1's `table.column`
// derivation is built for PROSE, where a dotted pair is a schema claim. In
// JavaScript it is ordinary property access, and the object name collides with a
// table name often enough to drown the gate -- adding `cli/` unrestricted
// produced 64 findings, 52 of them `.mjs` property reads like `config.degraded`
// off a local variable, against 10 genuine stale pairs in shell comments. The
// league repo already solves the JavaScript case a different way, in
// `check-renamed-column-consumers` gate 1, which reads only QUOTED literals for
// exactly this reason. Widening that derivation to user-base `.mjs` is real work
// with its own adjudication pass; it is not this gate's corpus.
const collect_corpus = (roots) => {
  const files = []
  const missing = []
  for (const entry of roots) {
    const { path: root, extensions } =
      typeof entry === 'string' ? { path: entry, extensions: null } : entry
    const absolute = path.isAbsolute(root) ? root : path.join(repo_root, root)
    if (!fs.existsSync(absolute)) {
      missing.push(root)
      continue
    }
    const permitted = (file) =>
      !extensions || extensions.has(path.extname(file))
    // A root may name a single file (`CLAUDE.md`) as well as a directory.
    if (fs.statSync(absolute).isFile()) {
      if (permitted(absolute))
        files.push({
          file: absolute,
          root,
          absolute_root: path.dirname(absolute)
        })
      continue
    }
    for (const file of walk_files(absolute)) {
      if (permitted(file)) files.push({ file, root, absolute_root: absolute })
    }
  }
  return { files, missing }
}

// A corpus path is reported relative to the root it was collected under, so a
// finding in user-base reads as `workflow/nfl/betting/x.md` rather than as a
// twelve-segment absolute path nobody can scan.
const display_path = (entry) =>
  path.join(
    path.basename(entry.absolute_root),
    path.relative(entry.absolute_root, entry.file)
  )

// ---------------------------------------------------------------------------
// gate 1: qualified table.column pairs
// ---------------------------------------------------------------------------

// Suffixes that make `a.b` a filename rather than a qualified column reference.
// This is a structural filter on the SHAPE of the token, not a filter on column
// NAMES -- `config.mjs` and `leagues.format` parse identically to a real pair and
// neither says anything about the schema. It cannot suppress a real finding,
// because no league column is named after a file extension.
const FILE_EXTENSIONS = new Set([
  'mjs',
  'js',
  'cjs',
  'jsx',
  'ts',
  'json',
  'md',
  'sql',
  'sh',
  'yml',
  'yaml',
  'css',
  'styl',
  'py',
  'txt',
  'csv',
  'tsv',
  'gz',
  'log',
  'cron',
  'env',
  'lock',
  'html',
  'htm',
  'xml',
  'png',
  'svg'
])

// Requires both sides adjacent to the dot with no whitespace, which is what
// separates a qualified reference from a sentence boundary (`sources. drive_yds`
// in the manual sweep).
const PAIR_RE = /\b([a-z][a-z0-9_]{2,})\.([a-z][a-z0-9_]*)\b/g

// Structural rejections, applied to the SHAPE of the surrounding text and never
// to the column NAME. Each one is a form in which `a.b` provably is not a
// qualified column reference, so none of them can suppress a real finding:
//
//   `player_gamelogs.snaps_*`   a documented glob — a column name cannot end `*`
//   `playoffs.filter((m) =>`    a JS method call — a column is never called
//   `config/config.sample.json` a path — the surrounding token names a file
//   `test/leagues.format-id-cascade.spec.mjs`  likewise
//
// The path rule reads the whole surrounding token rather than just the two
// segments, because `config.production.js` matches `config.production` and stops
// before ever reaching the extension that gives it away.
const is_structurally_not_a_reference = (line, match) => {
  const after = line[match.index + match[0].length]
  if (after === '*' || after === '(') return true

  const before = line.slice(0, match.index)
  const start =
    before.length - (/[^\s`'"|(),]*$/.exec(before) || [''])[0].length
  const rest = /^[^\s`'"|(),]*/.exec(line.slice(match.index))[0]
  const token = line.slice(start, match.index) + rest

  if (token.includes('/')) return true
  // A `file.ext:line` citation is a source location, not a reference. The line
  // suffix has to come off before the extension test, or `teams.mjs:333` reads as
  // the table `teams` with a column `mjs` — which is how five sites in one design
  // doc were reported on the first run.
  // Everything after the extension comes off: a `:line` citation suffix
  // (`teams.mjs:333`) and trailing markdown emphasis (`**config.production.js**`)
  // both leave the extension attached to punctuation, and both were reported as
  // findings on the first run of this gate.
  // The last NON-EMPTY segment. A filename ending a sentence (`lives in
  // config.json.`) keeps the trailing period inside the token, so a bare `pop()`
  // returns the empty string, the extension test fails, and the filename is
  // reported as a schema claim. That is how `config.json` and `draft.htm` were
  // reported the first time `.sh` files entered the corpus.
  const segments = token
    .split('.')
    .map((segment) => segment.toLowerCase().replace(/[^a-z0-9].*$/, ''))
    .filter(Boolean)
  return FILE_EXTENSIONS.has(segments[segments.length - 1])
}

// `CREATE INDEX ... ON <table> (<columns>)` is a documented claim about a real
// table's real columns that NEITHER derivation could see: the columns are
// unqualified, so the pair regex has no table to bind them to, and DDL is not
// EXPLAINable, so gate 2 files the whole block as uncovered. That left the
// index-naming reference — six blocks whose entire content is such claims — with
// no oracle at all. It is checked here rather than by executing the DDL against
// the throwaway database: the statement is trivially parseable, execution would
// buy nothing beyond it, and running corpus-authored DDL would turn a gate that
// only ever reads into one that runs whatever a document happens to say.
//
// Anything that is not a bare identifier is SKIPPED rather than guessed at — an
// expression index (`lower(name)`), an opclass, or a sort modifier makes the
// column list unparseable, and the safe direction there is no claim.
const CREATE_INDEX_RE =
  /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?[a-z0-9_"]+\s+ON\s+(?:ONLY\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*(?:USING\s+[a-z]+\s*)?\(([^()]*)\)(?:\s*INCLUDE\s*\(([^()]*)\))?/gi

const extract_indexed_column_sites = (source) => {
  const sites = []
  CREATE_INDEX_RE.lastIndex = 0
  let match
  while ((match = CREATE_INDEX_RE.exec(source))) {
    const line = source.slice(0, match.index).split('\n').length
    const listed = `${match[2] || ''},${match[3] || ''}`.split(',')
    for (const raw_column of listed) {
      const column = raw_column.trim().replace(/^"|"$/g, '')
      if (!/^[a-z_][a-z0-9_]*$/.test(column)) continue
      sites.push({
        table: match[1],
        column,
        line,
        context: match[0].replace(/\s+/g, ' ').slice(0, 160)
      })
    }
  }
  return sites
}

const run_gate_1 = ({
  corpus,
  tables,
  views,
  adjudications,
  read_file = (file) => fs.readFileSync(file, 'utf8')
}) => {
  const findings = []
  let pairs_checked = 0
  let pairs_skipped_unknown_table = 0
  let pairs_skipped_view = 0
  let indexed_columns_checked = 0
  let indexed_columns_skipped_unknown_table = 0
  const files_with_pairs = new Set()

  for (const entry of corpus) {
    const source = read_file(entry.file)
    const lines = source.split('\n')
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      PAIR_RE.lastIndex = 0
      let match
      while ((match = PAIR_RE.exec(line))) {
        const [, table, column] = match
        if (is_structurally_not_a_reference(line, match)) continue
        if (views.has(table)) {
          pairs_skipped_view++
          continue
        }
        const columns = tables.get(table)
        if (!columns) {
          pairs_skipped_unknown_table++
          continue
        }
        pairs_checked++
        files_with_pairs.add(entry.file)
        if (columns.has(column)) continue

        const site = {
          gate: 1,
          kind: 'documented_column_absent',
          path: display_path(entry),
          line: index + 1,
          table,
          column,
          detail: `'${table}.${column}' is documented, but '${table}' has no such column`,
          context: line.trim().slice(0, 160)
        }
        const adjudication = match_adjudication(adjudications, site)
        if (adjudication) {
          adjudication.used++
          continue
        }
        findings.push(site)
      }
    }

    for (const indexed of extract_indexed_column_sites(source)) {
      const columns = tables.get(indexed.table)
      if (!columns) {
        indexed_columns_skipped_unknown_table++
        continue
      }
      indexed_columns_checked++
      if (columns.has(indexed.column)) continue

      const site = {
        gate: 1,
        kind: 'documented_column_absent',
        path: display_path(entry),
        line: indexed.line,
        table: indexed.table,
        column: indexed.column,
        detail: `a documented index puts '${indexed.table}' on column '${indexed.column}', which that table does not have`,
        context: indexed.context
      }
      const adjudication = match_adjudication(adjudications, site)
      if (adjudication) {
        adjudication.used++
        continue
      }
      findings.push(site)
    }
  }

  return {
    findings,
    coverage: {
      pairs_checked,
      pairs_skipped_unknown_table,
      pairs_skipped_view,
      indexed_columns_checked,
      indexed_columns_skipped_unknown_table,
      files_with_pairs: files_with_pairs.size
    }
  }
}

// ---------------------------------------------------------------------------
// gate 2: fenced SQL
// ---------------------------------------------------------------------------

// A fence OPENER has to sit at the start of its line, which is what markdown
// requires and what separates a real block from a sentence that merely names one.
// Unanchored, the prose in `CLAUDE.md` describing this gate ("splits every fenced
// ```sql block") opened a PHANTOM fence that ran to the next inline mention
// several paragraphs away, swallowing the intervening prose and reporting it as
// one or more unrunnable blocks — a gate inventing its own uncovered entries out
// of documentation about itself, and the count moved whenever that prose was
// edited. Indentation is allowed because a fence inside a numbered list is
// legitimately indented, and one of the corpus's real blocks is.
const SQL_FENCE_RE = /^[ \t]*```sql\b[^\n]*\n([\s\S]*?)```/gm
const OTHER_FENCE_RE = /^[ \t]*```(?!sql\b)([a-z]*)\b[^\n]*\n([\s\S]*?)```/gm

// A non-`sql` fence is worth retagging only if it holds a SQL STATEMENT, and
// `SELECT` ... `FROM` appearing ANYWHERE in the block does not establish that.
// The loose form read `.select(` beside the English word "from" as SQL and so
// reported all five of this corpus's ```javascript fences — every one of them
// ordinary JavaScript. Acting on that suggestion would have mislabelled five
// docs and moved five blocks from one uncovered bucket to another, since
// EXPLAIN cannot parse JavaScript either. The test is therefore ANCHORED to
// line starts: a leading statement keyword AND a clause keyword introducing its
// own line. `with:` and `select:` are excluded because an object key is the one
// shape that opens a JavaScript line with a SQL keyword, and it is what both
// surviving false positives were.
const SQL_STATEMENT_OPENER_RE =
  /^[ \t]*(SELECT|WITH|INSERT|UPDATE|DELETE)\b(?!\s*:)/im
const SQL_CLAUSE_LINE_RE =
  /^[ \t]*(FROM|WHERE|GROUP BY|ORDER BY|INNER JOIN|LEFT JOIN|JOIN|UNION)\b/im

const looks_like_a_sql_statement = (block) =>
  SQL_STATEMENT_OPENER_RE.test(block) && SQL_CLAUSE_LINE_RE.test(block)

// Placeholders are substituted with NULL rather than with plausible values on
// purpose. NULL is untyped, so it satisfies a comparison against a column of any
// type -- substituting `2025` for a `{{ year }}` that turns out to sit beside a
// text column would raise a type error this gate would then report as a defect in
// the documentation, which it is not. The cost is that a placeholder in an
// IDENTIFIER position produces a syntax error; those are classified as uncovered
// below rather than reported, which is the safe direction.
const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]*\}\}/g, // {{ year }}
  /\$\{[^}]*\}/g, // ${year}
  // Angle and brace markers are matched in EITHER case. Restricting them to
  // SCREAMING_CASE was an assumption about house style that the corpus does not
  // keep: `{YEAR}` and `{POST_WEEK_NUMBER}` in the weekly-gameplan workflow and
  // `<pid_column>` in CLAUDE.md were left unsubstituted and reported as syntax
  // errors, which is the uncovered bucket that can hide a real defect. Neither
  // widening can swallow valid SQL — `<>` is excluded by requiring a leading
  // letter, and a brace pair is not SQL syntax outside a quoted array literal.
  /<[a-zA-Z_][a-zA-Z0-9_]*>/g, // <YEAR>, <pid_column>
  /\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, // {year}, {YEAR}
  // A braced English PHRASE, which the betting workflows use where the fill-in
  // is a list rather than a name (`IN ({list of defense teams with alignments})`).
  // The required interior space is what separates it from an array literal.
  /\{[a-zA-Z][^{}'"\n]*[ \t][^{}'"\n]*\}/g,
  // A documentation ELLIPSIS standing in for elided values or predicates
  // (`ARRAY['Player1', 'Player2', ...]`, `WHERE ...`). Three dots are never
  // valid SQL, so this cannot suppress anything real.
  /(?<![.\w])\.\.\.(?![.\w])/g,
  /(?<![:\w]):[a-z_][a-z0-9_]*/g, // :name  (not ::cast)
  /\$\d+/g, // $1
  // A quoted SCREAMING_CASE literal, which the betting workflows use as a fill-in
  // marker (`ps.esbid = 'GAME_ESBID'`). The underscore is required on purpose:
  // without it this would swallow `'REG'`, `'POST'` and `'ACT'`, which are real
  // season-type and roster-status values and not placeholders at all.
  /'[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+'/g
]

// A placeholder wedged INTO an identifier names a table or column that only
// exists once the template is rendered — `nfl_plays_year_{{ year }}` is the
// per-season partition, and substituting anything at all produces a relation that
// genuinely does not exist. Such a statement is not checkable and is reported as
// uncovered; reporting it as a finding would be the gate blaming the corpus for
// its own substitution, which is exactly the kind of false positive that trains a
// reader to ignore a gate.
//
// Three shapes qualify, and all three are structural — none reads the
// placeholder's NAME:
//
//   nfl_plays_year_{{ year }}   glued to an identifier on either side
//   count(p.<pid_column>)       the column half of a qualified reference
//   WITH ${table_name} AS       the operand of a relation-introducing keyword
//
// The last two were reported as syntax errors until 2026-08-05. That is the
// same uncovered TOTAL either way, but the reason a reader is given decides
// whether they go looking: "syntax error" invites a search for malformed SQL
// that is not there, while this reason states the statement is unrunnable by
// construction and closes the question.
const IDENTIFIER_POSITION_PREFIX_RE =
  /(?:[a-z0-9_]|\.|\b(?:FROM|JOIN|INTO|UPDATE|TABLE|WITH)[ \t]+)$/i

const has_identifier_placeholder = (sql) =>
  PLACEHOLDER_PATTERNS.some((pattern) => {
    const scan = new RegExp(pattern.source, 'gi')
    let match
    while ((match = scan.exec(sql))) {
      const after = sql[match.index + match[0].length]
      if (after && /[a-z0-9_]/i.test(after)) return true
      if (IDENTIFIER_POSITION_PREFIX_RE.test(sql.slice(0, match.index)))
        return true
    }
    return false
  })

const substitute_placeholders = (sql) => {
  let out = sql
  let substitutions = 0
  for (const pattern of PLACEHOLDER_PATTERNS) {
    out = out.replace(pattern, () => {
      substitutions++
      return 'NULL'
    })
  }
  // A bare `?` bind marker. Restricted to a position where a value belongs so a
  // question mark in prose inside a SQL comment does not get rewritten.
  out = out.replace(/(?<=[\s(,=])\?(?=[\s),]|$)/gm, () => {
    substitutions++
    return 'NULL'
  })
  return { sql: out, substitutions }
}

// Splits a fenced block into statements on top-level semicolons, respecting
// single-quoted strings and line comments. Dollar-quoted bodies are not split at
// all -- a PL/pgSQL body cannot be EXPLAINed and is reported as uncovered.
const split_statements = (block) => {
  if (block.includes('$$')) return null
  const statements = []
  let current = ''
  let in_string = false
  let in_line_comment = false
  for (let index = 0; index < block.length; index++) {
    const character = block[index]
    const next = block[index + 1]
    if (in_line_comment) {
      current += character
      if (character === '\n') in_line_comment = false
      continue
    }
    if (in_string) {
      current += character
      if (character === "'" && next !== "'") in_string = false
      continue
    }
    if (character === '-' && next === '-') {
      in_line_comment = true
      current += character
      continue
    }
    if (character === "'") {
      in_string = true
      current += character
      continue
    }
    if (character === ';') {
      statements.push(current)
      current = ''
      continue
    }
    current += character
  }
  statements.push(current)
  return statements
    .map((statement) => statement.trim())
    .filter((statement) => statement.replace(/--[^\n]*/g, '').trim().length)
}

// A documented query routinely opens with a `-- what this does` line, so the
// leading comments have to come off before asking whether the statement is
// EXPLAINable. Testing the raw text instead classified 72 statements as
// "not an EXPLAINable statement" on the first run of this gate — a blind spot
// twice the size of the corpus it was actually checking, and one that reads as
// coverage in a summary line.
const strip_leading_comments = (statement) =>
  statement.replace(/^(?:\s*--[^\n]*\n)+/, '').trimStart()

const EXPLAINABLE_RE = /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|VALUES|TABLE)\b/i

// A doc showing CTE STRUCTURE routinely stops at the last closing paren, with no
// top-level body — `WITH a AS (...), b AS (...)` and nothing after it. Postgres
// calls that `syntax error at end of input`, so a perfectly checkable CTE body
// landed in the same bucket as a genuinely malformed query. Supplying the SELECT
// the doc elided is the gate completing its own input rather than judging the
// corpus on it, and it cannot manufacture a finding by itself: the appended
// relation is the last CTE, which exists by construction, so every error still
// comes from a reference the doc actually wrote.
//
// It CAN promote a fragment that was previously unreported into a reported one,
// which is correct and is what the adjudication surface is for — a block
// continuing a CTE chain begun in an earlier block names a relation that is real
// in the doc's narrative and absent from any schema.
const complete_dangling_with = (sql) => {
  if (!/^\s*WITH\b/i.test(sql)) return null

  const cte_names = []
  let depth = 0
  let in_string = false
  let in_line_comment = false
  let body_start = -1
  // Only the CTE LIST can end; once it has, a later paren returning to depth 0
  // is part of the body and must not move `body_start`. Without this the scan
  // reset `body_start` on EVERY depth-0 close, so a query whose body happens to
  // end on `)` -- `WITH ... SELECT (SELECT COUNT(*) ...), (SELECT COUNT(*) ...)`
  // -- looked like a bare CTE list with an empty tail and had
  // `SELECT * FROM <last_cte>` appended to a statement that already had a body.
  // The result was a syntax error, which lands in the UNCOVERED bucket, so the
  // statement was silently never checked against the schema and the run still
  // read green. Found 2026-08-07 on the user-base lineage-consistency query,
  // which is exactly the shape; it applies to fenced blocks identically.
  let in_cte_list = true

  for (let index = 0; index < sql.length; index++) {
    const character = sql[index]
    if (in_line_comment) {
      if (character === '\n') in_line_comment = false
      continue
    }
    if (in_string) {
      if (character === "'" && sql[index + 1] !== "'") in_string = false
      continue
    }
    if (character === '-' && sql[index + 1] === '-') {
      in_line_comment = true
      continue
    }
    if (character === "'") {
      in_string = true
      continue
    }
    if (character === '(') {
      depth++
      continue
    }
    if (character === ')') {
      depth--
      // A comma after the close means another CTE follows; anything else ends
      // the list and starts the body.
      if (depth === 0 && in_cte_list) {
        const rest = sql.slice(index + 1).replace(/^(?:\s|--[^\n]*\n)*/, '')
        if (!rest.startsWith(',')) {
          in_cte_list = false
          body_start = index + 1
        }
      }
      continue
    }
    if (depth !== 0) continue
    if (!in_cte_list) continue
    const opener =
      /^([a-z_][a-z0-9_]*)[ \t\n]+AS[ \t\n]*(?:(?:NOT[ \t\n]+)?MATERIALIZED[ \t\n]*)?\(/i.exec(
        sql.slice(index)
      )
    if (!opener) continue
    cte_names.push(opener[1])
    index += opener[0].length - 1
    depth++
  }

  if (depth !== 0 || !cte_names.length || body_start < 0) return null
  const tail = sql
    .slice(body_start)
    .replace(/--[^\n]*/g, '')
    .trim()
  if (tail.length) return null
  return `${sql}\nSELECT * FROM ${cte_names[cte_names.length - 1]}`
}

// EXPLAIN error classes. A statement this gate could not put into EXPLAINable
// shape raises a SYNTAX error (42601), which says nothing about the schema and is
// counted as uncovered. Everything else is a real disagreement between the
// documented SQL and the schema -- 42703 undefined_column and 42P01
// undefined_table are the rename shapes, and 42803 grouping_error is what caught
// the reference query in `text/league/data-model-reference.md` that had a GROUP BY
// with no aggregates.
const UNCOVERED_ERROR_CODES = new Set(['42601'])

const collect_sql_blocks = (
  corpus,
  read_file = (file) => fs.readFileSync(file, 'utf8')
) => {
  const statements = []
  const uncovered = []
  let sql_fences = 0
  let sql_like_non_sql_fences = 0

  for (const entry of corpus) {
    const source = read_file(entry.file)
    const relative = display_path(entry)

    // Line number of a fence, so a finding points at the block rather than the
    // file. Counted by slicing the source at the match index, which is exact.
    SQL_FENCE_RE.lastIndex = 0
    let match
    while ((match = SQL_FENCE_RE.exec(source))) {
      sql_fences++
      const line = source.slice(0, match.index).split('\n').length
      const split = split_statements(match[1])
      if (!split) {
        uncovered.push({
          path: relative,
          line,
          reason: 'dollar-quoted body; cannot be EXPLAINed'
        })
        continue
      }
      for (const original of split) {
        const raw = strip_leading_comments(original)
        if (!EXPLAINABLE_RE.test(raw)) {
          uncovered.push({
            path: relative,
            line,
            reason: `not an EXPLAINable statement (${raw.trim().split(/\s+/)[0] || 'empty'})`
          })
          continue
        }
        if (has_identifier_placeholder(raw)) {
          uncovered.push({
            path: relative,
            line,
            reason:
              'template placeholder sits inside an identifier (a rendered table name); ' +
              'no substitution can make this EXPLAINable'
          })
          continue
        }
        // `raw` stays the doc's own text — it is what a finding quotes and what
        // a gate-2 adjudication keys on, so the completion must not leak into it.
        const { sql, substitutions } = substitute_placeholders(
          complete_dangling_with(raw) || raw
        )
        statements.push({ path: relative, line, sql, raw, substitutions })
      }
    }

    OTHER_FENCE_RE.lastIndex = 0
    while ((match = OTHER_FENCE_RE.exec(source))) {
      if (!looks_like_a_sql_statement(match[2])) continue
      sql_like_non_sql_fences++
      uncovered.push({
        path: relative,
        line: source.slice(0, match.index).split('\n').length,
        reason: `SQL inside a \`\`\`${match[1] || 'plain'} fence; retag it \`\`\`sql to bring it under gate 2`
      })
    }
  }

  return { statements, uncovered, sql_fences, sql_like_non_sql_fences }
}

// ---------------------------------------------------------------------------
// gate 3: executable SQL embedded in shell scripts
// ---------------------------------------------------------------------------

// WHY THIS IS IN THIS GATE AND NOT ITS OWN.
//
// `87066b585` fixed `cli/monitoring/check-league-lineage-consistency.sh` in
// user-base, which had been exiting 1 nightly since the season_grain conform: it
// queried `year` on `transactions` and `rosters_players` from a bash variable
// shipped over ssh to psql. NO gate's corpus contained it. This gate already
// reaches outside the checkout -- it is the only one that does, and its roots are
// arguments precisely because the corpus is a parameter of the run -- but its two
// derivations could not see this file. Gate 1 reads QUALIFIED `table.column`
// tokens and the script writes unqualified references and two-letter aliases
// (`rp.year`, where `rp` is bound in the FROM clause). Gate 2 reads fenced
// ```sql blocks and a bash variable is not a fence.
//
// The oracle that DOES work is the one gate 2 already owns: EXPLAIN. It resolves
// `rp.year` through the statement's own FROM clause and it resolves unqualified
// references, both for free, which is exactly what neither regex derivation can
// do. So gate 3 is a third EXTRACTION feeding the SAME oracle, adjudication file,
// scratch database and coverage discipline -- not a second gate provisioning its
// own database to answer the same question.
//
// The name `check-documentation-schema-drift` is now narrower than the corpus,
// which is a real and deliberate mismatch: the file's durable identity is "schema
// consumers that live outside this checkout", and renaming it mid-program would
// churn the manifest, the adjudication path, CLAUDE.md and README for a sibling
// session's muscle memory. Recorded here rather than silently lived with.
//
// THE CORPUS IS NOT CONTENT-GATED, and that is the design decision worth stating.
// The obvious scoping -- "files under cli/ that mention a league table" -- makes
// the DENOMINATOR move with the content, so a file silently leaves the corpus at
// the exact moment its table reference is renamed away, which is the failure mode
// this gate exists to catch. Instead the corpus is every `.sh` under the supplied
// roots, mechanically; files carrying no SQL contribute nothing and are counted.
// The coverage block prints the denominator so a derivation going blind shows up
// as a number falling rather than as a green.
//
// TWO BLIND SPOTS, both currently benign and both worth knowing before trusting a
// green. A shell script may target a DIFFERENT database -- `check-nano-*` query
// the nano-community archive, not league -- and this gate would judge their SQL
// against the league schema if it could parse it. Today it cannot: both assemble
// their projection at runtime (`SELECT $(IFS=,; echo "${select_parts[*]}")`), so
// they land in the UNCOVERED bucket rather than producing a false finding. The
// safe direction, but it is luck rather than design, and a hand-written query
// against a non-league database WOULD be reported. Second, a rendered identifier
// (`FROM {{ table }}`) is unEXPLAINable by construction and is counted uncovered,
// same as in gate 2.

// A bash variable assignment whose body opens on a SQL statement keyword. The
// body runs to the matching close quote, which is what makes it multi-line --
// `read_query='WITH live_week AS (` ... `)'` is 20 lines in the fixed instance.
// Single quotes are literal in bash; double quotes interpolate, handled below.
const SHELL_ASSIGNMENT_RE =
  /^[ \t]*(?:local[ \t]+|export[ \t]+|declare[ \t]+-[A-Za-z]+[ \t]+)?([A-Za-z_][A-Za-z_0-9]*)=(['"])([\s\S]*?)\2/gm

// `psql ... -c "SELECT ..."`. The quote style is captured so the body ends at the
// matching close rather than at the first quote of either kind.
const SHELL_PSQL_INLINE_RE = /-c[ \t]+(['"])([\s\S]*?)\1/g

// A heredoc body, `<<TAG` / `<<'TAG'` / `<<-TAG`, ending at a line holding only
// the tag. There are none carrying SQL in the corpus today (15 `<<EOF`, 8
// `<<'EOF'`, plus JS/PY/USAGE bodies) -- which is why the coverage block prints
// the count found, so the first SQL heredoc someone writes is not silently
// outside the derivation.
const SHELL_HEREDOC_RE =
  /<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z_0-9]*)\1[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*$/gm

// Bash interpolation reaching into SQL. `${VAR}` is already a shared placeholder
// pattern; a bare `$VAR` is not, and adding it to the shared list would change
// how every fenced block is substituted. Normalised here instead, so the shared
// pipeline stays untouched.
const normalise_shell_interpolation = (sql) =>
  sql.replace(/\$([A-Za-z_][A-Za-z_0-9]*)/g, '{{ $1 }}')

const looks_like_shell_sql = (body) => EXPLAINABLE_RE.test(body.trim())

const collect_shell_sql_blocks = (
  corpus,
  read_file = (file) => fs.readFileSync(file, 'utf8')
) => {
  const statements = []
  const uncovered = []
  const coverage = {
    shell_files: 0,
    assignments: 0,
    psql_inline: 0,
    heredocs_seen: 0,
    heredocs_with_sql: 0
  }

  for (const entry of corpus) {
    if (path.extname(entry.file) !== '.sh') continue
    coverage.shell_files += 1
    const source = read_file(entry.file)
    const relative = display_path(entry)

    const take = (body, index, shape) => {
      const line = source.slice(0, index).split('\n').length
      const split = split_statements(normalise_shell_interpolation(body))
      if (!split) {
        uncovered.push({
          path: relative,
          line,
          reason: `${shape}: dollar-quoted body; cannot be EXPLAINed`
        })
        return
      }
      for (const original of split) {
        const raw = strip_leading_comments(original)
        if (!EXPLAINABLE_RE.test(raw)) {
          uncovered.push({
            path: relative,
            line,
            reason: `${shape}: not an EXPLAINable statement (${raw.trim().split(/\s+/)[0] || 'empty'})`
          })
          continue
        }
        if (has_identifier_placeholder(raw)) {
          uncovered.push({
            path: relative,
            line,
            reason: `${shape}: interpolation sits inside an identifier; no substitution can make this EXPLAINable`
          })
          continue
        }
        const { sql, substitutions } = substitute_placeholders(
          complete_dangling_with(raw) || raw
        )
        statements.push({ path: relative, line, sql, raw, substitutions })
      }
    }

    SHELL_ASSIGNMENT_RE.lastIndex = 0
    let match
    while ((match = SHELL_ASSIGNMENT_RE.exec(source))) {
      if (!looks_like_shell_sql(match[3])) continue
      coverage.assignments += 1
      take(match[3], match.index, 'bash assignment')
    }

    SHELL_PSQL_INLINE_RE.lastIndex = 0
    while ((match = SHELL_PSQL_INLINE_RE.exec(source))) {
      if (!looks_like_shell_sql(match[2])) continue
      coverage.psql_inline += 1
      take(match[2], match.index, 'psql -c')
    }

    SHELL_HEREDOC_RE.lastIndex = 0
    while ((match = SHELL_HEREDOC_RE.exec(source))) {
      coverage.heredocs_seen += 1
      if (!looks_like_shell_sql(match[3])) continue
      coverage.heredocs_with_sql += 1
      take(match[3], match.index, 'heredoc')
    }
  }

  return { statements, uncovered, coverage }
}

// knex formats a query error as `${sql} - ${message}`, so on a multi-line
// documented query the naive `message.split('\n')[0]` is the first line of the
// SELECT and the actual Postgres error is nowhere in the finding. Read the driver
// error underneath instead, and fall back to the tail of the wrapped string.
const explain_error_detail = (error) => {
  const message = error.originalError?.message || error.message || ''
  const tail = message.split('\n').pop()
  return (tail.includes(' - ') ? tail.split(' - ').pop() : tail).trim()
}

const explain_statements = async ({
  db,
  statements,
  adjudications,
  gate = 2
}) => {
  const findings = []
  const uncovered = []
  let explained = 0

  for (const statement of statements) {
    try {
      await db.raw(`EXPLAIN ${statement.sql}`)
      explained++
    } catch (error) {
      if (UNCOVERED_ERROR_CODES.has(error.code)) {
        uncovered.push({
          path: statement.path,
          line: statement.line,
          reason: `syntax error after placeholder substitution (${explain_error_detail(error)})`
        })
        continue
      }
      explained++
      const site = {
        gate,
        kind: 'documented_sql_does_not_execute',
        path: statement.path,
        line: statement.line,
        code: error.code,
        detail: `${explain_error_detail(error)} [${error.code}]`,
        context: statement.raw.trim().slice(0, 200)
      }
      const adjudication = match_adjudication(adjudications, site)
      if (adjudication) {
        adjudication.used++
        continue
      }
      findings.push(site)
    }
  }

  return { findings, uncovered, explained }
}

// ---------------------------------------------------------------------------
// adjudications
// ---------------------------------------------------------------------------

// An adjudication is keyed on the SITE -- file plus the specific pair or the
// specific error -- and never on a column name alone. Judging per (table, column)
// rather than per column is the difference between fixing and breaking:
// `pff_player_seasonlogs.pff_id` survives while `player.pff_id` does not, and
// `scoring_format_player_seasonlogs.year` survives while `player_seasonlogs.year`
// does not.
const load_adjudications = () => {
  if (!fs.existsSync(adjudications_file)) return []
  const parsed = JSON.parse(fs.readFileSync(adjudications_file, 'utf8'))
  return parsed.adjudications.map((entry) => ({ ...entry, used: 0 }))
}

const match_adjudication = (adjudications, site) => {
  for (const entry of adjudications) {
    if (entry.gate !== site.gate) continue
    if (entry.path !== site.path) continue
    if (site.gate === 1) {
      if (entry.table === site.table && entry.column === site.column)
        return entry
      continue
    }
    // Gate 2 keys on a substring of the failing statement rather than on a line
    // number, so ordinary edits above the block do not silently un-adjudicate it
    // and, more importantly, an edit that changes the statement DOES.
    if (site.context.includes(entry.statement_contains)) return entry
  }
  return null
}

// ---------------------------------------------------------------------------
// negative control
// ---------------------------------------------------------------------------

// Three deliberate mutations, each an instance of what this gate is supposed to
// catch. The gate-1 and gate-2 cases need real corpus material to mutate, so a
// corpus that stopped being read, a pair extractor that stopped matching, or a
// fence extractor that found no SQL all surface here as STAYED GREEN and fail the
// run -- which is why there is no minimum-sites threshold anywhere in this file.
// The gate-2 control's mutation site has to be found in CODE, never in prose.
// A documented query routinely opens with a `-- cross-join optimization with
// optional filtering` comment, and a bare `.replace(/\b(FROM|JOIN)\s+\w+/i)`
// rewrites the first FROM or JOIN it finds THERE — leaving the statement
// semantically identical, so EXPLAIN succeeds and the control reports STAYED
// GREEN over a gate that is working perfectly. That is the control failing OPEN,
// the one direction a control must never fail, and it fired the moment a
// different corpus statement became the first EXPLAINable one. Skips a match
// preceded on its line by `--`, or sitting inside a single-quoted string.
// `FROM` is not always a relation keyword. `EXTRACT(YEAR FROM CURRENT_DATE)`,
// `SUBSTRING(x FROM 2)` and `TRIM(BOTH ' ' FROM x)` all use it as ARGUMENT
// SEPARATOR, and rewriting one of those produces a SYNTAX error rather than the
// 42P01 the control asserts -- so the control reports STAYED GREEN over a gate
// that is working. That is the mirror image of the comment-and-string case this
// helper already guards, failing closed instead of open, and it blocked the run
// on `check-league-cross-source-counters.sh` whose first `FROM` is inside an
// EXTRACT. Detected by walking back to the nearest unclosed `(` and reading the
// identifier that opened it.
const FUNCTIONS_TAKING_FROM_AS_A_SEPARATOR = new Set([
  'extract',
  'substring',
  'trim',
  'overlay',
  'position'
])

const sits_inside_a_from_taking_function = (sql, index) => {
  let depth = 0
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    const character = sql[cursor]
    if (character === ')') depth++
    else if (character === '(') {
      if (depth === 0) {
        const opener = /([a-z_][a-z0-9_]*)\s*$/i.exec(sql.slice(0, cursor))
        return Boolean(
          opener &&
            FUNCTIONS_TAKING_FROM_AS_A_SEPARATOR.has(opener[1].toLowerCase())
        )
      }
      depth--
    }
  }
  return false
}

const mutate_first_relation_reference = (sql) => {
  const pattern = /\b(FROM|JOIN)\s+("?)([a-z0-9_]+)\2/gi
  let match
  while ((match = pattern.exec(sql))) {
    const line_start = sql.lastIndexOf('\n', match.index) + 1
    const preceding = sql.slice(line_start, match.index)
    if (preceding.includes('--')) continue
    if ((preceding.match(/'/g) || []).length % 2 === 1) continue
    if (sits_inside_a_from_taking_function(sql, match.index)) continue
    return (
      sql.slice(0, match.index) +
      `${match[1]} __negative_control_absent__` +
      sql.slice(match.index + match[0].length)
    )
  }
  return null
}

const run_negative_control = async ({
  corpus,
  tables,
  views,
  db,
  statements,
  shell_statements = []
}) => {
  const cases = []

  // 1. gate 1: a column renamed out from under a documented pair. Mutates the
  //    parsed column set rather than the corpus, which is the same drift seen
  //    from the other side and needs no file edit.
  {
    const baseline = run_gate_1({ corpus, tables, views, adjudications: [] })
    let victim = null
    const mutated = new Map()
    for (const [table, columns] of tables) mutated.set(table, new Set(columns))

    // Pick a pair the corpus actually documents and that currently RESOLVES, so
    // the mutation is the only reason it can be reported.
    const find_victim = () => {
      for (const entry of corpus) {
        const source = fs.readFileSync(entry.file, 'utf8')
        PAIR_RE.lastIndex = 0
        let match
        while ((match = PAIR_RE.exec(source))) {
          const [, table, column] = match
          if (views.has(table)) continue
          const columns = mutated.get(table)
          if (!columns || !columns.has(column)) continue
          return { table, column }
        }
      }
      return null
    }

    victim = find_victim()
    if (victim) {
      const columns = mutated.get(victim.table)
      columns.delete(victim.column)
      columns.add(`${victim.column}__negative_control`)
    }

    if (!victim) {
      cases.push([
        'gate 1 reports a column renamed out from under its doc',
        false
      ])
    } else {
      const mutated_run = run_gate_1({
        corpus,
        tables: mutated,
        views,
        adjudications: []
      })
      const reported = mutated_run.findings.some(
        (finding) =>
          finding.table === victim.table && finding.column === victim.column
      )
      const baseline_silent = !baseline.findings.some(
        (finding) =>
          finding.table === victim.table && finding.column === victim.column
      )
      cases.push([
        `gate 1 reports ${victim.table}.${victim.column} renamed out from under its doc`,
        reported && baseline_silent
      ])
    }
  }

  // 2. gate 1: the extractor still sees a qualified pair at all. A pair regex
  //    that stops matching would make case 1 vacuous by leaving no victim, but
  //    this states the denominator directly.
  {
    const synthetic = [
      {
        file: path.join(repo_root, '__negative_control__.md'),
        root: '.',
        absolute_root: repo_root
      }
    ]
    const control_tables = new Map(tables)
    control_tables.set('player', new Set(['pid']))
    // Both directions in one case. The line carries a real qualified reference
    // that MUST be reported, and beside it every shape the structural filters are
    // supposed to reject -- so a filter that grows too greedy fails the first
    // assertion, and a filter that stops rejecting fails the second. `player.sql`
    // is here by name: `player` is a real table and `sql` is a real extension, so
    // it is the one path shape that survives a filter tested against the matched
    // SPAN rather than the whole surrounding token.
    const control_line =
      'player.negative_control_absent beside db/fixtures/test/player.sql, ' +
      'player.sql, `teams.mjs:333`, **config.production.js**, ' +
      'player_gamelogs.snaps_* and playoffs.filter((m) => m.week)\n'
    const result = run_gate_1({
      corpus: synthetic,
      tables: control_tables,
      views,
      adjudications: [],
      read_file: () => control_line
    })
    const reported = result.findings.some(
      (finding) => finding.column === 'negative_control_absent'
    )
    cases.push(['gate 1 extracts a qualified pair out of prose', reported])
    cases.push([
      'gate 1 rejects paths, citations, globs and method calls on the same line',
      result.findings.length === 1
    ])
  }

  // 3. gate 1: the documented-index check, both directions on one line. The
  //    first assertion fails if the CREATE INDEX parse stops matching — which
  //    would be silent, since an index nobody parses reports nothing — and the
  //    second fails if it starts guessing at an expression index, where the
  //    indexed value is not a column at all and there is no claim to check.
  {
    const synthetic = [
      {
        file: path.join(repo_root, '__negative_control_index__.md'),
        root: '.',
        absolute_root: repo_root
      }
    ]
    const control_tables = new Map(tables)
    control_tables.set('player', new Set(['pid', 'first_name']))
    const control_source =
      'CREATE INDEX idx_a ON player (pid, negative_control_absent) INCLUDE (first_name);\n' +
      'CREATE INDEX idx_b ON player (lower(negative_control_absent));\n'
    const result = run_gate_1({
      corpus: synthetic,
      tables: control_tables,
      views,
      adjudications: [],
      read_file: () => control_source
    })
    cases.push([
      'gate 1 reports a documented index on a column the table does not have',
      result.findings.some(
        (finding) => finding.column === 'negative_control_absent'
      )
    ])
    cases.push([
      'gate 1 reads an index column list without guessing at an expression index',
      result.findings.length === 1 &&
        result.coverage.indexed_columns_checked === 3
    ])
  }

  // 4. gate 2: the retaggable-fence heuristic, both directions on one shape.
  //    This suggestion tells a reader to EDIT a doc, so a loose version does
  //    active harm rather than merely adding noise — and the loose version is
  //    what shipped: `SELECT` and `FROM` anywhere in a block matched `.select(`
  //    beside the English word "from" and named all five ```javascript fences in
  //    the corpus. The first case fails if the anchoring ever stops finding real
  //    SQL, the second if it goes back to reading a query builder as SQL.
  {
    const synthetic = [
      {
        file: path.join(repo_root, '__negative_control_fence__.md'),
        root: '.',
        absolute_root: repo_root
      }
    ]
    const retag_count = (source) =>
      collect_sql_blocks(synthetic, () => source).uncovered.filter((entry) =>
        entry.reason.startsWith('SQL inside a')
      ).length

    const sql_in_a_javascript_fence =
      '```javascript\nSELECT player.pid\nFROM player\n```\n'
    const an_actual_javascript_fence =
      '```javascript\n' +
      "players_query.select('player.pid')\n" +
      '// skip the join when this table is the same as the from table\n' +
      '```\n'

    cases.push([
      'gate 2 reports real SQL sitting in a ```javascript fence',
      retag_count(sql_in_a_javascript_fence) === 1
    ])
    cases.push([
      'gate 2 does not read a JavaScript query builder as a retaggable SQL fence',
      retag_count(an_actual_javascript_fence) === 0
    ])
  }

  // 5. gate 2: the two mechanisms that turn an unrunnable documented block into
  //    a checked one. Both are asserted END TO END — the block must produce a
  //    real 42703 against the real database — because the failure mode of each
  //    is silent and identical: the statement quietly returns to the uncovered
  //    pile, the run still says GATE OK, and the coverage line moves by one.
  if (db) {
    const synthetic = [
      {
        file: path.join(repo_root, '__negative_control_block__.md'),
        root: '.',
        absolute_root: repo_root
      }
    ]
    const undefined_column_reported = async (source) => {
      const blocks = collect_sql_blocks(synthetic, () => source)
      if (blocks.statements.length !== 1) return false
      const result = await explain_statements({
        db,
        statements: blocks.statements,
        adjudications: []
      })
      return result.findings.length === 1 && result.findings[0].code === '42703'
    }

    // A CTE-only fragment: no top-level body, so Postgres calls it a syntax
    // error until the gate supplies the SELECT the doc elided.
    cases.push([
      'gate 2 completes a CTE-only fragment and checks the body it wrote',
      await undefined_column_reported(
        '```sql\nWITH control_cte AS (\n' +
          '  SELECT player.negative_control_absent\n  FROM player\n)\n```\n'
      )
    ])

    // Every fill-in marker in one statement. Any one of them left unsubstituted
    // raises 42601, which this gate counts as UNCOVERED rather than reporting —
    // so a substituter that quietly narrows shows up here and nowhere else.
    cases.push([
      'gate 2 substitutes {YEAR}, <pid> and an elision before EXPLAINing',
      await undefined_column_reported(
        '```sql\nSELECT player.negative_control_absent\nFROM player\n' +
          "WHERE player.nfl_draft_year = {YEAR}\n  AND player.pid = '<pid>'\n" +
          "  AND player.primary_position IN ('QB', ...)\n```\n"
      )
    ])
  }

  // 6. gate 2: an EXPLAIN that must fail. Takes a REAL extracted corpus statement
  //    and points it at a table that does not exist, so it fails only if the
  //    fence extraction, the placeholder substitution and the database are all
  //    working. With no extracted statement there is nothing to mutate and the
  //    case reports STAYED GREEN, which is exactly the blind-gate signal.
  if (db) {
    let reported = false
    let victim = null
    for (const statement of statements) {
      try {
        await db.raw(`EXPLAIN ${statement.sql}`)
      } catch {
        continue
      }
      victim = statement
      const mutated = mutate_first_relation_reference(statement.sql)
      if (!mutated) continue
      try {
        await db.raw(`EXPLAIN ${mutated}`)
      } catch (error) {
        reported = error.code === '42P01'
      }
      break
    }
    cases.push([
      victim
        ? `gate 2 reports a corpus statement pointed at a table that does not exist (${victim.path}:${victim.line})`
        : 'gate 2 reports a corpus statement pointed at a table that does not exist',
      reported
    ])
  }

  // 7. gate 3: the shell extractor still pulls SQL out of a bash assignment, and
  //    still declines a bash assignment that is not SQL. Both directions in one
  //    case, on a synthetic file, because the over-eager direction is the one
  //    that fails toward success -- an extractor that swallowed every quoted
  //    string would hand EXPLAIN arbitrary prose and bury the real findings.
  {
    const synthetic_path = path.join(repo_root, '__negative_control__.sh')
    // The declined lines must NOT open on a SQL keyword: the extractor keys on
    // the opening statement keyword, which is the documented rule, so a "prose"
    // example beginning with SELECT is prose only to a human. Writing one is how
    // this control first reported STAYED GREEN against a working extractor.
    const source = [
      "read_query='SELECT pid FROM player'",
      "MESSAGE='counted the rows and reported them'",
      'GREETING="hello world"'
    ].join('\n')
    const extracted = collect_shell_sql_blocks(
      [
        {
          file: synthetic_path,
          root: '.',
          absolute_root: repo_root
        }
      ],
      () => source
    )
    const took_the_sql = extracted.statements.some((statement) =>
      /FROM player/i.test(statement.sql)
    )
    const declined_the_prose = !extracted.statements.some((statement) =>
      /proceed|hello/i.test(statement.sql)
    )
    cases.push([
      'gate 3 extracts SQL from a bash assignment and declines one that is not SQL',
      took_the_sql && declined_the_prose
    ])
  }

  // 8. gate 3: an EXPLAIN that must fail, on a REAL extracted shell statement.
  //    This is the case that detects the corpus going away: if no `.sh` root is
  //    supplied, or the extractor stops matching, there is nothing to mutate and
  //    it reports STAYED GREEN rather than passing over an unread tree. That is
  //    the whole reason gate 3 has no minimum-sites threshold either.
  if (db) {
    let reported = false
    let victim = null
    for (const statement of shell_statements) {
      try {
        await db.raw(`EXPLAIN ${statement.sql}`)
      } catch {
        continue
      }
      victim = statement
      const mutated = mutate_first_relation_reference(statement.sql)
      if (!mutated) continue
      try {
        await db.raw(`EXPLAIN ${mutated}`)
      } catch (error) {
        reported = error.code === '42P01'
      }
      break
    }
    cases.push([
      victim
        ? `gate 3 reports a shell statement pointed at a table that does not exist (${victim.path}:${victim.line})`
        : 'gate 3 reports a shell statement pointed at a table that does not exist -- NO SHELL SQL IN CORPUS',
      reported
    ])
  }

  console.log('')
  console.log('NEGATIVE CONTROL')
  let ok = true
  for (const [label, passed] of cases) {
    console.log(`  ${passed ? 'RED as expected' : 'STAYED GREEN'}  ${label}`)
    if (!passed) ok = false
  }
  return ok
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const parse_argv = () => {
  const argv = process.argv.slice(2)
  const options = { gates: [1, 2, 3], roots: [], keep_database: false }
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    if (flag === '--gate') options.gates = [Number(argv[++index])]
    else if (flag === '--root') options.roots.push(argv[++index])
    // A root contributing EXECUTABLE SQL only. See collect_corpus for the
    // measurement behind the restriction.
    else if (flag === '--executable-root')
      options.roots.push({ path: argv[++index], extensions: new Set(['.sh']) })
    else if (flag === '--keep-database') options.keep_database = true
    else {
      console.error(`unknown argument: ${flag}`)
      process.exit(2)
    }
  }
  options.roots = [...DEFAULT_ROOTS, ...options.roots]
  return options
}

const provision_database = async () => {
  const config = (await import('#config')).default
  const base_connection = {
    ...config.postgres.connection,
    host: process.env.LEAGUE_DB_HOST,
    port: Number(process.env.LEAGUE_DB_PORT)
  }
  const database = `league_docgate_${process.pid}_${Date.now()}`
  const admin = Knex({ client: 'pg', connection: base_connection })
  try {
    await admin.raw(`CREATE DATABASE ${database} OWNER ${base_connection.user}`)
  } catch (error) {
    console.error(
      'TOOLING ERROR: could not provision a gate database on ' +
        `${base_connection.host}:${base_connection.port} -- is \`yarn test:db:up\` running?\n` +
        error.message
    )
    return null
  } finally {
    await admin.destroy()
  }

  process.env.LEAGUE_DB_DATABASE = database
  const db = (await import('#db')).default
  await db.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await db.raw(
    await fsp.readFile(path.join(repo_root, 'db/schema.postgres.sql'), 'utf8')
  )
  return { db, database, base_connection }
}

const main = async () => {
  const options = parse_argv()

  const schema_sql = fs.readFileSync(
    path.join(repo_root, 'db/schema.postgres.sql'),
    'utf8'
  )
  const { tables, views } = parse_schema(schema_sql)
  const { files: corpus, missing } = collect_corpus(options.roots)
  const adjudications = load_adjudications()

  console.log('DOCUMENTATION SCHEMA DRIFT GATE')
  console.log('')
  console.log('CORPUS')
  for (const entry of options.roots) {
    const root = typeof entry === 'string' ? entry : entry.path
    const restriction =
      typeof entry === 'string'
        ? ''
        : `  (${[...entry.extensions].join(', ')} only — executable SQL)`
    const count = corpus.filter((file) => file.root === root).length
    console.log(
      `  ${missing.includes(root) ? 'MISSING  ' : String(count).padStart(4)} ${missing.includes(root) ? '' : 'files  '}${root}${restriction}`
    )
  }
  if (missing.length) {
    console.log('')
    console.log(
      `TOOLING ERROR: ${missing.length} root(s) do not exist. A corpus root that ` +
        'silently resolves to nothing is a gate that reads green over an unread tree.'
    )
    process.exit(2)
  }

  const findings = []

  const gate_1 = run_gate_1({ corpus, tables, views, adjudications })
  if (options.gates.includes(1)) findings.push(...gate_1.findings)

  let provisioned = null
  let gate_2 = { findings: [], uncovered: [], explained: 0 }
  let gate_3 = { findings: [], uncovered: [], explained: 0 }
  const blocks = collect_sql_blocks(corpus)
  const shell_blocks = collect_shell_sql_blocks(corpus)

  // Gates 2 and 3 share one scratch database: same oracle, same schema, and
  // provisioning it twice would double the only slow step in the run.
  const needs_database = options.gates.includes(2) || options.gates.includes(3)
  if (needs_database) {
    provisioned = await provision_database()
    if (!provisioned) process.exit(2)
  }

  if (options.gates.includes(2)) {
    gate_2 = await explain_statements({
      db: provisioned.db,
      statements: blocks.statements,
      adjudications
    })
    findings.push(...gate_2.findings)
  }

  if (options.gates.includes(3)) {
    gate_3 = await explain_statements({
      db: provisioned.db,
      statements: shell_blocks.statements,
      adjudications,
      gate: 3
    })
    findings.push(...gate_3.findings)
  }

  console.log('')
  console.log('COVERAGE (measured, not assumed)')
  console.log(`  files read                              ${corpus.length}`)
  console.log(
    `  schema tables / views parsed            ${tables.size} / ${views.size}`
  )
  console.log(
    `  gate 1: table.column pairs checked      ${gate_1.coverage.pairs_checked} (in ${gate_1.coverage.files_with_pairs} files)`
  )
  console.log(
    `  gate 1: skipped, table not a table      ${gate_1.coverage.pairs_skipped_unknown_table}`
  )
  console.log(
    `  gate 1: skipped, table is a VIEW        ${gate_1.coverage.pairs_skipped_view} — a view's columns are not in the dump`
  )
  console.log(
    `  gate 1: documented index columns checked ${gate_1.coverage.indexed_columns_checked}`
  )
  console.log(
    `  gate 1: index skipped, table not a table ${gate_1.coverage.indexed_columns_skipped_unknown_table}`
  )
  console.log(
    `  gate 2: \`\`\`sql fences found              ${blocks.sql_fences}`
  )
  console.log(
    `  gate 2: statements EXPLAINed            ${options.gates.includes(2) ? gate_2.explained : 'not run'} of ${blocks.statements.length} extracted`
  )
  console.log(
    `  gate 3: shell scripts read              ${shell_blocks.coverage.shell_files}`
  )
  console.log(
    `  gate 3: SQL-bearing bash assignments    ${shell_blocks.coverage.assignments}` +
      `, psql -c ${shell_blocks.coverage.psql_inline}` +
      `, heredocs ${shell_blocks.coverage.heredocs_with_sql} of ${shell_blocks.coverage.heredocs_seen} seen`
  )
  console.log(
    `  gate 3: statements EXPLAINed            ${options.gates.includes(3) ? gate_3.explained : 'not run'} of ${shell_blocks.statements.length} extracted`
  )
  const uncovered = [
    ...blocks.uncovered,
    ...gate_2.uncovered,
    ...shell_blocks.uncovered,
    ...gate_3.uncovered
  ]
  console.log(
    `  gates 2+3: NOT checked                  ${uncovered.length} — listed below`
  )

  if (uncovered.length) {
    console.log('')
    console.log(
      'GATE 2 NOT COVERED — these blocks are NOT checked against any schema'
    )
    const by_reason = new Map()
    for (const entry of uncovered) {
      const key = entry.reason.replace(/\(.*\)/, '(...)')
      if (!by_reason.has(key)) by_reason.set(key, [])
      by_reason.get(key).push(entry)
    }
    for (const [reason, entries] of [...by_reason].sort(
      (a, b) => b[1].length - a[1].length
    )) {
      console.log(`  ${entries.length}  ${reason}`)
      for (const entry of entries)
        console.log(`       ${entry.path}:${entry.line}`)
    }
  }

  // An adjudication that suppresses nothing is a finding, not a comment. This is
  // what stops the file drifting into the name denylist that blinded
  // `check-renamed-column-consumers`: an entry survives only as long as the site
  // it excuses still exists, so a repaired or deleted site forces the entry out
  // rather than leaving a standing exemption for a name.
  for (const entry of adjudications) {
    if (entry.used) continue
    if (!options.gates.includes(entry.gate)) continue
    findings.push({
      gate: entry.gate,
      kind: 'stale_adjudication',
      path: entry.path,
      line: 0,
      detail:
        `adjudication for ${entry.table ? `${entry.table}.${entry.column}` : `"${entry.statement_contains}"`} ` +
        'no longer suppresses anything — the site was repaired or moved, so remove the entry',
      context: entry.reason
    })
  }

  if (findings.length) {
    console.log('')
    console.log(`FINDINGS (${findings.length})`)
    for (const finding of findings.sort(
      (a, b) => a.gate - b.gate || a.path.localeCompare(b.path)
    )) {
      console.log(`  GATE ${finding.gate} ${finding.kind}`)
      console.log(`    ${finding.path}:${finding.line}`)
      console.log(`    ${finding.detail}`)
      if (finding.context) console.log(`    ${finding.context}`)
    }
  }

  const control_ok = await run_negative_control({
    corpus,
    tables,
    views,
    db: provisioned ? provisioned.db : null,
    statements: blocks.statements,
    shell_statements: shell_blocks.statements
  })

  if (provisioned) {
    await provisioned.db.destroy()
    if (options.keep_database) {
      console.log(`\nleft database ${provisioned.database} in place`)
    } else {
      const cleanup = Knex({
        client: 'pg',
        connection: provisioned.base_connection
      })
      try {
        await cleanup.raw(`DROP DATABASE IF EXISTS ${provisioned.database}`)
      } finally {
        await cleanup.destroy()
      }
    }
  }

  console.log('')
  if (!control_ok) {
    console.log(
      'GATE FAIL: the negative control did not go red. This gate cannot be trusted until it does.'
    )
    process.exit(1)
  }
  if (findings.length) {
    console.log(`GATE FAIL: ${findings.length} finding(s)`)
    process.exit(1)
  }
  console.log('GATE OK')
  process.exit(0)
}

main()
