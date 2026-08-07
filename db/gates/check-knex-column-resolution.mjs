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
// negative control, or on coverage falling under its floor. Exit 2 on a missing
// schema file.
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
// fails the run, per the runner's rule. There are five, and two of them run in
// the OVER-EAGER direction, because half of what this gate does is decide that a
// token is NOT a column reference and an over-eager filter fails in the direction
// that looks like success. See run_negative_controls.
//
// BLIND SPOTS -- a floor, not a proof.
//   - A `db.raw(...)` body is not parsed. Raw SQL is arbitrary text and a
//     half-parse invents findings; those statements are counted as UNCHECKED and
//     printed in the coverage block rather than passed over silently.
//   - An unqualified reference inside a MULTI-table statement is ambiguous and
//     is not resolved. Counted as UNCHECKED.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')

const adjudications_path = path.join(
  __dirname,
  'knex-column-resolution-adjudications.json'
)

const SERVER_ROOTS = ['api', 'libs-server', 'libs-shared', 'scripts', 'jobs']

// The identifiers that OPEN a knex statement. `db` and `trx` are what this repo
// writes (1405 and 76 call sites); `knex` is accepted because it is the library's
// own convention and would otherwise be a silent hole if someone used it.
const BUILDER_IDENTIFIERS = ['db', 'trx', 'knex']

// Every method that BINDS a table name to a scope. `.from` is here rather than
// only at the head because a statement may open on a builder and take its
// relation later.
const TABLE_BINDING_METHODS = [
  'from',
  'into',
  'join',
  'leftJoin',
  'leftOuterJoin',
  'rightJoin',
  'rightOuterJoin',
  'innerJoin',
  'fullOuterJoin',
  'crossJoin'
]

// A statement long enough to contain its own projection and predicates. The same
// bound `check-renamed-column-consumers` uses, for the same reason.
const STATEMENT_SCAN_LIMIT = 8000

// Coverage floors. A resolution change that walks zero files, or stops binding
// aliases, would otherwise pass vacuously forever -- which is exactly how the
// physical-season-columns spec shipped enforcing nothing (operation-log 005).
// These are asserted, not printed.
const MIN_FILES_SCANNED = 200
const MIN_STATEMENTS_PARSED = 800
const MIN_REFERENCES_RESOLVED = 1500

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

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
      if (!line || line.startsWith('CONSTRAINT') || line.startsWith('PRIMARY'))
        continue
      const column_match = line.match(/^"?([a-z_0-9]+)"?\s+/i)
      if (column_match) columns.add(column_match[1])
    }
    tables.set(table_name, columns)
  }
  return tables
}

// A partitioned child repeats every column of its parent. Binding to one is
// correct but reporting under its name is noise; resolve to the parent.
const partition_parent = (name, tables) => {
  const stripped = name
    .replace(/_year_\d{4}$/, '')
    .replace(/_y\d{4}$/, '')
    .replace(/_default$/, '')
  return stripped !== name && tables.has(stripped) ? stripped : name
}

// ---------------------------------------------------------------------------
// corpus
// ---------------------------------------------------------------------------

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
      else if (extensions.some((ext) => entry.name.endsWith(ext)))
        files.push(full_path)
    }
  }
  for (const root of roots) visit(path.join(repo_root, root))
  return files.sort()
}

// ---------------------------------------------------------------------------
// statement extraction
// ---------------------------------------------------------------------------

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

// Consume the opening call, then every chained `.method(...)` by PAREN BALANCE.
// A regex tail terminates early on a line of `})` and silently truncates the
// statement -- the failure `check-renamed-column-consumers` records, where a
// trailing `.select(...)` was lost and wholesale-select findings were invented.
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

const statement_opener_re = new RegExp(
  `\\b(?:${BUILDER_IDENTIFIERS.join('|')})\\(\\s*['"\`][a-z_0-9]+(?:\\s+as\\s+[a-z_0-9]+)?['"\`]\\s*\\)`,
  'g'
)

const collect_statements = (source) => {
  const statements = []
  statement_opener_re.lastIndex = 0
  let match
  while ((match = statement_opener_re.exec(source)) !== null) {
    const text = statement_at(source, match.index)
    statements.push({
      text,
      offset: match.index,
      line: source.slice(0, match.index).split('\n').length
    })
    // Do not re-enter a statement we have already consumed: a nested
    // `db('x')` inside a subquery callback belongs to its parent's text and
    // would otherwise be parsed twice, double-counting every reference.
    statement_opener_re.lastIndex = match.index + text.length
  }
  return statements
}

// ---------------------------------------------------------------------------
// alias environment
// ---------------------------------------------------------------------------

