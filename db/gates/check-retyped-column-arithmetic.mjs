// check-retyped-column-arithmetic
//
// Every consumer gate in this directory resolves column NAMES. A RETYPE leaves
// the name identical and valid, so all of them are structurally blind to it:
// `check-knex-column-resolution` resolves `seasons.draft_start` against the
// schema and finds it, `check-renamed-column-consumers` gate 1 finds it,
// `check-league-schema-consumers` EXPLAINs a statement naming it and Postgres
// plans it happily. The column is real. What changed is that it is no longer a
// number, and every site still treating it as one is a live defect that no
// name-resolving oracle can see.
//
// That class had ZERO coverage until this gate, and it is the one that hurt. The
// 2026-08-07 conform retyped 17 columns from bigint/integer epoch seconds to
// timestamptz, and the residue took two sweeps to clear:
//
//   process-projections.mjs   the freshness oracle bound `Math.round(Date.now()
//                             / 1000)` against the retyped `leagues.processed_at`.
//                             Postgres threw `date/time field value out of
//                             range`, `main()` swallowed the throw, and
//                             `report_job` recorded SUCCESS -- so the oracle was
//                             dead for as long as the retype was unswept and
//                             nothing anywhere said so.
//   notifications-draft.mjs   `.where('draft_start', '<', dayjs().unix())`, plus
//                             `on_clock_at > now` comparing a retyped instant
//                             against epoch seconds.
//   announce-restricted-...   epoch bound against both RFA period bounds, and a
//                             `dayjs.unix()` render of a retyped value, which
//                             does not throw -- it prints 1970.
//
// THE TWO FAMILIES, and both are needed. A retype breaks the BIND side and the
// READ side independently, and only the bind side is loud:
//
//   BIND   an epoch-valued expression bound against a retyped column in a knex
//          predicate. Postgres rejects it, so this fails on execution -- loudly,
//          unless a caller swallows, which is exactly what happened above.
//   READ   a value read FROM a retyped column flowing into epoch arithmetic --
//          `dayjs.unix(x)`, `Number(x)`, or a numeric comparison against an
//          epoch-valued operand. This one NEVER throws. `dayjs.unix()` of a Date
//          renders 1970, `Number()` of one yields milliseconds where the code
//          wants seconds, and a comparison silently answers a constant. There is
//          no exit code, no signal and no log line that distinguishes it.
//
// WHY IT IS NAME-ANCHORED ON THE RETYPED COLUMN AND NOT ON THE ARITHMETIC.
// Anchoring on `dayjs.unix(` finds several hundred sites, nearly all of them
// correct -- most epoch columns in this schema were NOT retyped and reading them
// with `dayjs.unix` is right. The discriminator is that the value came from a
// column whose type MOVED, which is derivable only from the schema diff. So the
// retyped set is derived, never hand-listed, and a run whose diff yields no
// retyped columns reports that rather than passing: an empty subject set is the
// shape in which this gate reads green over an unread tree.
//
// REACH AND CLASS ARE INDEPENDENT -- CLAUDE.md's rule, and it applies to this
// gate's own scope. This gate's class is a TYPE mismatch at a column boundary.
// It is deliberately NOT widened to every temporal retype: `config.updated_at`
// and `matchups.simulation_timestamp` moved `timestamp` -> `timestamptz`, which
// is a timezone-semantics change and a real hazard, but it is not this class --
// no epoch arithmetic is involved and flagging their reads would report every
// correct site. The subject is a retype whose OLD type was numeric, because that
// is the retype that leaves epoch-shaped code compiling and wrong.
//
// BINDINGS ARE RESOLVED, not grepped, the same way check-knex-column-resolution
// resolves a column reference through the statement that binds it: an identifier
// is a retyped VALUE when it was assigned from a read of a retyped column, and
// an identifier is EPOCH-valued when it was assigned from `.unix()`,
// `Date.now()` or the `Math.round(Date.now() / 1000)` idiom. A comparison is
// reported only when one side resolves to each. Without that, `a - b` is
// unreportable noise -- `Date - Date` is perfectly good JavaScript.
//
// NEGATIVE CONTROLS, RUN EVERY TIME, and several run in BOTH directions --
// because half of what this gate does is decide a site is NOT a defect, and an
// over-eager matcher fails in the direction that looks like success. The control
// that earns its keep is case 7: it mutates a REAL corpus read of a REAL retyped
// column, so it reports STAYED GREEN when the scan, the binding resolution or
// the schema diff goes blind. There is deliberately no coverage-floor constant;
// that case already covers the catastrophic direction and a hand-maintained
// minimum would fire on ordinary churn instead.
//
// Usage:
//
//   node db/gates/check-retyped-column-arithmetic.mjs --base <pre-cluster-ref>
//
// `--base` is REQUIRED and has no default, so there is no invocation that
// silently diffs against nothing. An unresolvable base ref is exit 2, never a
// pass -- `check-renamed-column-consumers` gate 2 exits 0 with GATE OK on one
// and that shape is not reproduced here.
//
// Exit 0 = no findings; 1 = a finding or a control that stayed green; 2 = a
// tooling error (unresolvable base ref, unreadable schema, or a window with no
// retype AND no schema change at all -- see derive_schema_delta).
//
// THE NO-SUBJECT VERDICT is checked by running the three paths against real
// refs, since it is a whole-run outcome that no per-matcher control can reach.
// Re-verify with these; each was measured 2026-08-16:
//
//   --base 805d8a5d6~1   real retype     33 retyped columns, 7 controls RED,
//                                        exit 1 on a finding (unchanged)
//   --base 07352afbd~1   additive only   0 retyped, delta +1334/-1333 (net +1 =
//                                        seasons.rookie_draft_end_at; the churn
//                                        is a sibling rename counted across
//                                        nfl_plays' partition children),
//                                        NO SUBJECT, exit 0
//   --base HEAD          no movement     delta 0, TOOLING ERROR, exit 2
//
// The middle case is the one this exists for: before 2026-08-16 it exited 1 with
// `negative control STAYED GREEN` over a cluster with nothing wrong, and the
// remedy that failure invites -- deleting the adjudications it reports as stale
// -- is destructive.
//
// Uses console.log deliberately, never `debug`.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

