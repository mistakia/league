// Third rename gate, anchored on the ALIAS-BACK SITE.
//
// WHY A THIRD ANCHOR. A rename that keeps the in-memory and wire name unchanged
// must alias the new physical column back to the old name at EVERY producer, and
// nothing enforces it. `72346e579` renamed `transactions.value` to
// `transactions.player_salary`; `libs-server/get-roster.mjs` aliased it back and
// `libs-server/get-league-rosters-from-database.mjs` did not, so every player
// reaching the `Roster` constructor from the second producer carried
// `value: undefined`, `availableCap` summed to `NaN`, and `NaN || 0` collapsed it
// to `0` -- every team showed the raw $200 cap as its salary space.
//
// Neither existing gate can see that class.
//
//   check-renamed-column-consumers GATE 2 anchors its candidate set on
//   `db('<table>')` FROM-target literals, so a table reached through `.join` or
//   `.leftJoin` is structurally invisible. `get-league-rosters-from-database.mjs`
//   reaches `transactions` through `.leftJoin` off `db('rosters_players')`, so it
//   never appeared in that gate's candidate set at all -- verified: at
//   `--base 62ca45544` gate 2 produces 36 sites for `transactions.value` and that
//   file is not among them.
//
//   A WORD-anchored grep works only for a distinctive token (`rid`, `dwn`,
//   `qtr`). Renames concentrate on generic names (`value`, `type`, `year`,
//   `total`), which is precisely where a word anchor is unusable.
//
// The alias site needs NEITHER. It is equally findable for `value` and for `rid`,
// and it needs no FROM-target literal because the alias literal names its own
// table (or sits inside a statement that does).
//
// THE DISCRIMINATOR is that the alias TARGET name is a column the table actually
// LOST in the schema diff. That single condition separates a rename alias-back
// from ordinary join disambiguation (`waivers.uid as wid`, `leagues.name as
// league_name`), which no other filter can do. It takes the scan from 196 alias
// sites to a handful.
//
// TWO ANCHOR FORMS, NOT ONE. A qualified literal (`'<table>.<new> as <old>'`)
// resolves its own table. An unqualified literal (`'<new> as <old>'`) resolves
// the table from the enclosing `db('<table>')` statement. Omitting the second
// form is not an abstract coverage gap -- `libs-server/get-roster.mjs:48` writes
// `.select('*', 'player_position as pos', 'roster_id as rid')` with no table
// qualifier, so a scan anchored only on the qualified form misses one of the two
// producers this gate exists to find.
//
// THREE FINDING CLASSES, each with its own verdict question:
//
//   SPLIT PRODUCERS  the column is aliased back at one site and projected BARE at
//                    another. Ask: does the bare producer feed the same consumer?
//                    This is the `transactions.value` shape, and it is the one
//                    that has already caused a production defect.
//
//   ORPHANED ALIAS   the NEW column name is ALSO read as an in-memory key
//                    somewhere in the tree. Two vocabularies for one column means
//                    some producer/consumer pair disagrees. This is the
//                    `practice.m`/`monday_practice_status` shape, where the read
//                    boundary aliased to a name the consumer had stopped using
//                    and the practice path was dead from the commit that did it.
//
//   UNIFORM          every producer aliases back and the consumer reads the old
//                    name. Correct today, still reported -- it is a standing
//                    hazard, since the next producer added is one nobody will
//                    remember to alias.
//
// TWO REFINEMENTS THE PROTOTYPE PROVED NECESSARY.
//
//   PROJECTION CONTEXT ONLY. `libs-server/get-players.mjs:49,55,71,77` name
//   `rosters_players.roster_id`/`.player_position` inside `groupBy(...)`, not a
//   projection. Counting those produced four false SPLIT PRODUCERS findings. Bare
//   references are restricted to `select`/`first`/`pluck`/`returning` argument
//   positions.
//
//   REGISTRY PATHS EXCLUDED, as a real filter carrying its own weight. Column
//   definitions and data-view paths declare WIRE IDS; a zero-read alias there is
//   expected rather than suspicious. The original design asserted this exclusion
//   was belt-and-braces because a registry alias name is never a former column.
//   Asserted rather than assumed, that fails:
//   `libs-server/data-views-column-definitions/player-adp-column-definitions.mjs:107`
//   aliases to `adp`, which `player_adp_index` did lose, so it passes the
//   lost-column filter and the path exclusion is the only thing removing it.
//
// WHAT IS DELIBERATELY OUT: THE PRODUCER-ANCHORED SWEEP. The `player_salary`
// migration found its ten consumer sites with a fourth anchor -- sweep
// `<identifier>.<field>` where the identifier is an instance of the class whose
// field moved, plus enumerate every consumer of that class's collection getters
// (`Roster` `.all`/`.active`/`.players`/`.get`). It anchors on the PRODUCER, so it
// works for a generic word and needs neither a greppable token nor a spec. It is
// the anchor that actually worked, and it does not belong in gate code: it cannot
// self-derive its input. This gate derives its whole list from the schema diff;
// that one needs a known moved field and a known class, so encoding it would mean
// hand-maintaining a class-to-field registry that drifts silently. It lives in
// league CLAUDE.md as a required rename-cluster step instead.
//
// SHOULD THE GATE REFUSE A RENAME BECAUSE THE NAME IS GENERIC? No. Renames
// concentrate on generic names, so such a rule would fire on nearly every real
// migration and get bypassed. The property is encoded in the ANCHOR instead. Each
// finding carries an AUDITABILITY NOTE -- old name length, occurrence count across
// the tree, whether the old name survives on another table -- as reviewer context,
// never as a pass/fail condition.
//
// Usage:
//   node db/adhoc/check-rename-alias-residue.mjs --base <pre-cluster-ref>
//   node db/adhoc/check-rename-alias-residue.mjs --base <ref> --unadjudicated
//   node db/adhoc/check-rename-alias-residue.mjs --base <ref> --json
//
// Exit 0 clean, 1 on findings no adjudication covers, 2 when the gate could not
// run. AN UNRESOLVABLE BASE REF IS EXIT 2, NOT A PASS.
// `check-renamed-column-consumers.mjs` exits 0 with `GATE OK` on a base ref git
// cannot resolve, printing one `SKIPPED` line in the middle of its output -- so a
// typo, or a ref that has since been garbage-collected, reads as a passed gate
// from every angle except that line. That shape is not reproduced here.
//
// ACCEPTANCE TEST -- a gate is worthless unless it goes red at the pre-fix
// revision, so this one has a named one and the full cycle was VERIFIED on
// 2026-08-06 rather than asserted. In a worktree at `782b78907^`:
//
//   node db/adhoc/check-rename-alias-residue.mjs --base 62ca45544
//
// reports `transactions.player_salary as value` at `libs-server/get-roster.mjs:52`
// as SPLIT PRODUCERS and exits 1, naming `libs-server/get-league-rosters-from-database.mjs:51`
// among its bare producers -- the site check-renamed-column-consumers gate 2 is
// structurally unable to reach, and the one whose absence caused the defect. It
// also reports the `practice.*` ORPHANED ALIAS cluster at
// `libs-server/verify-reserve-status.mjs`, the second live defect from the same
// commit, which gate 2 could not see either (those old names are all under its
// three-character matchability floor). At current HEAD it reports nothing for the
// `transactions` pair. Same gate, same base; only the fix varies.
//
// The UNQUALIFIED anchor is proven separately, at HEAD rather than at that
// revision: `libs-server/get-roster.mjs:48` writes `.select('*', 'player_position
// as pos', 'roster_id as rid')` and both sites are reported. That form did not
// exist at `782b78907^` -- the aliases there are qualified -- so the two halves
// of the anchor are demonstrated on different revisions.
//
// NEGATIVE CONTROL, MANDATORY AND ALWAYS-ON. Per the standing rule in league
// CLAUDE.md, a control that STAYS GREEN fails the run. The file reader is INJECTED
// as a parameter rather than monkeypatched: an ESM namespace object is frozen, so
// a patched member silently does nothing and the control then reports STAYED GREEN
// over a gate that is working perfectly -- a control failing OPEN, the one
// direction a control must never fail.
//
// BLIND SPOTS -- this is a FLOOR, not a proof.
//   - An alias built by string concatenation or held in a constant names no
//     literal and is invisible.
//   - An unqualified alias whose statement's FROM target is not a `db('<table>')`
//     literal cannot be resolved to a table. Same hazard gate 2 records.
//   - A rename with no schema change (a pure API-shape rename) has no diff to
//     derive lost columns from.
//   - The ORPHANED ALIAS test is tree-wide, not per-consumer: it cannot prove the
//     aliased row reaches the code reading the new name. It reports the pairing
//     and asks a human, exactly as gate 2 does for cross-file reads.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')

