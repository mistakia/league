// Consumer gate for renamed and dropped columns -- the two defect classes that
// the 2026-08-05 restricted-free-agency incident exposed, neither of which any
// existing gate can see.
//
//   CLASS 1  server reads a DB column by a name the schema no longer carries.
//            Postgres raises 42703, but only when that code path executes, so a
//            green suite and a green deploy both report success.
//
//   CLASS 2  server reads the RIGHT column and EMITS it under the OLD API key
//            (or the SPA still reads the old key). The value is correct
//            server-side and lost at the client boundary, so a server-side grep
//            for the old column name finds nothing -- the SOURCE was renamed and
//            only the DESTINATION key is stale. This is the class that rendered
//            every manager's RFA bid as $0 for ~13 hours while every server
//            oracle stayed green.
//
// WHY THE TWO GATES ARE SHAPED DIFFERENTLY. Class 1 needs no rename list: a
// qualified `'<table>.<column>'` literal either resolves against the current
// schema or it does not, so the schema alone is a complete oracle. That matters
// because the rename record is NOT complete -- several clusters were run as
// expand-contract (ADD/backfill/DROP, zero RENAME statements), so any gate
// deriving old names by grepping `db/adhoc` for RENAME is structurally blind to
// them. Class 2 has no such self-check: an emitted object key is just a key, and
// nothing but the rename itself says it is stale. So gate 2 works off the schema
// DIFF against a base ref, which makes it incremental -- it asks "did THIS change
// remove a column whose old name is still read somewhere", which is exactly the
// question CI is positioned to answer.
//
// HOW GATE 2 IS ANCHORED, AND WHY IT IS NOT A WORD FILTER.
//
// Gate 2 shipped as a bare-identifier scan over the removed column NAME, which
// made every ordinary English word unusable as a pattern -- `total`, `year`,
// `value`, `team`, `score`, `start` -- so it carried a hardcoded stoplist that
// suppressed exactly those. That is the wrong trade twice over. Renames
// CONCENTRATE on the most common column names, so the stoplist suppressed the
// class the gate exists to catch, and it did so silently: a green run read as
// coverage while being structurally unable to report the suppressed names. It
// produced a false negative on a live, damaging defect. `72346e579` renamed
// `scoring_format_player_projection_points.total` to `projected_points_total`
// and left `scripts/process-projections-for-league-format.mjs` selecting the
// table without aliasing it back, while `get_player_week_total` still read
// `.total`; the writer deletes by `(league_format_id, year)` before inserting,
// so a run wiped a year of values and exited 0. Gate 2 returned 129 findings on
// that revision and not one of them was `total`.
//
// The replacement anchors on the TABLE instead of on the word, which removes the
// need for any word list. A silent class-2 defect has a specific shape: a query
// selects an affected table WHOLESALE (no explicit projection), so the row loses
// the old key with no error, and some consumer still reads that key. An explicit
// projection naming the old column is NOT this class -- Postgres raises 42703
// and the failure is loud. So the candidate set is `db('<table>')` statements
// with no explicit projection (a `.select('*')` wildcard IS wholesale), for
// tables the base diff says lost a column, minus any statement that aliases the
// old name back. That is a small, regenerable inventory rather than a corpus-wide
// word search: 259 sites against the base below, where the same scan with the
// stoplist merely removed returns 2107.
//
// Findings are then ADJUDICATED PER SITE, not suppressed per word. Each verdict
// lives in renamed-column-consumer-adjudications.json against the (table,
// column) pair it settles, and records the exact site list reviewed -- so a NEW
// query site for an already-adjudicated pair is reported rather than inherited.
// Nothing is filtered by name, and every suppression names a reviewer's reason.
//
// Usage:
//   node db/gates/check-renamed-column-consumers.mjs                  # both gates
//   node db/gates/check-renamed-column-consumers.mjs --base <ref>     # gate 2 base
//   node db/gates/check-renamed-column-consumers.mjs --gate 1         # one gate
//   node db/gates/check-renamed-column-consumers.mjs --json
//   node db/gates/check-renamed-column-consumers.mjs --unadjudicated  # only new sites
//
// Exit code is non-zero when either gate finds a consumer (gate-friendly).
// Gate 2 fails only on findings no adjudication covers.
//
// ACCEPTANCE TEST -- a gate is worthless unless it goes red at the pre-fix
// revision, so this one has a named one, and the full cycle was VERIFIED on
// 2026-08-05 rather than merely asserted. In a worktree at `42699c774^` (which
// carries this gate and its adjudications but not the fix):
//
//   node db/gates/check-renamed-column-consumers.mjs --gate 2 \
//     --base 62ca45544 --unadjudicated
//
// reports exactly ONE unadjudicated finding -- `total` on
// `scripts/process-projections-for-league-format.mjs:158` -- and exits 1. The
// same command at `42699c774` or later reports none and exits 0. Same gate, same
// adjudication file, same base; the only variable is the fix.
//
// Note the flagged file contains no occurrence of the string `total` anywhere.
// It is reachable only because the anchor is the table, which is the whole
// argument for the redesign: no name-anchored scan of that file could have found
// it, and the stoplist version returned 129 findings there without naming it.
//
// The fix (`42699c774`) added an explicit projection, so the site left the
// candidate set entirely rather than needing an adjudication -- which is the
// right end state, and worth knowing before you go looking for its entry.
//
// NEGATIVE CONTROL, equally required: remove an adjudication entry and confirm
// its sites reappear. Verified twice -- deleting `teams.cap` took the gate from
// 1 finding to 49, and `nfl_plays.dwn` from 1 to 14. This is the only thing
// distinguishing "no findings" from "cannot see findings", and the gate this
// replaced had never been controlled that way.
//
// BLIND SPOTS -- this is a FLOOR, not a proof.
//   - Gate 1 only sees TABLE-QUALIFIED string literals. A bare `.select('pos')`
//     or an object-shorthand `.where({ pos })` names no table and cannot be
//     resolved without type inference; those stay invisible.
//   - Gate 1 skips a prefix that is not a real table name, so a CTE or subquery
//     alias is correctly ignored -- but a CTE deliberately NAMED after a table
//     while projecting different columns would be a false positive. None exist
//     today; add it to CTE_ALIAS_ALLOWLIST if one appears.
//   - Gate 2 cannot see a key renamed WITHOUT a schema change (a pure API-shape
//     rename) -- there is no schema diff to derive it from.
//   - Gate 2 only sees a query whose FROM target is a `db('<table>')` literal.
//     A table name held in a constant, or reached through a knex instance bound
//     elsewhere, names no literal and is invisible. Same hazard the league
//     CLAUDE.md records for table-name-anchored counts generally.
//   - A JOINED table is invisible to gate 2, which is a stronger statement than
//     the line above and was not documented here until 2026-08-06. The candidate
//     set is built from `db('<table>')` FROM-target literals only, so a table
//     reached through `.join`/`.leftJoin` off a DIFFERENT `db('<other>')` is
//     structurally unreachable no matter how literal its name is. That is how
//     `72346e579`'s `transactions.value` rename shipped a live defect:
//     `libs-server/get-league-rosters-from-database.mjs` reaches `transactions`
//     through `.leftJoin` off `db('rosters_players')`, so it never entered the
//     candidate set -- at `--base 62ca45544` this gate produces 36 sites for
//     that pair and that file is not among them. The pair was then adjudicated
//     already-swept off a single producer, and every team's salary space
//     rendered as the raw $200 cap. The gap is general: 22 join-only sites
//     across the same window.
//
//     `db/gates/check-rename-alias-residue.mjs` covers that class from the other
//     side. It anchors on the ALIAS-BACK SITE, which needs neither a FROM-target
//     literal nor a distinctive word, and its discriminator is that the alias
//     target is a column the table actually LOST. Run it alongside this gate on
//     any rename cluster; `yarn check:cluster --base <ref>` runs both.
//
//     Extending this gate's candidate set to `.join`/`.leftJoin` literals is a
//     small change to `from_re` below and is deliberately NOT done here: it
//     reopens every existing adjudication, since site lists are keyed on file
//     and adding join sites adds files, which per CLAUDE.md defers every
//     session's push behind a red master. It belongs in its own cluster with its
//     own re-adjudication pass.
//   - Gate 2 cannot prove a cross-file read reaches a given query. It reports
//     the pairing and asks a human; `libs-server` is a barrel, so import-graph
//     reachability collapses to "everything" and cannot narrow it.
//   - A column removed from a table nothing queries by literal, and read
//     nowhere, is not reported. That is correct, not a miss.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  format_corpus,
  resolve_corpus,
  verdict_suffix
} from './scan-corpus.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')