// `@babel/core` and not `@babel/parser`: the parser is only a TRANSITIVE
// dependency, and a bare import of one resolves from this checkout while failing
// in a CI checkout or on a host. Same reasoning as check-api-response-shapes.
import { parseSync as parse_js } from '@babel/core'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const schema_file = path.join(repo_root, 'db', 'schema.postgres.sql')
const adjudications_file = path.join(
  repo_root,
  'db/gates/retyped-column-arithmetic-adjudications.json'
)

// The server roots plus `libs-shared`, which is isomorphic and reaches the SPA.
//
// `test/` and `private/` are here deliberately, and they are the two surfaces
// the 2026-08-07 sweep declared as gaps. `private/` is in NO other consumer
// gate's corpus at all -- CLAUDE.md records that as a standing hole, and the
// writers it holds are exactly the kind nothing executes in CI. `test/` was not
// scanned by either sweep, and a fixture is a real consumer: it writes the
// column, so a fixture on the wrong side of a retype encodes the wrong shape and
// then makes the suite agree with it, which is the failure
// `test/scripts.restricted-free-agency.spec.mjs` already had once.
//
// Both were re-derived rather than trusted on 2026-08-08 and both are clean of
// this class -- `private/` with no findings at all, `test/` with three that are
// the same by-contract shape as `create-league.mjs` and are adjudicated.
//
// `app/` is deliberately OUT: the SPA receives these values as JSON strings
// rather than as Date objects, so its arithmetic is a different question with a
// different answer, and including it would report every correct site.
const SCAN_ROOTS = [
  'api',
  'libs-server',
  'libs-shared',
  'scripts',
  'jobs',
  'test',
  'private'
]

// A retype is in this gate's class when the OLD type was numeric and the NEW one
// is temporal. Both halves are structural type tests, not a name list.
const NUMERIC_TYPE_RE =
  /^(bigint|integer|int|int2|int4|int8|smallint|numeric|real|double precision|decimal)\b/
const TEMPORAL_TYPE_RE = /^(timestamp|timestamptz|date|time)\b/

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

// The block terminator is `\n)` and NOT `\n);`, because a PARTITIONED table
// ends `)\nPARTITION BY RANGE (...);`. Anchoring on the semicolon makes the
// non-greedy body run PAST such a table into the next one, so the partitioned
// table absorbs its neighbour's columns and the neighbour is never registered
// at all. On this schema that hid SIX tables -- `nfl_plays_current_week`,
// `historical_injury_index_2009`, `nfl_snaps_year_2000`, `player_gamelogs_default`,
// `projections_history_default`, `projections_index_default` -- each of them the
// table declared immediately after a partitioned parent.
//
// That is not a cosmetic gap for this gate: `nfl_plays_current_week.updated` is
// a RETYPE SUBJECT of the 2026-08-08 timestamptz cluster, so the gate silently
// dropped one of the fifteen columns it was pointed at and could not have
// reported a consumer of it. `check-rename-alias-residue` had the identical
// defect and CLAUDE.md records it as "a partition-terminator miss that hid six
// tables"; it recurred here because the terminator was re-typed from memory
// rather than derived. `assert_table_coverage` below is what keeps it from
// recurring a third time silently.
const parse_schema_types = (sql) => {
  const tables = new Map()
  const table_re =
    /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\n\)/gi
  let match
  while ((match = table_re.exec(sql))) {
    const columns = new Map()
    for (const raw_line of match[2].split('\n')) {
      const line = raw_line.trim().replace(/,$/, '')
      const column_match = /^"?([a-z0-9_]+)"?\s+(.+)$/i.exec(line)
      if (!column_match) continue
      if (
        /^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE|LIKE|PARTITION)$/i.test(
          column_match[1]
        )
      ) {
        continue
      }
      // Everything before the first modifier keyword is the type. `timestamp
      // with time zone DEFAULT now() NOT NULL` reduces to the type alone.
      const type = column_match[2]
        .split(
          /\s+(?:DEFAULT|NOT|NULL|GENERATED|COLLATE|CONSTRAINT|REFERENCES)\b/i
        )[0]
        .trim()
        .toLowerCase()
      columns.set(column_match[1], type)
    }
    tables.set(match[1], columns)
  }
  return tables
}

