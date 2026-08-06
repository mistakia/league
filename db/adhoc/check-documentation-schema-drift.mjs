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
//           in a 2026-07-30 sweep.
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
// mutates its own oracles in three ways this gate is supposed to catch and
// asserts each is reported; a control that stays green FAILS the run. The
// controls need real corpus material to mutate, so they are also what detects
// the extraction going blind -- there is deliberately no minimum-sites constant,
// because that case is already covered by a mechanism that has to work anyway.
//
// Usage:
//
//   yarn test:db:up                            # gate 2 only
//   node db/adhoc/check-documentation-schema-drift.mjs \
//     --root ../../../guideline/nfl --root ../../../text/league \
//     --root ../../../workflow/nfl
//
//   node db/adhoc/check-documentation-schema-drift.mjs --gate 1   # no database
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

const SCANNED_EXTENSIONS = new Set(['.md', '.mjs', '.cron', '.sql'])

const adjudications_file = path.join(
  repo_root,
  'db/adhoc/documentation-schema-drift-adjudications.json'
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

const collect_corpus = (roots) => {
  const files = []
  const missing = []
  for (const root of roots) {
    const absolute = path.isAbsolute(root) ? root : path.join(repo_root, root)
    if (!fs.existsSync(absolute)) {
      missing.push(root)
      continue
    }
    // A root may name a single file (`CLAUDE.md`) as well as a directory.
    if (fs.statSync(absolute).isFile()) {
      files.push({
        file: absolute,
        root,
        absolute_root: path.dirname(absolute)
      })
      continue
    }
    for (const file of walk_files(absolute)) {
      files.push({ file, root, absolute_root: absolute })
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
  const final_segment = token
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9].*$/, '')
  return FILE_EXTENSIONS.has(final_segment)
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
  }

  return {
    findings,
    coverage: {
      pairs_checked,
      pairs_skipped_unknown_table,
      pairs_skipped_view,
      files_with_pairs: files_with_pairs.size
    }
  }
}

// ---------------------------------------------------------------------------
// gate 2: fenced SQL
// ---------------------------------------------------------------------------

const SQL_FENCE_RE = /```sql\b[^\n]*\n([\s\S]*?)```/g
const OTHER_FENCE_RE = /```(?!sql\b)([a-z]*)\b[^\n]*\n([\s\S]*?)```/g

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
  /<[A-Z][A-Z0-9_]*>/g, // <YEAR>
  /\{[a-z_][a-z0-9_]*\}/g, // {year}
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
const has_identifier_placeholder = (sql) =>
  PLACEHOLDER_PATTERNS.some((pattern) => {
    const anchored = new RegExp(
      `(?:[a-z0-9_](?:${pattern.source})|(?:${pattern.source})[a-z0-9_])`,
      'i'
    )
    return anchored.test(sql)
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

// EXPLAIN error classes. A statement this gate could not put into EXPLAINable
// shape raises a SYNTAX error (42601), which says nothing about the schema and is
// counted as uncovered. Everything else is a real disagreement between the
// documented SQL and the schema -- 42703 undefined_column and 42P01
// undefined_table are the rename shapes, and 42803 grouping_error is what caught
// the reference query in `text/league/data-model-reference.md` that had a GROUP BY
// with no aggregates.
const UNCOVERED_ERROR_CODES = new Set(['42601'])

const collect_sql_blocks = (corpus) => {
  const statements = []
  const uncovered = []
  let sql_fences = 0
  let sql_like_non_sql_fences = 0

  for (const entry of corpus) {
    const source = fs.readFileSync(entry.file, 'utf8')
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
        const { sql, substitutions } = substitute_placeholders(raw)
        statements.push({ path: relative, line, sql, raw, substitutions })
      }
    }

    OTHER_FENCE_RE.lastIndex = 0
    while ((match = OTHER_FENCE_RE.exec(source))) {
      if (!/\bSELECT\b[\s\S]*\bFROM\b/i.test(match[2])) continue
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

// knex formats a query error as `${sql} - ${message}`, so on a multi-line
// documented query the naive `message.split('\n')[0]` is the first line of the
// SELECT and the actual Postgres error is nowhere in the finding. Read the driver
// error underneath instead, and fall back to the tail of the wrapped string.
const explain_error_detail = (error) => {
  const message = error.originalError?.message || error.message || ''
  const tail = message.split('\n').pop()
  return (tail.includes(' - ') ? tail.split(' - ').pop() : tail).trim()
}

const explain_statements = async ({ db, statements, adjudications }) => {
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
        gate: 2,
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
const run_negative_control = async ({
  corpus,
  tables,
  views,
  db,
  statements
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

  // 3. gate 2: an EXPLAIN that must fail. Takes a REAL extracted corpus statement
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
      const mutated = statement.sql.replace(
        /\b(FROM|JOIN)\s+("?)([a-z0-9_]+)\2/i,
        '$1 __negative_control_absent__'
      )
      if (mutated === statement.sql) continue
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
  const options = { gates: [1, 2], roots: [], keep_database: false }
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    if (flag === '--gate') options.gates = [Number(argv[++index])]
    else if (flag === '--root') options.roots.push(argv[++index])
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
  for (const root of options.roots) {
    const count = corpus.filter((entry) => entry.root === root).length
    console.log(
      `  ${missing.includes(root) ? 'MISSING  ' : String(count).padStart(4)} ${missing.includes(root) ? '' : 'files  '}${root}`
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
  const blocks = collect_sql_blocks(corpus)

  if (options.gates.includes(2)) {
    provisioned = await provision_database()
    if (!provisioned) process.exit(2)
    gate_2 = await explain_statements({
      db: provisioned.db,
      statements: blocks.statements,
      adjudications
    })
    findings.push(...gate_2.findings)
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
    `  gate 2: \`\`\`sql fences found              ${blocks.sql_fences}`
  )
  console.log(
    `  gate 2: statements EXPLAINed            ${options.gates.includes(2) ? gate_2.explained : 'not run'} of ${blocks.statements.length} extracted`
  )
  const uncovered = [...blocks.uncovered, ...gate_2.uncovered]
  console.log(
    `  gate 2: NOT checked                     ${uncovered.length} — listed below`
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
    statements: blocks.statements
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