// `private` holds real consumers of real columns and is a submodule NO workflow
// checks out, so on a runner it is a present but EMPTY directory. `walk_files`
// below swallows that silently, which is why the corpus is declared and
// reported rather than inferred from the walk.
const SERVER_ROOTS = [
  'api',
  'libs-server',
  'libs-shared',
  'scripts',
  'jobs',
  'private'
]
const SPA_ROOTS = ['app']

// A CTE or subquery alias that shadows a real table name would produce a false
// positive in gate 1. `.as('<name>')` aliases are detected per-file instead (see
// collect_local_aliases); this set is for a shadow the scan cannot infer.
const CTE_ALIAS_ALLOWLIST = new Set([])

// `'rosters.csv'` and `'transactions.json'` parse as table-qualified columns
// because the stem is a real table name. A file extension is never a column.
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

const adjudications_path = path.join(
  __dirname,
  'renamed-column-consumer-adjudications.json'
)

// A one- or two-character column name is not matchable as an identifier at all
// (`m`, `w`, `td`, `wp`) -- there is no read shape that distinguishes it from
// arithmetic or a minified local. Unlike the word stoplist this replaces, the
// bound is on the PATTERN's usability rather than on which words are common, so
// it cannot single out the names renames concentrate on. It is still an
// under-report, and it is reported as a count rather than left silent.
const MIN_MATCHABLE_COLUMN_LENGTH = 3