// Every `CREATE TABLE` statement must survive into the parsed map. Anchored on
// the statement HEADER, which is a different derivation from the one it checks
// -- a coverage assertion sharing its subject's parse would agree with it by
// construction and could only ever report zero.
const assert_table_coverage = (sql, tables, revision_label) => {
  const declared = [
    ...sql.matchAll(
      /^CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([a-z0-9_]+)"?\s*\($/gim
    )
  ].map((match) => match[1])
  const missing = declared.filter((table) => !tables.has(table))
  if (!missing.length) return

  console.error(
    `TOOLING ERROR: ${missing.length} of ${declared.length} tables in ${revision_label} ` +
      'did not survive schema parsing, so this gate could not have reported a retype on ' +
      'any of them:'
  )
  for (const table of missing) console.error(`  ${table}`)
  console.error(
    'The usual cause is a table-block terminator the parser does not recognise; a ' +
      'PARTITIONED table ends `)\\nPARTITION BY ...` rather than `);`.'
  )
  process.exit(2)
}

// A column is RETYPED when it exists under the same name on the same table in
// both revisions and its type moved from numeric to temporal. The name-identity
// requirement is what separates this from a rename -- a renamed column is
// another gate's class and is absent from the base side entirely.
// An EMPTY retyped set has two causes that are byte-identical at the subject
// line, and they want opposite verdicts. Either the window genuinely contains no
// type change -- an ADDITIVE-only cluster, where the correct answer is "not
// applicable" -- or the base ref resolves but sits AFTER the DDL, the documented
// wrong-base failure, where the retype is real and simply outside the window.
//
// The retyped set cannot tell them apart. The WIDER schema delta can, for the
// case that actually occurs: an additive cluster changes the schema (it adds a
// column), while a base ref pointing past the whole cluster typically shows no
// schema change at all. So a run with no subject AND no schema movement is
// treated as a tooling error rather than a pass, and a run with no subject but
// real additive movement is allowed to be OK.
//
// This is a discriminator, not a proof: a base ref landing between two commits
// of the same cluster could show movement and still be wrong. That is why the
// no-subject banner prints the base ref and says outright that confirming it is
// the DDL commit is the caller's job.
const derive_schema_delta = (base_tables, head_tables) => {
  let added_tables = 0
  let removed_tables = 0
  let added_columns = 0
  let removed_columns = 0
  let type_changes = 0

  for (const [table, columns] of head_tables) {
    const base_columns = base_tables.get(table)
    if (!base_columns) {
      added_tables += 1
      continue
    }
    for (const [column, type] of columns) {
      const base_type = base_columns.get(column)
      if (!base_type) {
        added_columns += 1
        continue
      }
      if (base_type !== type) type_changes += 1
    }
  }

  for (const [table, columns] of base_tables) {
    const head_columns = head_tables.get(table)
    if (!head_columns) {
      removed_tables += 1
      continue
    }
    for (const column of columns.keys()) {
      if (!head_columns.has(column)) removed_columns += 1
    }
  }

  const total =
    added_tables +
    removed_tables +
    added_columns +
    removed_columns +
    type_changes
  return {
    added_tables,
    removed_tables,
    added_columns,
    removed_columns,
    type_changes,
    total
  }
}

const derive_retyped_columns = (base_tables, head_tables) => {
  const retyped = []
  for (const [table, columns] of head_tables) {
    const base_columns = base_tables.get(table)
    if (!base_columns) continue
    for (const [column, type] of columns) {
      const base_type = base_columns.get(column)
      if (!base_type || base_type === type) continue
      if (!NUMERIC_TYPE_RE.test(base_type)) continue
      if (!TEMPORAL_TYPE_RE.test(type)) continue
      retyped.push({ table, column, from: base_type, to: type })
    }
  }
  return retyped
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
    } else if (path.extname(entry.name) === '.mjs') {
      acc.push(full)
    }
  }
  return acc
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

function* walk_ast(node, parent = null) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) yield* walk_ast(child, parent)
    return
  }
  if (typeof node.type !== 'string') return
  yield { node, parent }
  for (const key of Object.keys(node)) {
    if (
      key === 'loc' ||
      key === 'leadingComments' ||
      key === 'trailingComments'
    )
      continue
    yield* walk_ast(node[key], node)
  }
}

const member_property_name = (node) => {
  if (!node || node.type !== 'MemberExpression') return null
  if (node.computed) {
    return node.property.type === 'StringLiteral' ? node.property.value : null
  }
  return node.property.type === 'Identifier' ? node.property.name : null
}

// `dayjs().unix()`, `x.unix()`, `Date.now()`, `Math.round(Date.now() / 1000)`.
// These are the shapes this codebase writes an epoch second in; a value that is
// none of them is not asserted to be anything, which is the safe direction.
const is_epoch_expression = (node, epoch_bindings) => {
  if (!node) return false
  if (node.type === 'Identifier') return epoch_bindings.has(node.name)
  if (node.type === 'NumericLiteral') return true
  if (node.type === 'CallExpression') {
    const callee_property = member_property_name(node.callee)
    if (callee_property === 'unix') return true
    if (
      callee_property === 'now' &&
      node.callee.object?.type === 'Identifier' &&
      node.callee.object.name === 'Date'
    ) {
      return true
    }
    // `Math.round(<epoch-ish>)` / `Math.floor(...)` -- the rounding wrapper the
    // repo uses around `Date.now() / 1000`.
    if (
      (callee_property === 'round' || callee_property === 'floor') &&
      node.callee.object?.type === 'Identifier' &&
      node.callee.object.name === 'Math'
    ) {
      return node.arguments.some((argument) =>
        is_epoch_expression(argument, epoch_bindings)
      )
    }
    return false
  }
  if (node.type === 'BinaryExpression') {
    return (
      is_epoch_expression(node.left, epoch_bindings) ||
      is_epoch_expression(node.right, epoch_bindings)
    )
  }
  return false
}