const TABLE_REFERENCE_RE = /['"`]([a-z_0-9]+)(?:\s+as\s+([a-z_0-9]+))?['"`]/i

// Prefixes that are bound to something other than a physical table and so
// legitimately carry columns the schema does not have.
const collect_shadowed_prefixes = (statement) => {
  const shadowed = new Set()
  const alias_re = /\.as\(\s*['"`]([a-z_][a-z_0-9]*)['"`]\s*\)/g
  let match
  while ((match = alias_re.exec(statement)) !== null) shadowed.add(match[1])
  const with_re = /\.with(?:Recursive)?\(\s*['"`]([a-z_][a-z_0-9]*)['"`]/g
  while ((match = with_re.exec(statement)) !== null) shadowed.add(match[1])
  return shadowed
}

/**
 * The alias environment a statement declares for itself.
 *
 * Returns { bindings, tables_in_scope, shadowed }. `bindings` maps every prefix
 * a column reference may legally use to its physical table; `tables_in_scope`
 * is the distinct table set, whose SIZE is what decides whether an unqualified
 * reference is resolvable.
 *
 * Aliasing in SQL REPLACES the table name -- `rosters_players as r` makes
 * `rosters_players.x` invalid -- so an alias binds only the alias. Getting that
 * backwards would let a stale table-qualified reference resolve through a
 * statement that renamed it away.
 */
const build_alias_environment = (statement, tables) => {
  const bindings = new Map()
  const tables_in_scope = new Set()
  const shadowed = collect_shadowed_prefixes(statement)

  const bind = (raw_table, alias) => {
    const table = partition_parent(raw_table, tables)
    if (!tables.has(table)) return false
    tables_in_scope.add(table)
    bindings.set(alias || raw_table, table)
    return true
  }

  const head = statement.match(
    new RegExp(
      `^(?:${BUILDER_IDENTIFIERS.join('|')})\\(\\s*['"\`]([a-z_0-9]+)(?:\\s+as\\s+([a-z_0-9]+))?['"\`]`,
      'i'
    )
  )
  if (head) bind(head[1], head[2])

  const binder_re = new RegExp(
    `\\.(?:${TABLE_BINDING_METHODS.join('|')})\\(`,
    'g'
  )
  let match
  while ((match = binder_re.exec(statement)) !== null) {
    const rest = statement.slice(match.index + match[0].length)
    const reference = rest.match(
      new RegExp(`^\\s*${TABLE_REFERENCE_RE.source}`)
    )
    if (!reference) continue
    bind(reference[1], reference[2])
  }

  for (const prefix of shadowed) bindings.delete(prefix)
  return { bindings, tables_in_scope, shadowed }
}

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

    const report = (column, table, shape, offset) => {
      const line = line_of(statement.offset + offset)
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
    if (tables_in_scope.size !== 1) {
      stats.unchecked_ambiguous += keys.length
      continue
    }
    const [only_table] = tables_in_scope
    for (const key of keys) {
      stats.resolved += 1
      if (tables.get(only_table).has(key.column)) continue
      report(key.column, only_table, 'unqualified', key.offset)
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
    unchecked_ambiguous: 0
  }
  const findings = []
  for (const file of walk_files(SERVER_ROOTS, ['.mjs', '.js'])) {
    const relative_path = path.relative(repo_root, file)
    const source =
      source_override && source_override.file === relative_path
        ? source_override.source
        : fs.readFileSync(file, 'utf8')
    stats.files += 1
    findings.push(...scan_source({ source, relative_path, tables, stats }))
  }
  return { findings, stats }
}

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

// Five controls, run on EVERY invocation. Two of them assert the gate stays
// SILENT on a mutation, because half of what this gate does is decide a token is
// NOT a column reference -- and an over-eager filter fails in the direction that
// looks like success. `check-documentation-schema-drift` shipped exactly that:
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
    for (const file of walk_files(SERVER_ROOTS, ['.mjs', '.js'])) {
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

  // 5. STALE ADJUDICATION. A suppression that no longer suppresses anything must
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

  const coverage_failures = []
  if (stats.files < MIN_FILES_SCANNED)
    coverage_failures.push(
      `scanned ${stats.files} files, floor is ${MIN_FILES_SCANNED}`
    )
  if (stats.statements < MIN_STATEMENTS_PARSED)
    coverage_failures.push(
      `parsed ${stats.statements} statements, floor is ${MIN_STATEMENTS_PARSED}`
    )
  if (stats.resolved < MIN_REFERENCES_RESOLVED)
    coverage_failures.push(
      `resolved ${stats.resolved} references, floor is ${MIN_REFERENCES_RESOLVED}`
    )

  if (options.json) {
    console.log(
      JSON.stringify(
        { stats, findings: applied, stale, controls, coverage_failures },
        null,
        2
      )
    )
  } else {
    console.log(`Parsed ${tables.size} tables from db/schema.postgres.sql\n`)

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
        `${stats.unchecked_no_binding} statement(s) binding no known table`
    )
    console.log(
      `  ${stats.statements_with_raw} statement(s) contain a .raw() body, which is not parsed\n`
    )

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
        : `\nGATE OK.`
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