const parse_schema = (sql) => {
  const tables = new Map()
  const create_re =
    /CREATE TABLE (?:public\.)?"?([a-z_0-9]+)"?\s*\(([\s\S]*?)\n\);/g
  let match
  while ((match = create_re.exec(sql)) !== null) {
    const [, table_name, body] = match
    const columns = new Set()
    for (const raw_line of body.split('\n')) {
      const line = raw_line.trim()
      if (
        !line ||
        line.startsWith('CONSTRAINT') ||
        line.startsWith('PRIMARY')
      ) {
        continue
      }
      const column_match = line.match(/^"?([a-z_0-9]+)"?\s+/i)
      if (column_match) columns.add(column_match[1])
    }
    tables.set(table_name, columns)
  }
  return tables
}

const walk_files = (roots, extensions) => {
  const files = []
  const visit = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const full_path = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(full_path)
      else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(full_path)
      }
    }
  }
  for (const root of roots) visit(path.join(repo_root, root))
  return files
}

// What each declared root actually yielded. A count is the authoritative
// oracle for whether a root was read -- an existence check is not, because an
// uninitialized submodule is a present, empty mountpoint.
const count_files_by_root = (roots, extensions) =>
  new Map(roots.map((root) => [root, walk_files([root], extensions).length]))

const is_comment = (line) => {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*')
}