// A read of a retyped column: `row.draft_start`, `row?.draft_start`,
// `row['draft_start']`, or an identifier that was bound to one.
const is_retyped_read = (node, retyped_names, retyped_bindings) => {
  if (!node) return false
  if (node.type === 'Identifier') return retyped_bindings.has(node.name)
  if (
    node.type === 'MemberExpression' ||
    node.type === 'OptionalMemberExpression'
  ) {
    const property = member_property_name(node)
    return Boolean(property && retyped_names.has(property))
  }
  if (node.type === 'TSNonNullExpression') {
    return is_retyped_read(node.expression, retyped_names, retyped_bindings)
  }
  return false
}

// Which retyped column a read names, for the finding text.
const retyped_read_name = (node, retyped_names, retyped_bindings) => {
  if (node?.type === 'Identifier') return retyped_bindings.get(node.name)
  const property = member_property_name(node)
  return property && retyped_names.has(property) ? property : null
}

// ---------------------------------------------------------------------------
// binding resolution
// ---------------------------------------------------------------------------

// One pass over the file collecting the two binding sets the comparison rule
// needs. Deliberately file-scoped rather than block-scoped: this codebase does
// not shadow these names, and a scope-accurate resolver would be a large amount
// of machinery for a distinction the corpus does not draw. The cost of the
// approximation is a possible false positive, which is adjudicable; a
// scope-accurate resolver that dropped a binding would be a false negative,
// which is not.
const collect_bindings = (ast, retyped_names) => {
  const retyped_bindings = new Map()
  const epoch_bindings = new Set()

  // Iterated to a fixed point so a chain (`const a = row.draft_start; const b =
  // a`) resolves regardless of declaration order.
  for (let pass = 0; pass < 4; pass++) {
    const before = retyped_bindings.size + epoch_bindings.size

    for (const { node } of walk_ast(ast.program)) {
      const declarations =
        node.type === 'VariableDeclarator'
          ? [[node.id, node.init]]
          : node.type === 'AssignmentExpression' && node.operator === '='
            ? [[node.left, node.right]]
            : []

      for (const [target, value] of declarations) {
        if (!value) continue

        if (target.type === 'Identifier') {
          if (is_retyped_read(value, retyped_names, retyped_bindings)) {
            retyped_bindings.set(
              target.name,
              retyped_read_name(value, retyped_names, retyped_bindings)
            )
          }
          if (is_epoch_expression(value, epoch_bindings)) {
            epoch_bindings.add(target.name)
          }
          // `previous?.selection_timestamp || draft_start` -- a fallback chain
          // whose arms are both retyped reads still yields a retyped value.
          if (
            value.type === 'LogicalExpression' &&
            (is_retyped_read(value.left, retyped_names, retyped_bindings) ||
              is_retyped_read(value.right, retyped_names, retyped_bindings))
          ) {
            retyped_bindings.set(
              target.name,
              retyped_read_name(value.left, retyped_names, retyped_bindings) ||
                retyped_read_name(value.right, retyped_names, retyped_bindings)
            )
          }
          continue
        }

        // `const { draft_start } = season` / `const { draft_start: start } = x`
        if (target.type === 'ObjectPattern') {
          for (const property of target.properties) {
            if (property.type !== 'ObjectProperty') continue
            const key =
              property.key.type === 'Identifier'
                ? property.key.name
                : property.key.type === 'StringLiteral'
                  ? property.key.value
                  : null
            if (!key || !retyped_names.has(key)) continue
            if (property.value.type === 'Identifier') {
              retyped_bindings.set(property.value.name, key)
            }
          }
        }
      }
    }

    if (retyped_bindings.size + epoch_bindings.size === before) break
  }

  return { retyped_bindings, epoch_bindings }
}

// ---------------------------------------------------------------------------
// the two finding families
// ---------------------------------------------------------------------------

const PREDICATE_METHODS = new Set([
  'where',
  'andWhere',
  'orWhere',
  'whereNot',
  'having',
  'on',
  'andOn'
])

const line_of = (node) => node.loc?.start.line ?? 0