const SERVER_ROOTS = ['api', 'libs-server', 'libs-shared', 'scripts', 'jobs']
const SPA_ROOTS = ['app']

// Registry paths declare WIRE IDS rather than reading rows, so an alias there
// with no matching read is expected. This is a real filter, not belt-and-braces:
// player-adp-column-definitions.mjs:107 aliases to `adp`, which
// `player_adp_index` did lose, so it passes the lost-column filter and only the
// path exclusion removes it.
const REGISTRY_PATH_MARKERS = ['column-definitions', 'data-view']

const adjudications_path = path.join(
  __dirname,
  'rename-alias-residue-adjudications.json'
)

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

// A partitioned table repeats every column across its children, which would list
// 30 table names for one lost column. Report the parent only.
const is_partition_child = (name) =>
  /_year_\d{4}$/.test(name) ||
  /_y\d{4}$/.test(name) ||
  name.endsWith('_default')

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

// Per table, the columns present at `base` and absent now. The whole
// discriminator is built from this.
export const derive_lost_columns = ({ base_tables, current_tables }) => {
  const lost = new Map()
  for (const [table_name, base_columns] of base_tables) {
    if (is_partition_child(table_name)) continue
    const current_columns = current_tables.get(table_name)
    if (!current_columns) continue // table dropped or renamed -- out of scope
    const missing = new Set()
    for (const column of base_columns) {
      if (!current_columns.has(column)) missing.add(column)
    }
    if (missing.size) lost.set(table_name, missing)
  }
  return lost
}