// A subquery aliased as a real table name (`.as('transactions')`) legitimately
// projects columns the physical table does not have. Collect those per-file so
// the shadow suppresses findings only where it is actually declared.
const collect_local_aliases = (source) => {
  const aliases = new Set()
  const alias_re = /\.as\(\s*['"`]([a-z_][a-z_0-9]*)['"`]\s*\)/g
  let match
  while ((match = alias_re.exec(source)) !== null) aliases.add(match[1])
  return aliases
}

// GATE 1 -- every table-qualified column literal must resolve against the schema.
//
// `source_override` substitutes one file's contents for a mutated copy without
// touching the tree, which is what lets the negative controls below drive the
// real scan over real corpus material. Nothing was extracted to make the gate
// testable; the scan a control exercises is the scan CI runs.
const run_gate_1 = (tables, { source_override } = {}) => {
  const findings = []
  const qualified_re = /['"`]([a-z_][a-z_0-9]*)\.([a-z_][a-z_0-9]*)['"`]/g
  for (const file of walk_files(SERVER_ROOTS, ['.mjs', '.js'])) {
    const relative_path = path.relative(repo_root, file)
    const source =
      source_override && source_override.file === relative_path
        ? source_override.source
        : fs.readFileSync(file, 'utf8')
    const local_aliases = collect_local_aliases(source)
    const lines = source.split('\n')
    lines.forEach((line, index) => {
      if (is_comment(line)) return
      let match
      qualified_re.lastIndex = 0
      while ((match = qualified_re.exec(line)) !== null) {
        const [, table_name, column_name] = match
        if (!tables.has(table_name)) continue
        if (CTE_ALIAS_ALLOWLIST.has(table_name)) continue
        if (local_aliases.has(table_name)) continue
        if (FILE_EXTENSION_SUFFIXES.has(column_name)) continue
        if (tables.get(table_name).has(column_name)) continue
        findings.push({
          gate: 1,
          table: table_name,
          column: column_name,
          file: relative_path,
          line: index + 1,
          text: line.trim().slice(0, 140)
        })
      }
    })
  }
  return findings
}

// ---------------------------------------------------------------------------
// gate 1 negative controls
// ---------------------------------------------------------------------------

// Five controls over gate 1, run on EVERY invocation, and a control that does
// not hold fails the gate.
//
// Gate 1 is the half that runs in CI on every push (`--gate 1`, see
// .github/workflows/test.yml), and it is also the half with no acceptance test:
// the named pre-fix revision at the top of this file exercises gate 2. Its
// steady state is `none`, printed identically by a scan that resolved 900
// literals and by a scan that walked an empty tree.
//
// ONE RED and FOUR SILENT, which is the right ratio for this gate rather than
// an accident. Gate 1's oracle -- does this literal resolve against the schema
// -- is one line, and everything difficult about it is the four exclusions that
// decide a literal is NOT a finding: an unknown prefix, a locally aliased
// subquery, a file extension, and a comment. Each of those fails in the
// direction that looks like MORE coverage, and the header records what that
// costs: the scan this replaced returned 129 findings on the revision of a live
// defect and none of them named the defect.
//
// Every control mutates REAL corpus material, so an emptied or unreachable
// corpus reports NO MATERIAL and fails rather than passing vacuously.
const CONTROL_COLUMN = 'zzz_control_absent'

// A real non-comment line carrying a qualified literal that RESOLVES today.
// `extra` lets a control demand more of the file it picks -- the alias control
// needs one that also shadows a table name locally.
const pick_qualified_literal = ({ tables, extra }) => {
  const qualified_re = /['"`]([a-z_][a-z_0-9]*)\.([a-z_][a-z_0-9]*)['"`]/g
  for (const file of walk_files(SERVER_ROOTS, ['.mjs', '.js'])) {
    const source = fs.readFileSync(file, 'utf8')
    const local_aliases = collect_local_aliases(source)
    const context = extra ? extra({ source, local_aliases, tables }) : {}
    if (context === null) continue
    const lines = source.split('\n')
    for (const [index, line] of lines.entries()) {
      if (is_comment(line)) continue
      qualified_re.lastIndex = 0
      let match
      while ((match = qualified_re.exec(line)) !== null) {
        const [literal, table_name, column_name] = match
        if (!tables.has(table_name)) continue
        if (local_aliases.has(table_name)) continue
        if (FILE_EXTENSION_SUFFIXES.has(column_name)) continue
        if (!tables.get(table_name).has(column_name)) continue
        return {
          file: path.relative(repo_root, file),
          source,
          lines,
          line_index: index,
          literal,
          table: table_name,
          column: column_name,
          ...context
        }
      }
    }
  }
  return null
}

// Rewrite the picked LINE and rebuild the source around it. Line-scoped because
// gate 1 matches per line, and because a whole-source replace would also
// rewrite the same literal wherever else the file spells it.
const rewrite_line = (target, rewrite) => {
  const lines = [...target.lines]
  lines[target.line_index] = rewrite(lines[target.line_index])
  return lines.join('\n')
}

const GATE_1_CONTROLS = [
  {
    name: 'a qualified literal naming a column the table does not have is reported',
    direction: 'must-report',
    mutate: (target) =>
      rewrite_line(target, (line) =>
        line.replace(target.literal, `'${target.table}.${CONTROL_COLUMN}'`)
      )
  },
  {
    // Without this exclusion every subquery prefix in the tree becomes a
    // finding, since nothing binds it to a table.
    name: 'a prefix that is not a table name is NOT reported',
    direction: 'must-stay-silent',
    mutate: (target) =>
      rewrite_line(target, (line) =>
        line.replace(
          target.literal,
          `'zzz_control_not_a_table.${CONTROL_COLUMN}'`
        )
      )
  },
  {
    // `'rosters.csv'` parses as table-qualified because the stem is a table.
    name: 'a file extension after a table name is NOT reported',
    direction: 'must-stay-silent',
    // The planted column IS the extension here, so the control has to watch for
    // `csv` rather than the sentinel -- watching for the sentinel would make it
    // pass over a scan that reports every `'rosters.csv'` in the tree.
    expect_column: 'csv',
    mutate: (target) =>
      rewrite_line(target, (line) =>
        line.replace(target.literal, `'${target.table}.csv'`)
      )
  },
  {
    name: 'an unresolvable literal inside a comment is NOT reported',
    direction: 'must-stay-silent',
    mutate: (target) =>
      rewrite_line(
        target,
        (line) =>
          `// ${line.replace(target.literal, `'${target.table}.${CONTROL_COLUMN}'`)}`
      )
  },
  {
    // A subquery aliased as a real table name legitimately projects columns the
    // physical table does not have. Needs a file that actually declares such an
    // alias, so it picks its own material.
    name: 'a literal on a locally aliased subquery shadowing a table name is NOT reported',
    direction: 'must-stay-silent',
    extra: ({ local_aliases, tables }) => {
      const shadow = [...local_aliases].find((alias) => tables.has(alias))
      return shadow ? { shadow } : null
    },
    mutate: (target) =>
      rewrite_line(target, (line) =>
        line.replace(target.literal, `'${target.shadow}.${CONTROL_COLUMN}'`)
      )
  }
]

const run_gate_1_negative_controls = (tables) =>
  GATE_1_CONTROLS.map((control) => {
    const target = pick_qualified_literal({ tables, extra: control.extra })
    if (!target) {
      return {
        name: control.name,
        result: 'NO MATERIAL',
        detail:
          'no resolving qualified literal of this shape -- the scan may not be reaching the corpus',
        passed: false
      }
    }

    const mutated = control.mutate(target)
    if (mutated === target.source) {
      return {
        name: control.name,
        result: 'MUTATION DID NOT APPLY',
        detail: `${target.file} unchanged -- the control proved nothing`,
        passed: false
      }
    }

    const findings = run_gate_1(tables, {
      source_override: { file: target.file, source: mutated }
    })
    const expected_column = control.expect_column || CONTROL_COLUMN
    const reported = findings.some(
      (finding) =>
        finding.file === target.file && finding.column === expected_column
    )
    const passed = control.direction === 'must-report' ? reported : !reported
    return {
      name: control.name,
      result: passed
        ? control.direction === 'must-report'
          ? 'WENT RED'
          : 'STAYED SILENT'
        : control.direction === 'must-report'
          ? 'STAYED GREEN'
          : 'FALSE POSITIVE',
      detail: `${target.file}:${target.line_index + 1}`,
      passed
    }
  })

const schema_at_ref = (ref) => {
  try {
    return execFileSync('git', ['show', `${ref}:db/schema.postgres.sql`], {
      cwd: repo_root,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024
    })
  } catch {
    return null
  }
}

// A partitioned table repeats every column across its children, which would list
// 30 table names for one finding. Report the parent only.
const is_partition_child = (name) =>
  /_year_\d{4}$/.test(name) ||
  /_y\d{4}$/.test(name) ||
  name.endsWith('_default')

// The shapes in which a stale key is actually READ: Immutable `get`/`getIn`, a
// bracket access, or a plain property access. The property-access shape is what
// the original scan lacked, and it is the one the `total` defect took --
// `Number(week_points.total)` matches none of the quoted-key shapes.
//
// `(?!\s*\()` on the property form drops method calls, so `.total()` is not read
// as a column.
//
// `field_argument` is a bare quoted field NAME passed to a helper --
// `groupBy(picks, 'year')` -- a row read with no receiver to anchor it. It is
// matched in the SPA ONLY. On the server the table anchor already establishes
// the row, and matching bare quoted strings is what made the old scan unusable
// without a word list; in `app/` there is no anchor, and this is the shape a
// real defect took: dashboard-draft-picks grouped every pick under one
// `undefined` heading from the season_grain apply until de3e0bb32.
const READ_SHAPES = [
  [
    'accessor',
    (column) => `\\.get(?:In)?\\(\\s*(?:\\[\\s*)?['"\`]${column}['"\`]`
  ],
  ['index', (column) => `\\[\\s*['"\`]${column}['"\`]\\s*\\]`],
  ['property', (column) => `\\.${column}\\b(?!\\s*\\()`],
  ['field_argument', (column) => `,\\s*['"\`]${column}['"\`]\\s*\\)`]
]

const SPA_ONLY_SHAPES = new Set(['field_argument'])

// The shapes worth putting in front of a reviewer. `property` and `index` are
// excluded because in the SPA both are dominated by redux store keys and module
// constants that merely share a column's name: on the season_grain cluster
// `year` had 201 SPA sites, 182 of them `.year` property reads, 145 of those
// `current_season.year`. Nobody reads a list like that, and not reading it is
// how `(draft, year)` was adjudicated `already-swept` while two components were
// still reading the old key off a draft row.
const HIGH_SIGNAL_SHAPES = new Set(['accessor', 'field_argument'])

const column_read_patterns = (column, surface) =>
  READ_SHAPES.filter(
    ([shape]) => surface === 'spa' || !SPA_ONLY_SHAPES.has(shape)
  ).map(([shape, build]) => [shape, new RegExp(build(column))])

// Every place the old name is still read, with its file, so a finding can say
// WHERE the stale read is rather than only that one exists somewhere.
const collect_read_sites = (columns) => {
  const sites = new Map()
  for (const column of columns) sites.set(column, [])
  const scan = (roots, surface, extensions) => {
    const patterns = new Map(
      [...columns].map((column) => [
        column,
        column_read_patterns(column, surface)
      ])
    )
    for (const file of walk_files(roots, extensions)) {
      const relative_path = path.relative(repo_root, file)
      const lines = fs.readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (is_comment(line)) return
        for (const [column, shapes] of patterns) {
          const matched = shapes.find(([, pattern]) => pattern.test(line))
          if (!matched) continue
          sites.get(column).push({
            surface,
            shape: matched[0],
            file: relative_path,
            line: index + 1,
            text: line.trim().slice(0, 140)
          })
        }
      })
    }
  }
  scan(SERVER_ROOTS, 'server', ['.mjs', '.js'])
  scan(SPA_ROOTS, 'spa', ['.js', '.mjs'])
  return sites
}

// The knex statement beginning at a `db('<table>')` match: balance parens to the
// end of that call, then keep the chained `.where(...).orderBy(...)` tail. Read
// far enough to see whether the statement carries an explicit projection, which
// is the whole discriminator.
const STATEMENT_SCAN_LIMIT = 8000

// Index just past the balanced `(...)` group starting at `open_index`, or null.
const end_of_call = (source, open_index, limit) => {
  let depth = 0
  for (let index = open_index; index < limit; index++) {
    const character = source[index]
    if (character === '(') depth += 1
    else if (character === ')') {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  return null
}

// The knex statement beginning at a `db('<table>')` match. Consume the `db(...)`
// call, then every chained `.method(...)` after it, each by PAREN BALANCE.
//
// This was first written as a regex for the chained tail, which silently cut the
// statement short: the lookahead that ended it treated a line of `})` as the end
// of the statement, so a chain closing a `.where({ ... })` object before its
// `.select(...)` lost the select entirely. Both simulation projection loaders
// read that way -- each carries an explicit `.select('pid',
// 'projected_points_total')` as its LAST link and was reported as a wholesale
// select. A gate that mis-parses in the direction of MORE findings is the safer
// error, but it is still noise aimed at the reviewer, and the paren walk has no
// such failure mode.
const statement_at = (source, start_index) => {
  const limit = Math.min(source.length, start_index + STATEMENT_SCAN_LIMIT)
  const open_index = source.indexOf('(', start_index)
  if (open_index === -1) return source.slice(start_index, limit)
  let end = end_of_call(source, open_index, limit)
  if (end === null) return source.slice(start_index, limit)
  for (;;) {
    const chained = source.slice(end, limit).match(/^\s*\.[a-zA-Z_0-9]+\(/)
    if (!chained) break
    const next_end = end_of_call(source, end + chained[0].length - 1, limit)
    if (next_end === null) break
    end = next_end
  }
  return source.slice(start_index, end)
}

// An explicit projection is the loud case -- naming the removed column raises
// 42703. But `.select('*')` and `.select('<table>.*')` are WHOLESALE: they
// project every column under its current name, so the old key is lost silently,
// which is exactly this gate's class. Treating any `.select(` as an explicit
// projection missed both wildcard forms, including `db('nfl_plays').select('*')`
// behind the play cache.
// `.first('teams.uid')` projects exactly as `.select` does; a bare `.first()`
// takes one row of everything and is wholesale.
//
// An AGGREGATE (`.max('week as final_week')`, `.min`, `.sum`, `.avg`) returns the
// aggregated value and no row at all, so it can never expose a renamed column to
// a consumer -- even when followed by a bare `.first()`, which is why the bare
// `.first()` carve-out above is not sufficient on its own.
const has_explicit_projection = (statement) => {
  const projections = statement.match(
    /\.(?:select|first|pluck|max|min|sum|avg)\(([\s\S]*?)\)/g
  )
  if (!projections) return false
  return projections.some(
    (projection) => !projection.includes('*') && !/\((\s*)\)$/.test(projection)
  )
}

// A statement that WRITES is not a consumer -- its column references are gate-1
// and 42703 territory, loud either way. `.decrement`/`.increment` are writes that
// read nothing.
const WRITE_METHOD_RE =
  /\.(insert|update|del|delete|truncate|count|onConflict|decrement|increment)\(/

// GATE 2 -- a column removed since `base` must not still be read off a row that
// no longer carries it. Anchored on the affected TABLE; see the header.
const run_gate_2 = ({ tables, base_ref }) => {
  const base_sql = schema_at_ref(base_ref)
  if (base_sql === null) {
    return {
      findings: [],
      skipped: `could not read db/schema.postgres.sql at ${base_ref}`
    }
  }
  const base_tables = parse_schema(base_sql)

  // Per affected table: what left, and what arrived alongside it. The arrivals
  // are the replacement candidates, reported as evidence that a site was (or was
  // not) swept -- never as a filter, since a file can name the new column in one
  // query and still miss it in another.
  const affected = new Map()
  let removed_count = 0
  let unmatchable_count = 0
  for (const [table_name, base_columns] of base_tables) {
    const current_columns = tables.get(table_name)
    if (!current_columns) continue // table dropped or renamed -- out of scope here
    if (is_partition_child(table_name)) continue
    const removed = []
    for (const column of base_columns) {
      if (current_columns.has(column)) continue
      removed_count += 1
      if (column.length < MIN_MATCHABLE_COLUMN_LENGTH) {
        unmatchable_count += 1
        continue
      }
      removed.push(column)
    }
    if (!removed.length) continue
    const added = [...current_columns].filter(
      (column) => !base_columns.has(column)
    )
    affected.set(table_name, { removed, added })
  }
  if (!affected.size) return { findings: [], removed_count, unmatchable_count }

  const all_removed = new Set()
  for (const { removed } of affected.values())
    for (const column of removed) all_removed.add(column)
  const read_sites = collect_read_sites(all_removed)

  const findings = []
  for (const file of walk_files(SERVER_ROOTS, ['.mjs', '.js'])) {
    const source = fs.readFileSync(file, 'utf8')
    const relative_path = path.relative(repo_root, file)
    for (const [table_name, { removed, added }] of affected) {
      const live = removed.filter((column) => read_sites.get(column).length)
      if (!live.length) continue
      const from_re = new RegExp(
        `\\bdb\\(\\s*['"\`]${table_name}['"\`]\\s*\\)`,
        'g'
      )
      let match
      while ((match = from_re.exec(source)) !== null) {
        const statement = statement_at(source, match.index)
        if (has_explicit_projection(statement)) continue
        if (WRITE_METHOD_RE.test(statement)) continue
        const line = source.slice(0, match.index).split('\n').length
        for (const column of live) {
          // Aliased back to the old name -- the row still carries the key.
          if (new RegExp(`as\\s*\\(\\s*['"\`]${column}['"\`]`).test(statement))
            continue
          const sites = read_sites.get(column)
          const same_file = sites.filter((site) => site.file === relative_path)
          // Listed unconditionally. The `same_file.length ? same_file : sites`
          // choice below is a good default for the server surface and hides
          // every SPA site whenever the query file reads the column itself --
          // the common case -- so the one surface with no table anchor was
          // represented to the reviewer by a bare count and nothing else.
          const spa_high_signal = sites.filter(
            (site) =>
              site.surface === 'spa' && HIGH_SIGNAL_SHAPES.has(site.shape)
          )
          findings.push({
            gate: 2,
            column,
            table: table_name,
            file: relative_path,
            line,
            text: source.split('\n')[line - 1].trim().slice(0, 140),
            tier: same_file.length ? 'same_file_read' : 'cross_file_read',
            replacement_candidates: added,
            file_names_replacement: added.some((candidate) =>
              source.includes(candidate)
            ),
            read_site_count: sites.length,
            spa_read_site_count: sites.filter((site) => site.surface === 'spa')
              .length,
            spa_high_signal_sites: spa_high_signal.map(
              (site) => `${site.file}:${site.line} [${site.shape}]`
            ),
            read_sites: (same_file.length ? same_file : sites).map(
              (site) => `${site.surface}:${site.file}:${site.line}`
            )
          })
        }
      }
    }
  }
  return { findings, removed_count, unmatchable_count }
}

// Adjudication is per (table, column), and records the site list that was
// reviewed -- so an already-settled pair does NOT inherit a site that appeared
// afterwards. That is what keeps this per-site rather than a blanket rule.
// A pair may need MORE than one verdict: fixing one consumer of
// `player_gamelogs.pos` does not make that table's other three wholesale selects
// defects, so each entry carries its own site list and a pair can appear more
// than once. Matching is (table, column, file) -- never (table, column) alone.
const load_adjudications = () => {
  if (!fs.existsSync(adjudications_path)) return []
  return JSON.parse(fs.readFileSync(adjudications_path, 'utf8')).adjudications
}

const apply_adjudications = (findings, adjudications) =>
  findings.map((finding) => {
    const entry = adjudications.find(
      (candidate) =>
        candidate.table === finding.table &&
        candidate.column === finding.column &&
        candidate.sites.includes(finding.file)
    )
    return {
      ...finding,
      adjudicated: Boolean(entry),
      verdict: entry ? entry.verdict : null,
      reason: entry ? entry.reason : null
    }
  })

const main = () => {
  const argv = yargs(hideBin(process.argv))
    .option('base', {
      type: 'string',
      default: 'origin/master',
      describe: 'git ref to diff the schema against for gate 2'
    })
    .option('gate', { type: 'number', describe: 'run only gate 1 or gate 2' })
    .option('json', { type: 'boolean', default: false })
    .option('unadjudicated', {
      type: 'boolean',
      default: false,
      describe: 'report only gate 2 findings no adjudication covers'
    })
    .parse()

  if (!fs.existsSync(schema_path)) {
    console.error(`missing schema file: ${schema_path}`)
    process.exit(2)
  }
  const tables = parse_schema(fs.readFileSync(schema_path, 'utf8'))

  // The SPA roots belong to GATE 2 only -- gate 1 resolves table-qualified
  // literals in server code and never opens `app`. Declaring them on a
  // `--gate 1` run, which is how the cluster manifest invokes this gate, would
  // print `scanned app` over a root this run does not read: the exact
  // inversion of the defect the corpus block exists to prevent.
  const corpus_roots =
    argv.gate === 1 ? [...SERVER_ROOTS] : [...SERVER_ROOTS, ...SPA_ROOTS]
  const corpus_counts = count_files_by_root(corpus_roots, ['.mjs', '.js'])
  const corpus = resolve_corpus({
    roots: corpus_roots,
    repo_root,
    counts: corpus_counts
  })

  const gate_1_findings = argv.gate === 2 ? [] : run_gate_1(tables)
  // Gate 2 has an acceptance test and a recorded adjudication-removal control
  // (see the header); these cover gate 1, so they run whenever gate 1 does.
  const gate_1_controls =
    argv.gate === 2 ? [] : run_gate_1_negative_controls(tables)
  const failed_controls = gate_1_controls.filter((control) => !control.passed)
  const gate_2 =
    argv.gate === 1
      ? { findings: [], removed_count: 0, unmatchable_count: 0 }
      : run_gate_2({ tables, base_ref: argv.base })

  const adjudications = load_adjudications()
  gate_2.findings = apply_adjudications(gate_2.findings, adjudications)
  const unadjudicated = gate_2.findings.filter(
    (finding) => !finding.adjudicated
  )
  // Only unadjudicated findings fail. An adjudicated one is a recorded human
  // verdict, so it is reported as such rather than dropped -- a suppression
  // nobody can see is the defect this redesign exists to remove.
  const all = [...gate_1_findings, ...unadjudicated]
  const reported = argv.unadjudicated ? unadjudicated : gate_2.findings

  const control_summary = failed_controls.length
    ? `\n${failed_controls.length} gate-1 negative control(s) did not hold. Until they do, ` +
      'gate 1 cannot tell a clean tree from a scan that has stopped resolving.'
    : ''

  if (argv.json) {
    console.log(
      JSON.stringify(
        {
          tables: tables.size,
          corpus,
          gate_1: gate_1_findings,
          gate_1_controls,
          gate_2
        },
        null,
        2
      )
    )
  } else {
    console.log(`Parsed ${tables.size} tables from db/schema.postgres.sql\n`)

    console.log(format_corpus({ corpus, counts: corpus_counts }))
    console.log('')

    if (gate_1_controls.length) {
      console.log('NEGATIVE CONTROLS -- gate 1')
      for (const control of gate_1_controls) {
        console.log(
          `  [${control.passed ? 'ok' : 'FAIL'}] ${control.result}  ${control.name}`
        )
        if (!control.passed) console.log(`      ${control.detail}`)
      }
      console.log('')
    }

    console.log(`GATE 1 -- table-qualified columns that do not resolve`)
    if (!gate_1_findings.length) console.log('  none\n')
    for (const finding of gate_1_findings) {
      console.log(
        `  ${finding.table}.${finding.column}  ${finding.file}:${finding.line}`
      )
      console.log(`     ${finding.text}`)
    }

    if (argv.gate === 1) {
      console.log(`\nGATE 2 -- not run (--gate 1)`)
      if (all.length)
        console.log(
          `\nGATE FAIL: ${all.length} finding(s) -- repoint before shipping.`
        )
      else if (!failed_controls.length)
        console.log(`\nGATE OK.${verdict_suffix(corpus)}`)
      if (control_summary) console.error(control_summary)
      process.exitCode = all.length || failed_controls.length ? 1 : 0
      return
    }

    console.log(`\nGATE 2 -- consumers of a column removed since ${argv.base}`)
    if (gate_2.skipped) {
      console.log(`  SKIPPED: ${gate_2.skipped}`)
    } else {
      console.log(
        `  ${gate_2.removed_count} column(s) removed since base; ` +
          `${gate_2.unmatchable_count} under ${MIN_MATCHABLE_COLUMN_LENGTH} ` +
          `characters and not matchable as an identifier`
      )
      console.log(
        `  ${gate_2.findings.length} candidate site(s), ` +
          `${unadjudicated.length} unadjudicated\n`
      )
      const tier_order = ['same_file_read', 'cross_file_read']
      const ordered = [...reported].sort(
        (a, b) =>
          tier_order.indexOf(a.tier) - tier_order.indexOf(b.tier) ||
          a.file.localeCompare(b.file)
      )
      for (const finding of ordered) {
        const status = finding.adjudicated
          ? `ADJUDICATED ${finding.verdict}`
          : 'UNADJUDICATED'
        console.log(
          `  [${finding.tier}] ${finding.table}.${finding.column} ` +
            `${finding.file}:${finding.line}  -- ${status}`
        )
        console.log(`     ${finding.text}`)
        console.log(
          `     old name read at ${finding.read_site_count} site(s)` +
            `${finding.spa_read_site_count ? ` (${finding.spa_read_site_count} in the SPA)` : ''}: ` +
            `${finding.read_sites.slice(0, 8).join(', ') || 'nowhere'}`
        )
        if (finding.spa_high_signal_sites.length)
          console.log(
            `     SPA row reads (accessor/field-argument): ` +
              `${finding.spa_high_signal_sites.join(', ')}`
          )
        console.log(
          `     replacement candidates: ` +
            `${finding.replacement_candidates.join(', ') || 'none'}` +
            `${finding.file_names_replacement ? ' (file names one)' : ''}`
        )
        if (finding.adjudicated) console.log(`     reason: ${finding.reason}`)
      }
      if (!reported.length) console.log('  none\n')
    }

    if (all.length)
      console.log(
        `\nGATE FAIL: ${all.length} finding(s) -- repoint or adjudicate before shipping.`
      )
    else if (!failed_controls.length)
      console.log(`\nGATE OK.${verdict_suffix(corpus)}`)
    if (control_summary) console.error(control_summary)
  }

  // `process.exit` here TRUNCATES stdout at the pipe buffer (64KB) -- the JSON
  // report is well past that, so an exit call silently produced unparseable
  // output. Set the code and let the process drain.
  process.exitCode = all.length || failed_controls.length ? 1 : 0
}

main()