const scan_source = ({ source, relative_path, retyped_names, stats }) => {
  const findings = []
  let ast
  try {
    ast = parse_js(source, {
      sourceType: 'module',
      configFile: false,
      babelrc: false,
      filename: relative_path
    })
  } catch (error) {
    stats.parse_errors.push({ path: relative_path, message: error.message })
    return findings
  }
  stats.files_parsed += 1

  const { retyped_bindings, epoch_bindings } = collect_bindings(
    ast,
    retyped_names
  )
  stats.retyped_bindings += retyped_bindings.size

  const retyped_read = (node) =>
    is_retyped_read(node, retyped_names, retyped_bindings)
  const read_name = (node) =>
    retyped_read_name(node, retyped_names, retyped_bindings)

  for (const { node } of walk_ast(ast.program)) {
    // ---- BIND family: an epoch value bound against a retyped column ----
    if (node.type === 'CallExpression') {
      const method = member_property_name(node.callee)
      if (PREDICATE_METHODS.has(method) && node.arguments.length >= 2) {
        const [column_argument] = node.arguments
        const column =
          column_argument?.type === 'StringLiteral'
            ? column_argument.value.split('.').pop()
            : null
        if (column && retyped_names.has(column)) {
          stats.predicate_sites += 1
          // `.where(col, value)` binds argument 1; `.where(col, op, value)`
          // binds argument 2. Reading past the bound value would resolve an
          // OPERATOR as a value, the same trap the bare-string half of
          // check-knex-column-resolution documents.
          const bound =
            node.arguments.length === 2 ? node.arguments[1] : node.arguments[2]
          if (bound && is_epoch_expression(bound, epoch_bindings)) {
            findings.push({
              kind: 'epoch_bound_against_retyped_column',
              path: relative_path,
              line: line_of(node),
              column,
              detail:
                `\`${column}\` is timestamptz, but this predicate binds an ` +
                'epoch-shaped value. Postgres rejects it with `date/time field ' +
                'value out of range`.'
            })
          }
        }
      }

      // ---- READ family: dayjs.unix(x) / Number(x) on a retyped value ----
      const callee_property = member_property_name(node.callee)
      const is_dayjs_unix =
        callee_property === 'unix' &&
        node.callee.object?.type === 'Identifier' &&
        /dayjs|moment/i.test(node.callee.object.name)
      const is_number_cast =
        node.callee.type === 'Identifier' && node.callee.name === 'Number'
      if ((is_dayjs_unix || is_number_cast) && node.arguments.length) {
        const argument = node.arguments[0]
        if (retyped_read(argument)) {
          const column = read_name(argument)
          findings.push({
            kind: 'retyped_read_in_epoch_arithmetic',
            path: relative_path,
            line: line_of(node),
            column,
            detail: is_dayjs_unix
              ? `\`${column}\` is timestamptz, so \`dayjs.unix()\` of it renders ` +
                '1970 rather than throwing.'
              : `\`${column}\` is timestamptz, so \`Number()\` of it yields ` +
                'milliseconds where the surrounding code wants seconds.'
          })
        }
      }
    }

    // ---- READ family: a numeric comparison of a retyped value ----
    if (node.type === 'BinaryExpression') {
      if (!['-', '+', '<', '>', '<=', '>=', '*', '/'].includes(node.operator))
        continue
      const left_retyped = retyped_read(node.left)
      const right_retyped = retyped_read(node.right)
      if (!left_retyped && !right_retyped) continue
      stats.comparison_sites += 1
      // Only reported when the OTHER side resolves to an epoch value. A retyped
      // value compared against another retyped value, or against something this
      // gate cannot resolve, is not asserted to be wrong -- `Date - Date` is
      // good JavaScript, and guessing here would report every correct site.
      const other = left_retyped ? node.right : node.left
      if (left_retyped && right_retyped) continue
      if (!is_epoch_expression(other, epoch_bindings)) {
        stats.comparisons_unresolved += 1
        continue
      }
      const column = read_name(left_retyped ? node.left : node.right)
      findings.push({
        kind: 'retyped_read_in_epoch_arithmetic',
        path: relative_path,
        line: line_of(node),
        column,
        detail:
          `\`${column}\` is timestamptz and the other operand of \`${node.operator}\` ` +
          'is epoch seconds. This does not throw; it answers a constant.'
      })
    }
  }

  return findings
}

// ---------------------------------------------------------------------------
// adjudications
// ---------------------------------------------------------------------------

const load_adjudications = () => {
  if (!fs.existsSync(adjudications_file)) return []
  return JSON.parse(fs.readFileSync(adjudications_file, 'utf8'))
}

// Keyed per SITE, never per NAME -- a name-keyed entry is the stoplist that hid
// `scoring_format_player_projection_points.total` from check-renamed-column-
// consumers, and an adjudication that suppresses nothing is itself a finding.
//
// The key is `(path, column, kind)` and deliberately NOT the line: a line number
// moves on any edit above it, which would expire every entry on unrelated churn
// and train a reader to re-add them without re-reading the site. The file plus
// the column plus the family is specific enough that a genuinely new site in the
// same file is still reported -- it is a different family or a different column,
// or it is the same claim about the same value.
// STALENESS IS ONLY MEANINGFUL FOR AN ENTRY THIS RUN COULD HAVE EXERCISED, and
// that qualifier is load-bearing rather than pedantic. An entry's column enters
// the subject set only when THIS run's `--base` spans the window that retyped
// it, so a narrower base ref leaves earlier entries matching nothing — and
// reporting those as stale says "the site is gone, delete the entry" about
// suppressions that are live and correct for another window. Acting on it
// deletes load-bearing entries and reopens their findings on the next wide run.
// `check-rename-alias-residue` had exactly this defect (its 15 entries all read
// stale under a narrow base ref while every site was live) and CLAUDE.md
// records the fix as a NOT EXERCISED bucket; this is that fix, here.
const apply_adjudications = (findings, adjudications, retyped) => {
  const in_subject_set = new Set(
    retyped.map((entry) => `${entry.table}.${entry.column}`)
  )
  const exercisable = (entry) =>
    retyped.some((subject) => subject.column === entry.column)

  const used = new Set()
  const kept = []
  for (const finding of findings) {
    const match = adjudications.find(
      (entry) =>
        entry.path === finding.path &&
        entry.column === finding.column &&
        entry.kind === finding.kind
    )
    if (match) {
      used.add(adjudications.indexOf(match))
      continue
    }
    kept.push(finding)
  }

  const unused = adjudications.filter((entry, index) => !used.has(index))
  const stale = unused.filter(exercisable)
  const not_exercised = unused.filter((entry) => !exercisable(entry))
  return { kept, stale, not_exercised, in_subject_set }
}