// ---------------------------------------------------------------------------
// file walking
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
  return files
}

const is_registry_path = (relative_path) =>
  REGISTRY_PATH_MARKERS.some((marker) => relative_path.includes(marker))

// ---------------------------------------------------------------------------
// statement and projection spans
// ---------------------------------------------------------------------------

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

const STATEMENT_SCAN_LIMIT = 8000

// A COMMENT between two chained calls must not end the statement. This is not a
// nicety: `libs-server/get-roster.mjs` carries a six-line comment between its
// `.where(...)` and the `.select('*', 'player_position as pos', 'roster_id as
// rid')` that follows, so a gap pattern of `\s*` alone stops the walk before the
// projection and the unqualified alias resolves to NO table -- a silent miss on
// one of the two producers this gate exists to find. The comment explains the
// alias, which is the shape a rename alias-back naturally takes.
const CHAINED_CALL_RE = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*\.[a-zA-Z_0-9]+\(/

// The knex statement beginning at a `db('<table>')` match: consume the `db(...)`
// call, then every chained `.method(...)` after it, each by PAREN BALANCE. A
// regex for the chained tail silently cuts the statement short -- a chain closing
// a `.where({ ... })` object before its `.select(...)` loses the select entirely.
// Same walk check-renamed-column-consumers performs, and for the same reason.
const statement_span_at = (source, start_index) => {
  const limit = Math.min(source.length, start_index + STATEMENT_SCAN_LIMIT)
  const open_index = source.indexOf('(', start_index)
  if (open_index === -1) return { start: start_index, end: limit }
  let end = end_of_call(source, open_index, limit)
  if (end === null) return { start: start_index, end: limit }
  for (;;) {
    const chained = source.slice(end, limit).match(CHAINED_CALL_RE)
    if (!chained) break
    const next_end = end_of_call(source, end + chained[0].length - 1, limit)
    if (next_end === null) break
    end = next_end
  }
  return { start: start_index, end }
}

// Every `db('<table>')` statement in a file, innermost-first so a nested
// subquery's table wins over the outer one.
const collect_statement_spans = (source) => {
  const spans = []
  const from_re = /\bdb\(\s*['"`]([a-z_][a-z_0-9]*)['"`]\s*\)/g
  let match
  while ((match = from_re.exec(source)) !== null) {
    const { start, end } = statement_span_at(source, match.index)
    spans.push({ table: match[1], start, end })
  }
  // Innermost wins: a shorter span nested inside a longer one is the closer FROM.
  return spans.sort((a, b) => a.end - a.start - (b.end - b.start))
}

const table_at = (spans, index) => {
  const span = spans.find((entry) => index >= entry.start && index < entry.end)
  return span ? span.table : null
}

// A bare `rosters_players.roster_id` inside `groupBy(...)` is not a producer --
// counting those produced four false SPLIT PRODUCERS findings. Only
// select/first/pluck/returning argument positions project a row.
const PROJECTION_METHOD_RE = /\.(?:select|first|pluck|returning)\(/g

const collect_projection_spans = (source) => {
  const spans = []
  PROJECTION_METHOD_RE.lastIndex = 0
  let match
  while ((match = PROJECTION_METHOD_RE.exec(source)) !== null) {
    const open_index = match.index + match[0].length - 1
    const end = end_of_call(source, open_index, source.length)
    if (end !== null) spans.push({ start: open_index, end })
  }
  return spans
}

const in_projection = (spans, index) =>
  spans.some((span) => index >= span.start && index < span.end)

// ---------------------------------------------------------------------------
// alias and bare-reference extraction
// ---------------------------------------------------------------------------

const QUALIFIED_ALIAS_RE =
  /['"`]([a-z_][a-z_0-9]*)\.([a-z_][a-z_0-9]*)\s+as\s+([a-z_][a-z_0-9]*)['"`]/gi
const UNQUALIFIED_ALIAS_RE =
  /['"`]([a-z_][a-z_0-9]*)\s+as\s+([a-z_][a-z_0-9]*)['"`]/gi
const QUALIFIED_BARE_RE = /['"`]([a-z_][a-z_0-9]*)\.([a-z_][a-z_0-9]*)['"`]/g

const line_of = (source, index) => source.slice(0, index).split('\n').length

// Every alias literal in one file, both anchor forms, with the table resolved.
// `table` is null for an unqualified alias whose statement has no `db('<table>')`
// literal to resolve against -- a declared blind spot, counted rather than
// silently dropped.
export const collect_alias_sites = ({ relative_path, source }) => {
  const statement_spans = collect_statement_spans(source)
  const sites = []
  const seen = new Set()

  QUALIFIED_ALIAS_RE.lastIndex = 0
  let match
  while ((match = QUALIFIED_ALIAS_RE.exec(source)) !== null) {
    const [, table, new_column, old_column] = match
    seen.add(match.index)
    sites.push({
      anchor: 'qualified',
      table,
      new_column,
      old_column,
      file: relative_path,
      line: line_of(source, match.index),
      index: match.index
    })
  }

  UNQUALIFIED_ALIAS_RE.lastIndex = 0
  while ((match = UNQUALIFIED_ALIAS_RE.exec(source)) !== null) {
    // The qualified form matches this regex too (its literal opens with the
    // table name); skip anything already taken by the qualified pass.
    if (seen.has(match.index)) continue
    if (match[0].includes('.')) continue
    const [, new_column, old_column] = match
    sites.push({
      anchor: 'unqualified',
      table: table_at(statement_spans, match.index),
      new_column,
      old_column,
      file: relative_path,
      line: line_of(source, match.index),
      index: match.index
    })
  }

  return sites
}

// Bare `'<table>.<column>'` projections -- the other half of SPLIT PRODUCERS.
// Restricted to projection context; an alias literal is not a bare reference.
const collect_bare_projections = ({ relative_path, source }) => {
  const projection_spans = collect_projection_spans(source)
  const alias_indexes = new Set()
  QUALIFIED_ALIAS_RE.lastIndex = 0
  let alias_match
  while ((alias_match = QUALIFIED_ALIAS_RE.exec(source)) !== null)
    alias_indexes.add(alias_match.index)

  const sites = []
  QUALIFIED_BARE_RE.lastIndex = 0
  let match
  while ((match = QUALIFIED_BARE_RE.exec(source)) !== null) {
    if (alias_indexes.has(match.index)) continue
    if (!in_projection(projection_spans, match.index)) continue
    sites.push({
      table: match[1],
      column: match[2],
      file: relative_path,
      line: line_of(source, match.index)
    })
  }
  return sites
}

// ---------------------------------------------------------------------------
// read shapes
// ---------------------------------------------------------------------------

// The four shapes a stale or competing in-memory key actually takes, each one
// PRODUCTION-PROVEN rather than imagined. The `player_salary` migration found ten
// consumer sites, six of which survived a green 3304-test suite, and its greps
// missed: `get('value')` not matching `get('value', 0)`; `value:` not matching the
// object shorthand `value,`; and one caller enumeration finding 2 of 9. A matcher
// that reports clean over live breakage is the failure mode this gate exists to
// prevent, so each shape carries a fixture in the negative control.
export const READ_SHAPES = [
  [
    'accessor',
    (name) => new RegExp(`\\.get(?:In)?\\(\\s*(?:\\[\\s*)?['"\`]${name}['"\`]`)
  ],
  [
    'accessor_with_default',
    (name) => new RegExp(`\\.get(?:In)?\\(\\s*['"\`]${name}['"\`]\\s*,`)
  ],
  ['object_property', (name) => new RegExp(`\\b${name}\\s*:`)],
  ['object_shorthand', (name) => new RegExp(`[,{]\\s*${name}\\s*[,}]`)],
  ['destructure', (name) => new RegExp(`\\{[^{}]*\\b${name}\\b[^{}]*\\}\\s*=`)]
]

const is_comment = (line) => {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*')
}

// Every place a name is read as an in-memory key, tree-wide. Feeds the ORPHANED
// ALIAS class: a NEW column name also read as a key means two vocabularies for
// one column, so some producer/consumer pair disagrees.
const collect_key_reads = ({ names, files, read_file }) => {
  const reads = new Map()
  for (const name of names) reads.set(name, [])
  const patterns = new Map(
    [...names].map((name) => [
      name,
      READ_SHAPES.map(([shape, build]) => [shape, build(name)])
    ])
  )
  for (const file of files) {
    const relative_path = path.relative(repo_root, file)
    const lines = read_file(file).split('\n')
    lines.forEach((line, index) => {
      if (is_comment(line)) return
      for (const [name, shapes] of patterns) {
        const matched = shapes.find(([, pattern]) => pattern.test(line))
        if (!matched) continue
        reads.get(name).push({
          shape: matched[0],
          file: relative_path,
          line: index + 1
        })
      }
    })
  }
  return reads
}

// ---------------------------------------------------------------------------
// the scan
// ---------------------------------------------------------------------------

// `read_file` is INJECTED rather than monkeypatched. An ESM namespace object is
// frozen, so a control that patches `fs.readFileSync` silently does nothing and
// then reports STAYED GREEN over a working gate.
export const run_scan = ({
  lost_columns,
  current_tables,
  producer_files,
  read_files = producer_files,
  read_file = (file) => fs.readFileSync(file, 'utf8')
}) => {
  const alias_sites = []
  const bare_projections = []
  let total_alias_literals = 0
  let qualified_literals = 0
  let unqualified_literals = 0
  let unresolvable_unqualified = 0

  for (const file of producer_files) {
    const relative_path = path.relative(repo_root, file)
    const source = read_file(file)
    if (!source.includes(' as ')) {
      // Cheap skip; a file with no alias literal can still hold bare projections.
      bare_projections.push(
        ...collect_bare_projections({ relative_path, source })
      )
      continue
    }
    const sites = collect_alias_sites({ relative_path, source })
    total_alias_literals += sites.length
    for (const site of sites) {
      if (site.anchor === 'qualified') qualified_literals += 1
      else unqualified_literals += 1
      if (!site.table) {
        unresolvable_unqualified += 1
        continue
      }
      alias_sites.push(site)
    }
    bare_projections.push(
      ...collect_bare_projections({ relative_path, source })
    )
  }

  // THE DISCRIMINATOR: the alias TARGET is a column the table actually LOST.
  const residue = alias_sites.filter((site) => {
    const lost = lost_columns.get(site.table)
    if (!lost || !lost.has(site.old_column)) return false
    const current = current_tables.get(site.table)
    if (!current || !current.has(site.new_column)) return false
    return !is_registry_path(site.file)
  })

  if (!residue.length) {
    return {
      findings: [],
      total_alias_literals,
      qualified_literals,
      unqualified_literals,
      unresolvable_unqualified
    }
  }

  const new_names = new Set(residue.map((site) => site.new_column))
  const key_reads = collect_key_reads({
    names: new_names,
    files: read_files,
    read_file
  })

  // A bare producer of the same (table, new column) that aliases nothing.
  const bare_by_pair = new Map()
  for (const site of bare_projections) {
    const key = `${site.table}.${site.column}`
    if (!bare_by_pair.has(key)) bare_by_pair.set(key, [])
    bare_by_pair.get(key).push(site)
  }

  // Auditability note context: does the old name survive on ANOTHER table?
  const surviving_tables = (old_column) =>
    [...current_tables]
      .filter(([, columns]) => columns.has(old_column))
      .map(([table]) => table)

  const findings = residue.map((site) => {
    const pair_key = `${site.table}.${site.new_column}`
    const bare_producers = bare_by_pair.get(pair_key) || []
    const reads = key_reads.get(site.new_column) || []

    const finding_class = bare_producers.length
      ? 'SPLIT PRODUCERS'
      : reads.length
        ? 'ORPHANED ALIAS'
        : 'UNIFORM'

    const survives_on = surviving_tables(site.old_column)

    return {
      finding_class,
      anchor: site.anchor,
      table: site.table,
      column: site.old_column,
      new_column: site.new_column,
      file: site.file,
      line: site.line,
      bare_producers: bare_producers.map(
        (producer) => `${producer.file}:${producer.line}`
      ),
      new_name_key_reads: reads
        .slice(0, 8)
        .map((read) => `${read.file}:${read.line} [${read.shape}]`),
      new_name_key_read_count: reads.length,
      auditability: {
        old_name_length: site.old_column.length,
        old_name_survives_on: survives_on,
        alias_site_count: residue.filter(
          (peer) =>
            peer.table === site.table && peer.old_column === site.old_column
        ).length
      }
    }
  })

  return {
    findings,
    total_alias_literals,
    qualified_literals,
    unqualified_literals,
    unresolvable_unqualified
  }
}

// ---------------------------------------------------------------------------
// adjudications
// ---------------------------------------------------------------------------

// Keyed on (table, column, file) with a REQUIRED reason -- never on a column name
// alone. A name-keyed entry here would be the stoplist that hid
// `scoring_format_player_projection_points.total` from check-renamed-column-consumers,
// which returned 129 findings with not one of them `total` over a rename that
// wiped a year of projection values.
//
// An entry that no longer suppresses anything is itself a FINDING, so a repaired
// site forces its entry out rather than leaving a standing exemption for the name.
const load_adjudications = () => {
  if (!fs.existsSync(adjudications_path)) return []
  const parsed = JSON.parse(fs.readFileSync(adjudications_path, 'utf8'))
  return parsed.adjudications.map((entry) => ({ ...entry, used: 0 }))
}

const apply_adjudications = (findings, adjudications) =>
  findings.map((finding) => {
    const entry = adjudications.find(
      (candidate) =>
        candidate.table === finding.table &&
        candidate.column === finding.column &&
        candidate.file === finding.file
    )
    if (entry) entry.used += 1
    return {
      ...finding,
      adjudicated: Boolean(entry),
      verdict: entry ? entry.verdict : null,
      reason: entry ? entry.reason : null
    }
  })

const stale_adjudications = (adjudications) =>
  adjudications
    .filter((entry) => entry.used === 0)
    .map((entry) => ({
      finding_class: 'STALE ADJUDICATION',
      table: entry.table,
      column: entry.column,
      new_column: entry.new_column || '',
      file: entry.file,
      line: 0,
      anchor: 'adjudication',
      bare_producers: [],
      new_name_key_reads: [],
      new_name_key_read_count: 0,
      auditability: {
        old_name_length: (entry.column || '').length,
        old_name_survives_on: [],
        alias_site_count: 0
      },
      adjudicated: false,
      verdict: null,
      reason: `adjudication for ${entry.table}.${entry.column} at ${entry.file} suppresses nothing -- the site is gone, so the entry must go too`
    }))

// ---------------------------------------------------------------------------
// negative control
// ---------------------------------------------------------------------------

const SYNTHETIC_ROOT = path.join(repo_root, '__negative_control__')
const synthetic_path = (name) => path.join(SYNTHETIC_ROOT, name)

const CONTROL_ALIASED_PRODUCER = `
import db from '#db'
export const get_widgets = () =>
  db('widgets').select('widgets.widget_salary as salary', 'widgets.uid')
`

const CONTROL_UNQUALIFIED_PRODUCER = `
import db from '#db'
export const get_more_widgets = () =>
  db('widgets').select('*', 'widget_salary as salary')
`

// The comment between the chained calls is the point. A gap pattern of `\\s*`
// alone stops the statement walk here, the unqualified alias then resolves to no
// table, and the site is silently missed -- which is what happened to
// get-roster.mjs:48 on the first run of this gate.
const CONTROL_COMMENTED_CHAIN_PRODUCER = `
import db from '#db'
export const get_commented_widgets = () =>
  db('widgets')
    .where({ uid: 1 })
    // the in-memory vocabulary is \`salary\`, so translate at this boundary
    .select('*', 'widget_salary as salary')
`

const CONTROL_BARE_PRODUCER = `
import db from '#db'
export const get_bare_widgets = () =>
  db('widgets').select('widgets.widget_salary', 'widgets.uid')
`

// Two mutations, per the design, plus the denominator cases that keep them from
// going vacuous. A case that stops failing fails the whole run.
const run_negative_control = ({ current_tables }) => {
  const cases = []

  const control_lost = new Map([['widgets', new Set(['salary'])]])
  const control_current = new Map([
    ['widgets', new Set(['widget_salary', 'uid'])]
  ])

  const control_reader = (sources) => (file) => sources[file] ?? ''

  // 1. A synthetic alias-back for a known lost column is REPORTED.
  {
    const files = [synthetic_path('aliased.mjs'), synthetic_path('bare.mjs')]
    const sources = {
      [files[0]]: CONTROL_ALIASED_PRODUCER,
      [files[1]]: CONTROL_BARE_PRODUCER
    }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    const reported = findings.find(
      (finding) => finding.table === 'widgets' && finding.column === 'salary'
    )
    cases.push([
      'a qualified alias-back for a lost column is reported as SPLIT PRODUCERS',
      Boolean(reported) && reported.finding_class === 'SPLIT PRODUCERS'
    ])
  }

  // 2. Deleting the bare producer takes the finding OUT of SPLIT PRODUCERS.
  //    This is the half that proves the class is derived rather than constant.
  {
    const files = [synthetic_path('aliased.mjs')]
    const sources = { [files[0]]: CONTROL_ALIASED_PRODUCER }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    const reported = findings.find(
      (finding) => finding.table === 'widgets' && finding.column === 'salary'
    )
    cases.push([
      'deleting the bare producer drops the SPLIT PRODUCERS classification',
      Boolean(reported) && reported.finding_class !== 'SPLIT PRODUCERS'
    ])
  }

  // 3. The UNQUALIFIED anchor resolves its table from the enclosing db('<table>').
  //    Omitting this form is a miss on a KNOWN site (get-roster.mjs:48), so the
  //    control states it directly rather than trusting the regex.
  {
    const files = [synthetic_path('unqualified.mjs')]
    const sources = { [files[0]]: CONTROL_UNQUALIFIED_PRODUCER }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    const reported = findings.find(
      (finding) =>
        finding.table === 'widgets' &&
        finding.column === 'salary' &&
        finding.anchor === 'unqualified'
    )
    cases.push([
      'an unqualified alias resolves its table from the enclosing statement',
      Boolean(reported)
    ])
  }

  // 3b. A COMMENT between chained calls does not end the statement. This case
  //     exists because the miss it guards is not hypothetical: it swallowed
  //     get-roster.mjs:48 on this gate's first run against the real tree.
  {
    const files = [synthetic_path('commented.mjs')]
    const sources = { [files[0]]: CONTROL_COMMENTED_CHAIN_PRODUCER }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    cases.push([
      'a comment between chained calls does not truncate the statement walk',
      findings.some(
        (finding) => finding.table === 'widgets' && finding.column === 'salary'
      )
    ])
  }

  // 4. The lost-column discriminator actually discriminates. Without it the scan
  //    reports 196 join-disambiguation aliases and is unusable.
  {
    const files = [synthetic_path('aliased.mjs')]
    const sources = { [files[0]]: CONTROL_ALIASED_PRODUCER }
    const { findings } = run_scan({
      lost_columns: new Map(),
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    cases.push([
      'an alias whose target is NOT a lost column is not reported',
      findings.length === 0
    ])
  }

  // 5 and 6. DENOMINATOR against the REAL corpus. Cases 1-4 are synthetic, so a
  //    corpus that stopped being walked, or an extractor that stopped matching,
  //    would leave them all green. These state the denominator directly, and they
  //    are anchored on ALL alias literals rather than on residue -- residue goes
  //    to zero when the tree is clean, which is the success state, not a blindness.
  {
    let qualified = 0
    let unqualified = 0
    for (const file of walk_files(SERVER_ROOTS, ['.mjs', '.js'])) {
      const source = fs.readFileSync(file, 'utf8')
      if (!source.includes(' as ')) continue
      for (const site of collect_alias_sites({
        relative_path: path.relative(repo_root, file),
        source
      })) {
        if (site.anchor === 'qualified') qualified += 1
        else unqualified += 1
      }
    }
    cases.push([
      `the extractor still finds qualified alias literals in the real corpus (${qualified})`,
      qualified > 0
    ])
    cases.push([
      `the extractor still finds unqualified alias literals in the real corpus (${unqualified})`,
      unqualified > 0
    ])
  }

  // 7. Each READ SHAPE matches its fixture and rejects a near miss. These are the
  //    four cases that failed in production during the player_salary migration; a
  //    matcher silently losing one is how a sweep reports clean over live breakage.
  {
    const fixtures = [
      ['accessor', "player_map.get('value')", 'player_map.getValue()'],
      [
        'accessor_with_default',
        "player_map.get('value', 0)",
        "player_map.get('other', 0)"
      ],
      [
        'object_property',
        'const row = { value: 1 }',
        'const row = { valued: 1 }'
      ],
      [
        'object_shorthand',
        'const row = { pid, value, week }',
        'const row = { valuation }'
      ],
      [
        'destructure',
        'const { pid, value } = row',
        'const { pid, valuation } = row'
      ]
    ]
    for (const [shape, positive, negative] of fixtures) {
      const build = READ_SHAPES.find(([name]) => name === shape)[1]
      const pattern = build('value')
      cases.push([
        `read shape ${shape} matches its fixture and rejects a near miss`,
        pattern.test(positive) && !pattern.test(negative)
      ])
    }
  }

  console.log('NEGATIVE CONTROL')
  const failures = []
  for (const [label, passed] of cases) {
    console.log(`  ${passed ? 'RED as expected' : 'STAYED GREEN'}  ${label}`)
    if (!passed) failures.push(label)
  }
  return failures
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const main = () => {
  const argv = yargs(hideBin(process.argv))
    .option('base', {
      type: 'string',
      default: 'origin/master',
      describe: 'git ref to diff the schema against'
    })
    .option('json', { type: 'boolean', default: false })
    .option('unadjudicated', {
      type: 'boolean',
      default: false,
      describe: 'report only findings no adjudication covers'
    })
    .parse()

  if (!fs.existsSync(schema_path)) {
    console.error(`missing schema file: ${schema_path}`)
    return 2
  }
  const current_tables = parse_schema(fs.readFileSync(schema_path, 'utf8'))

  // A base ref git cannot resolve is a HARD FAILURE. check-renamed-column-consumers
  // exits 0 with `GATE OK` here, printing one SKIPPED line, so a typo or a
  // garbage-collected ref reads as a passed gate. Not reproduced.
  const base_sql = schema_at_ref(argv.base)
  if (base_sql === null) {
    console.error(
      `GATE ERROR: could not read db/schema.postgres.sql at ${argv.base}. ` +
        'An unresolvable base ref is a failure, not a pass -- give this gate the ' +
        'pre-cluster revision.'
    )
    return 2
  }

  const control_failures = run_negative_control({ current_tables })
  console.log('')

  const lost_columns = derive_lost_columns({
    base_tables: parse_schema(base_sql),
    current_tables
  })

  const scan = run_scan({
    lost_columns,
    current_tables,
    producer_files: walk_files(SERVER_ROOTS, ['.mjs', '.js']),
    read_files: [
      ...walk_files(SERVER_ROOTS, ['.mjs', '.js']),
      ...walk_files(SPA_ROOTS, ['.js', '.mjs'])
    ]
  })

  const adjudications = load_adjudications()
  const findings = [
    ...apply_adjudications(scan.findings, adjudications),
    ...stale_adjudications(adjudications)
  ]
  const unadjudicated = findings.filter((finding) => !finding.adjudicated)
  const reported = argv.unadjudicated ? unadjudicated : findings

  if (argv.json) {
    console.log(JSON.stringify({ ...scan, findings }, null, 2))
  } else {
    const lost_count = [...lost_columns.values()].reduce(
      (total, columns) => total + columns.size,
      0
    )
    console.log(
      `${lost_count} column(s) lost across ${lost_columns.size} table(s) since ${argv.base}`
    )
    console.log(
      `${scan.total_alias_literals} alias literal(s) in server code ` +
        `(${scan.qualified_literals} qualified, ${scan.unqualified_literals} unqualified; ` +
        `${scan.unresolvable_unqualified} unqualified with no resolvable table)`
    )
    console.log(
      `${findings.length} finding(s), ${unadjudicated.length} unadjudicated\n`
    )

    const class_order = [
      'SPLIT PRODUCERS',
      'ORPHANED ALIAS',
      'UNIFORM',
      'STALE ADJUDICATION'
    ]
    const ordered = [...reported].sort(
      (a, b) =>
        class_order.indexOf(a.finding_class) -
          class_order.indexOf(b.finding_class) || a.file.localeCompare(b.file)
    )

    for (const finding of ordered) {
      const status = finding.adjudicated
        ? `ADJUDICATED ${finding.verdict}`
        : 'UNADJUDICATED'
      console.log(
        `  [${finding.finding_class}] ${finding.table}.${finding.new_column} as ` +
          `${finding.column}  ${finding.file}:${finding.line}  -- ${status}`
      )
      if (finding.bare_producers.length)
        console.log(
          `     bare producer(s) of the same column: ${finding.bare_producers.join(', ')}`
        )
      if (finding.new_name_key_read_count)
        console.log(
          `     new name read as an in-memory key at ${finding.new_name_key_read_count} site(s): ` +
            `${finding.new_name_key_reads.join(', ')}`
        )
      console.log(
        `     auditability: old name ${finding.auditability.old_name_length} char(s), ` +
          `${finding.auditability.alias_site_count} alias site(s), survives on ` +
          `${finding.auditability.old_name_survives_on.join(', ') || 'no other table'}`
      )
      if (finding.reason) console.log(`     reason: ${finding.reason}`)
    }
    if (!reported.length) console.log('  none\n')

    console.log(
      unadjudicated.length
        ? `\nGATE FAIL: ${unadjudicated.length} finding(s) -- migrate or adjudicate before shipping.`
        : '\nGATE OK.'
    )
  }

  if (control_failures.length) {
    console.error(
      `\nNEGATIVE CONTROL FAILED: ${control_failures.length} case(s) stayed green. ` +
        'This gate cannot be trusted until they go red.'
    )
    return 2
  }

  return unadjudicated.length ? 1 : 0
}

// `db/adhoc` scripts are run by hand from a relative path, and `is_main` compares
// process.argv[1] VERBATIM against the resolved module path -- so a guarded call
// would silently do nothing and exit 0. Call main bare, as the sibling gates do.
process.exitCode = main()