// ---------------------------------------------------------------------------
// negative controls
// ---------------------------------------------------------------------------

const run_negative_controls = ({ retyped_names, corpus_read_site }) => {
  const cases = []
  const scan = (source) => {
    const stats = blank_stats()
    return scan_source({
      source,
      relative_path: '__negative_control__.mjs',
      retyped_names,
      stats
    })
  }

  const subject = [...retyped_names][0]

  // 1 + 2. The BIND family, both directions on one shape. An epoch bound against
  // a retyped column is the defect; a Date bound against it is the FIX, and a
  // gate reporting both would fire on every site the sweep already repaired.
  if (subject) {
    const epoch_bind = scan(
      `const run = async () =>\n` +
        `  db('seasons').where('${subject}', '<', dayjs().unix())\n`
    )
    cases.push([
      `reports an epoch value bound against the retyped \`${subject}\``,
      epoch_bind.some(
        (finding) => finding.kind === 'epoch_bound_against_retyped_column'
      )
    ])

    const instant_bind = scan(
      `const run = async () =>\n` +
        `  db('seasons').where('${subject}', '<', new Date())\n`
    )
    cases.push([
      `stays SILENT on an INSTANT bound against the retyped \`${subject}\``,
      instant_bind.length === 0
    ])
  }

  // 3 + 4. The READ family, both directions. `dayjs.unix()` of a retyped value
  // is the silent defect; the same call on a column that was NOT retyped is
  // correct on hundreds of sites and must not be reported. This is the case that
  // catches an anchor drifting off the schema diff onto the arithmetic.
  if (subject) {
    const retyped_render = scan(
      `const run = (row) => format(dayjs.unix(row.${subject}))\n`
    )
    cases.push([
      `reports \`dayjs.unix()\` of a read of the retyped \`${subject}\``,
      retyped_render.some(
        (finding) => finding.kind === 'retyped_read_in_epoch_arithmetic'
      )
    ])

    const untouched_render = scan(
      'const run = (row) => format(dayjs.unix(row.negative_control_not_retyped))\n'
    )
    cases.push([
      'stays SILENT on `dayjs.unix()` of a column the diff did NOT retype',
      untouched_render.length === 0
    ])
  }

  // 5 + 6. The comparison rule, both directions. The resolved-both-sides
  // requirement is what makes `a - b` reportable at all, and it is also the
  // thing most likely to be loosened into noise later: a retyped value compared
  // against an UNRESOLVED operand must stay silent, because `Date - Date` is
  // good JavaScript and reporting it would bury the real findings.
  if (subject) {
    const against_epoch = scan(
      `const run = (row) => {\n` +
        `  const now = dayjs().unix()\n` +
        `  const at = row.${subject}\n` +
        `  return at > now\n` +
        `}\n`
    )
    cases.push([
      'reports a retyped value compared against a resolved epoch binding',
      against_epoch.some(
        (finding) => finding.kind === 'retyped_read_in_epoch_arithmetic'
      )
    ])

    const against_unknown = scan(
      `const run = (row, other) => row.${subject} > other\n`
    )
    cases.push([
      'stays SILENT comparing a retyped value against an unresolved operand',
      against_unknown.length === 0
    ])
  }

  // 7. THE ONE THAT DETECTS THIS GATE GOING BLIND. Every case above is
  //    synthetic, so all six pass over an empty corpus, an empty retyped set, or
  //    a scan that reads no files. This one takes a REAL read of a REAL retyped
  //    column out of the corpus and wraps it in `dayjs.unix()`, so it can only go
  //    red when the schema diff, the file walk, the parse and the binding
  //    resolution are all working. With nothing to mutate it reports STAYED
  //    GREEN, which is the signal -- and is why there is no coverage floor here.
  if (corpus_read_site) {
    const mutated = scan(
      `const run = (${corpus_read_site.object}) =>\n` +
        `  dayjs.unix(${corpus_read_site.object}.${corpus_read_site.column})\n`
    )
    cases.push([
      `reports a mutated REAL corpus read of \`${corpus_read_site.column}\` (${corpus_read_site.path}:${corpus_read_site.line})`,
      mutated.some(
        (finding) => finding.kind === 'retyped_read_in_epoch_arithmetic'
      )
    ])
  } else {
    cases.push([
      'reports a mutated REAL corpus read of a retyped column -- NO CORPUS READ SITE FOUND',
      false
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

const blank_stats = () => ({
  files_parsed: 0,
  parse_errors: [],
  retyped_bindings: 0,
  predicate_sites: 0,
  comparison_sites: 0,
  comparisons_unresolved: 0
})

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const parse_argv = () => {
  const argv = process.argv.slice(2)
  const options = { base: null }
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    if (flag === '--base') options.base = argv[++index]
    else {
      console.error(`unknown argument: ${flag}`)
      process.exit(2)
    }
  }
  return options
}

const main = async () => {
  const options = parse_argv()

  console.log('RETYPED COLUMN ARITHMETIC GATE')
  console.log('')

  if (!options.base) {
    console.error(
      'TOOLING ERROR: --base <pre-cluster-ref> is required. This gate derives ' +
        'its subject from a schema type diff, and an invocation that silently ' +
        'diffed against nothing would report GATE OK over every retype in the tree.'
    )
    process.exit(2)
  }

  // An unresolvable base ref is a HARD FAILURE, never a pass. Reproducing
  // check-renamed-column-consumers gate 2's exit-0-with-one-SKIPPED-line shape
  // would make a typo read as a passed gate from every angle except that line.
  let base_schema
  try {
    base_schema = execFileSync(
      'git',
      ['show', `${options.base}:db/schema.postgres.sql`],
      { cwd: repo_root, maxBuffer: 1 << 30 }
    ).toString()
  } catch (error) {
    console.error(
      `TOOLING ERROR: could not read db/schema.postgres.sql at \`${options.base}\`. ` +
        'An unresolvable base ref is a failed run, not a passed one.\n' +
        error.message
    )
    process.exit(2)
  }

  const head_schema = fs.readFileSync(schema_file, 'utf8')
  const base_tables = parse_schema_types(base_schema)
  const head_tables = parse_schema_types(head_schema)

  // A table the parser drops is a table this gate cannot report a retype on,
  // and the drop is otherwise SILENT -- the subject list is simply shorter and
  // there is nothing in the output to compare it against. Assert the denominator
  // rather than trusting the parse: every `CREATE TABLE` statement in each
  // revision must appear in that revision's parsed map. This is exit 2 (tooling
  // error) rather than a finding, because an unparsed table means the run did
  // not ask the question, which is not the same as answering it no.
  assert_table_coverage(base_schema, base_tables, options.base)
  assert_table_coverage(head_schema, head_tables, 'the working tree')

  const retyped = derive_retyped_columns(base_tables, head_tables)

  const schema_delta = derive_schema_delta(base_tables, head_tables)

  console.log(`SUBJECT (derived from the schema diff against ${options.base})`)
  if (!retyped.length) {
    console.log('  no numeric -> temporal retype in this window')
    console.log(
      `  schema delta in window: ${schema_delta.total} change(s) — ` +
        `${schema_delta.added_columns} column(s) added, ` +
        `${schema_delta.removed_columns} removed, ` +
        `${schema_delta.type_changes} retyped (any direction), ` +
        `${schema_delta.added_tables} table(s) added, ` +
        `${schema_delta.removed_tables} removed`
    )
  }
  for (const entry of retyped) {
    console.log(
      `  ${entry.table}.${entry.column}  ${entry.from} -> ${entry.to}`
    )
  }

  const retyped_names = new Set(retyped.map((entry) => entry.column))

  const corpus = []
  for (const root of SCAN_ROOTS) {
    const absolute = path.join(repo_root, root)
    // existsSync is NOT sufficient, and `private` is exactly why: an
    // uninitialized submodule is a present, EMPTY mountpoint, so the existence
    // check passed and the walk then contributed zero files -- the unread tree
    // this branch exists to refuse, arriving through the one door it left open.
    // `git worktree add` and a CI checkout without `submodules:` both produce
    // that shape.
    let entries = null
    try {
      entries = fs.readdirSync(absolute)
    } catch {
      entries = null
    }
    if (entries === null || entries.length === 0) {
      // Exit 2, never a skip. A root that silently resolves to nothing is a gate
      // reading green over an unread tree, and `walk_files` treats an unreadable
      // directory as empty -- the exact way check-knex-column-resolution's
      // coverage floors were shown to miss one root going dark.
      console.error(
        `TOOLING ERROR: scan root ${root} ${entries === null ? 'does not exist' : 'is EMPTY'}, so this gate did NOT run.` +
          (root === 'private'
            ? '\n`private` is a submodule and a fresh worktree does not inherit one: run\n' +
              '`git submodule update --init private` here, then re-run.'
            : '')
      )
      process.exit(2)
    }
    for (const file of walk_files(absolute)) corpus.push(file)
  }

  const stats = blank_stats()
  const raw_findings = []
  // The first real read of a retyped column found in the corpus, kept for
  // control 7 to mutate.
  let corpus_read_site = null

  for (const file of corpus) {
    const source = fs.readFileSync(file, 'utf8')
    const relative_path = path.relative(repo_root, file)
    raw_findings.push(
      ...scan_source({ source, relative_path, retyped_names, stats })
    )

    if (!corpus_read_site && retyped_names.size) {
      // A qualified read of a retyped column written as `<object>.<column>`.
      // Anchored on a real occurrence so the control cannot pass over a corpus
      // that no longer contains one.
      const read = new RegExp(
        `\\b([a-z_][a-z0-9_]*)\\.(${[...retyped_names].join('|')})\\b`
      ).exec(source)
      if (read) {
        corpus_read_site = {
          path: relative_path,
          line: source.slice(0, read.index).split('\n').length,
          object: read[1],
          column: read[2]
        }
      }
    }
  }

  const adjudications = load_adjudications()
  const {
    kept: findings,
    stale,
    not_exercised
  } = apply_adjudications(raw_findings, adjudications, retyped)

  console.log('')
  console.log('COVERAGE (measured, not assumed)')
  console.log(
    `  scan roots                              ${SCAN_ROOTS.join(', ')}`
  )
  console.log(
    `  files parsed                            ${stats.files_parsed} of ${corpus.length}`
  )
  console.log(
    `  files that would not parse              ${stats.parse_errors.length}`
  )
  console.log(`  columns retyped numeric -> temporal     ${retyped.length}`)
  console.log(
    `  identifiers bound to a retyped read     ${stats.retyped_bindings}`
  )
  console.log(
    `  predicates on a retyped column          ${stats.predicate_sites}`
  )
  console.log(
    `  comparisons touching a retyped read     ${stats.comparison_sites}` +
      ` — ${stats.comparisons_unresolved} with an operand this gate could not resolve`
  )

  if (stats.parse_errors.length) {
    console.log('')
    console.log('NOT PARSED — these files were NOT checked')
    for (const entry of stats.parse_errors) {
      console.log(`  ${entry.path}: ${entry.message.split('\n')[0]}`)
    }
  }

  if (findings.length) {
    console.log('')
    console.log(`FINDINGS (${findings.length})`)
    for (const finding of findings) {
      console.log(`  ${finding.kind}`)
      console.log(`    ${finding.path}:${finding.line}`)
      console.log(`    ${finding.detail}`)
    }
  }

  if (stale.length) {
    console.log('')
    console.log(
      `STALE ADJUDICATIONS (${stale.length}) — each suppresses nothing, so the ` +
        'site is gone and the entry must go too'
    )
    for (const entry of stale) {
      console.log(`  ${entry.path}  ${entry.column}  ${entry.kind}`)
    }
  }

  // Printed even when empty, so "nothing was declined" is a statement the run
  // makes rather than one a reader infers from an absence.
  console.log('')
  console.log(
    `NOT EXERCISED (${not_exercised.length}) — column outside this run's retyped set, ` +
      'so this base ref cannot say whether the entry is still needed'
  )
  for (const entry of not_exercised) {
    console.log(`  ${entry.path}  ${entry.column}  ${entry.kind}`)
  }

  // With no subject there is no read site to mutate, so the controls cannot run
  // and their verdict carries no information. Requiring `control_ok` here is
  // what made an additive-only cluster exit 1 with `negative control STAYED
  // GREEN` -- a failure over a cluster with nothing wrong, whose documented
  // remedy (deleting the adjudications it reports) is actively destructive.
  if (!retyped.length) {
    console.log('')
    if (!schema_delta.total) {
      console.log(
        'TOOLING ERROR: no retype AND no schema change of any kind against ' +
          `${options.base}.`
      )
      console.log(
        '  A base ref that sits AFTER the DDL produces exactly this. Give this ' +
          'gate the SCHEMA commit (the DDL apply), not the consumer-sweep commit —'
      )
      console.log(
        '  they are different commits whenever the sweep did not ride in the ' +
          'same commit as the apply, and only this gate takes the first one.'
      )
      // Same reason as the no-subject path below: without the block the runner
      // reports BLIND, which is a true failure under a label that hides the
      // actual cause. Both are failures, so this is precision, not leniency.
      console.log('')
      console.log('NEGATIVE CONTROL')
      console.log(
        '  NOT RUN — no retyped column in this window, so there is nothing to ' +
          'mutate. Fix the base ref and re-run.'
      )
      process.exit(2)
    }
    console.log(
      'NO SUBJECT: this window changes the schema but retypes nothing ' +
        'numeric -> temporal, which is what an ADDITIVE-only cluster looks like.'
    )
    console.log(
      '  Nothing to check, so the negative controls are not run and their ' +
        'silence is not evidence either way.'
    )
    // The runner reads a gate that DECLARES a negative control and prints no
    // block as BLIND (scripts/check-cluster-gates.mjs), which would put this
    // cluster right back where it started. So the block is printed, saying
    // plainly that the controls did NOT run -- never a fabricated pass, and
    // deliberately without the STAYED GREEN token, which the runner reads as a
    // gate that cannot report.
    console.log('')
    console.log('NEGATIVE CONTROL')
    console.log(
      '  NOT RUN — every control mutates a real corpus read of a real retyped ' +
        'column, and this window has none to mutate.'
    )
    console.log(
      `  Confirm ${options.base} is your DDL commit before reading this as a ` +
        'pass — the schema delta above is a discriminator, not a proof.'
    )
    console.log('')
    const failed_without_subject = findings.length || stale.length
    if (!failed_without_subject) {
      console.log('GATE OK (not applicable to this cluster)')
      process.exit(0)
    }
    console.log(
      `GATE FAIL: ${findings.length} finding(s), ${stale.length} stale adjudication(s)`
    )
    process.exit(1)
  }

  const control_ok = run_negative_controls({ retyped_names, corpus_read_site })

  console.log('')
  const failed = findings.length || stale.length || !control_ok
  if (!failed) {
    console.log('GATE OK')
    process.exit(0)
  }
  console.log(
    `GATE FAIL: ${findings.length} finding(s), ${stale.length} stale adjudication(s)` +
      `${control_ok ? '' : ', negative control STAYED GREEN'}`
  )
  process.exit(1)
}

// Called bare on purpose. `is_main` compares `process.argv[1]` VERBATIM against
// the resolved module path, so a guarded call from a relative path -- which is
// how everything under `db/` is run -- silently does nothing and exits 0.
main()
