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
// THE BARE SIDE MUST READ EVERY SHAPE THE ALIAS SIDE READS, and it did not until
// 2026-08-06. It matched only qualified `'table.column'` literals, so a
// `select('*')` producer -- the very shape league CLAUDE.md documents as gate
// 2's silent defect -- and an unqualified `select('widget_salary')` producer
// both contributed NOTHING. A genuine SPLIT PRODUCERS finding was then reported
// as UNIFORM, "correct today", with an empty bare-producer list: the reviewer
// was told every producer aliases back at exactly the moment one does not.
// Three bare shapes count now (qualified, unqualified, and wholesale `'*'` /
// `'table.*'`), and on the real corpus the fix reclassified SIX of the fifteen
// findings out of ORPHANED ALIAS into SPLIT PRODUCERS, naming four bare
// producers no run had ever printed.
//
// The obvious over-fire is the other direction, and it has its own control:
// `get-roster.mjs:48` wildcards AND aliases back in ONE statement, so its row
// carries both names and it must not be counted as a producer split against
// itself. A wholesale site is suppressed for exactly the pairs its own
// statement aliases back.
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
//   definitions declare WIRE IDS; a zero-read alias there is expected rather
//   than suspicious. The original design asserted this exclusion was
//   belt-and-braces because a registry alias name is never a former column.
//   Asserted rather than assumed, that fails:
//   `libs-server/data-views-column-definitions/player-adp-column-definitions.mjs:107`
//   aliases to `adp`, which `player_adp_index` did lose, so it passes the
//   lost-column filter and the path exclusion is the only thing removing it.
//
//   The filter was TWO markers until 2026-08-06, and the second one was a
//   liability rather than a widening. `data-view` is a substring match over the
//   whole relative path, so it excluded 132 files -- 99 outside any
//   column-definitions directory, 13 of them real `db('<table>')` emitters
//   including `api/routes/data-views.mjs`, all of `libs-server/data-views/rate-type/`,
//   and two `scripts/` files caught on filename alone. It was not what removed
//   the load-bearing case above (that path contains `column-definitions` too),
//   so dropping it lost nothing and returned 13 emitters to the scan.
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
//   node db/gates/check-rename-alias-residue.mjs --base <pre-cluster-ref>
//   node db/gates/check-rename-alias-residue.mjs --base <ref> --unadjudicated
//   node db/gates/check-rename-alias-residue.mjs --base <ref> --json
//
// `--base` is REQUIRED and has no default. It defaulted to `origin/master`
// until 2026-08-06, against which the schema diff is empty by construction --
// zero lost columns, therefore zero residue, therefore nothing the gate can
// say about the tree. A missing base ref is the same exit 2 as an unresolvable
// one.
//
// AN ADJUDICATION IS ONLY STALE IF THIS RUN'S BASE REF SEARCHED FOR IT, and it
// was not until 2026-08-07. Every `used === 0` entry was reported STALE
// unconditionally, with the remedy "the site is gone, so the entry must go
// too" -- so a base ref whose diff was not the rename window an entry was
// written for condemned that entry, and following the remedy would delete a
// live, load-bearing suppression. The split was total and had nothing to do
// with the tree: at `--base 62ca45544` (243 lost columns) all 15 entries were
// used and the gate read OK, while at `--base 8f1abd79d~1` (27) and
// `--base c801b5a11` (0) all 15 read as stale, over sites all present in the
// working tree. An entry outside this run's lost-column set is now NOT
// EXERCISED -- counted and printed, no verdict. See
// `classify_unused_adjudications` for the full account.
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
//   node db/gates/check-rename-alias-residue.mjs --base 62ca45544
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
//     literal cannot be resolved to a table. Same hazard gate 2 records. 65 such
//     literals in the corpus today, down from 76 before the builder-binding
//     walk. The imperative form (`const query = db('t')` then
//     `query.select('a as b')`) is NO LONGER in this class, but its walk keys on
//     the binding NAME, so a shadowed or reassigned binding resolves wrong.
//   - AN UNQUALIFIED ALIAS RETURNED FROM A HELPER is the live instance of the
//     above and is worth naming, because it looks covered and is not:
//     `libs-server/data-views/add-defensive-play-by-play-with-statement.mjs:72-73`
//     returns the strings `'season_year as year'` and `'season_type as seas_type'`
//     from a `to_inner_select_expr` helper, genuine `nfl_plays` rename
//     alias-backs sitting inside no `db('<table>')` statement at all. Removing
//     the over-broad `data-view` path marker returned that FILE to the scan; it
//     did not make those two SITES resolvable, and they are still unreported.
//   - A rename with no schema change (a pure API-shape rename) has no diff to
//     derive lost columns from.
//   - THE ADJUDICATION FILE IS ONLY AUDITED WHERE THE BASE REF REACHES. An
//     entry outside this run's lost-column set is neither confirmed nor
//     condemned, so a green run is not a statement that every entry still
//     earns its place. The count is printed for that reason: auditing all 15
//     takes a base ref spanning every rename window they were written for.
//   - The ORPHANED ALIAS test is tree-wide, not per-consumer: it cannot prove the
//     aliased row reaches the code reading the new name. It reports the pairing
//     and asks a human, exactly as gate 2 does for cross-file reads.
//   - The comment stripper does not parse REGEX LITERALS, so a regex containing
//     an unescaped `//` can over-strip to end of line. `\/\/` is guarded; the
//     bare form is not, and over-stripping loses sites silently.
//   - A statement with no projection call at all (`db('t').where(...)` awaited
//     directly) projects the row wholesale and is NOT counted as a bare
//     producer. Only `select`/`first`/`pluck`/`returning` argument positions
//     are read, which keeps `groupBy` out at the cost of this shape.
//
// IMPORTABLE WITHOUT RUNNING. `main()` was called bare at module scope, so
// importing any export ran the whole gate and set `process.exitCode = 1` -- no
// harness and no spec could load this file. The bare call was there because
// `is_main` compares `process.argv[1]` VERBATIM and everything under `db/` is
// run from a relative path, so a guard would silently no-op and exit 0. Both
// are the same defect: an UNRESOLVED path comparison. Resolving both sides
// through `realpathSync` fixes the cause, so a relative invocation runs and an
// import does not. The external backstop against a silent no-op is the cluster
// runner's own rule -- a gate declaring an always-on negative control must
// PRINT one, and a no-op prints nothing.

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
//
// `column-definitions` is the whole filter, and it is the one that carries the
// load-bearing case above. A second marker `data-view` stood here until it was
// measured: it is a SUBSTRING match over the entire relative path, so it
// excluded 132 files -- 99 of them outside any column-definitions directory and
// 13 of those real `db('<table>')` query emitters, including
// `api/routes/data-views.mjs`, every file under `libs-server/data-views/rate-type/`,
// and two `scripts/` files caught on filename alone. It was not covering the
// load-bearing exclusion (that path contains `column-definitions` too), so
// dropping it loses nothing and restores 13 emitters to the scan.
const REGISTRY_PATH_MARKERS = ['column-definitions']

const adjudications_path = path.join(
  __dirname,
  'rename-alias-residue-adjudications.json'
)

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

// The terminator is `\n)` followed by anything up to the statement's semicolon,
// NOT `\n);` -- a partitioned parent closes as `)\nPARTITION BY RANGE (...);`.
// With the tighter form the parent's body ran on to swallow its first partition
// child, and SIX tables were absent from the parsed map entirely
// (`nfl_plays_current_week`, `historical_injury_index_2009`, `nfl_snaps_year_2000`,
// `player_gamelogs_default`, `projections_history_default`, `projections_index_default`).
// Benign only because the children carry identical columns; the failure
// direction is a silent miss, since an absent table means every alias against
// it fails the lost-column discriminator and is never reported.
export const parse_schema = (sql) => {
  const tables = new Map()
  const create_re =
    /CREATE TABLE (?:public\.)?"?([a-z_0-9]+)"?\s*\(([\s\S]*?)\n\)[^;]*;/g
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
// comments
// ---------------------------------------------------------------------------

// A comment is prose ABOUT code, and this gate's own corpus is full of prose
// about alias literals: `scripts/process-projections-for-league-format.mjs:113,205`
// discuss its `projected_points_total as total` alias in backticks, and both
// were reported as alias SITES. Same tokenize-comments trap that blinded
// `check-saved-view-param-coverage`, where a comment naming a legacy key made
// that key permanently unreportable -- there the comment documenting an
// incident is what hid the incident.
//
// A commented-out `db('<table>')` is worse than noise. It mints a PHANTOM
// statement span, and because the span sort is innermost-wins, a short phantom
// beats the real enclosing statement and resolves a live unqualified alias to
// the WRONG table -- which drops it from the scan entirely.
//
// Comment bodies are replaced with SPACES rather than removed, so every index
// and line number in the stripped source still matches the original file and
// `line_of` needs no adjustment.
const strip_comments = (source) => {
  const characters = source.split('')
  let index = 0
  const blank_through = (end_index) => {
    const limit = Math.min(end_index, source.length)
    for (; index < limit; index++)
      if (source[index] !== '\n') characters[index] = ' '
  }
  while (index < source.length) {
    const character = source[index]
    const next_character = source[index + 1]
    // `\/\/` inside a regex literal is not a comment. Regex literals are
    // otherwise unparsed here, which is the one over-strip this can still do.
    if (
      character === '/' &&
      next_character === '/' &&
      source[index - 1] !== '\\'
    ) {
      const end_index = source.indexOf('\n', index)
      blank_through(end_index === -1 ? source.length : end_index)
    } else if (character === '/' && next_character === '*') {
      const end_index = source.indexOf('*/', index + 2)
      blank_through(end_index === -1 ? source.length : end_index + 2)
    } else if (character === "'" || character === '"' || character === '`') {
      // Skip the string body so a `//` inside a URL literal survives.
      index += 1
      while (index < source.length) {
        if (source[index] === '\\') {
          index += 2
          continue
        }
        if (source[index] === character) {
          index += 1
          break
        }
        index += 1
      }
    } else {
      index += 1
    }
  }
  return characters.join('')
}

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

// `const query = db('widgets')` followed by `query.select('widget_salary as
// salary')` is one knex statement broken across two JS statements. The `db()`
// chain ends at the assignment, so the projection sits outside every span, the
// unqualified alias resolves to no table, and `run_scan` drops it -- the gate
// reports NOTHING for a genuine alias-back. The declared blind spot covers a
// FROM target that is not a `db('<table>')` literal; it does not cover this.
const BUILDER_BINDING_RE = /(?:const|let|var)\s+([a-z_$][a-zA-Z_0-9$]*)\s*=\s*$/

// Each later `<binding>.<method>(...)` call gets a span of its OWN carrying the
// bound table, rather than stretching the original span across whatever code
// sits between -- a narrower claim, and one that cannot swallow an unrelated
// statement. The walk stops at a rebinding of the same name.
const builder_binding_spans = ({ source, table, binding, from_index }) => {
  const spans = []
  const rebinding = new RegExp(`(?:const|let|var)\\s+${binding}\\s*=`, 'g')
  rebinding.lastIndex = from_index
  const rebinding_match = rebinding.exec(source)
  const limit = rebinding_match ? rebinding_match.index : source.length

  const call_re = new RegExp(`\\b${binding}\\s*\\.[a-zA-Z_0-9]+\\(`, 'g')
  call_re.lastIndex = from_index
  let match
  while ((match = call_re.exec(source)) !== null) {
    if (match.index >= limit) break
    const end = end_of_call(
      source,
      match.index + match[0].length - 1,
      source.length
    )
    if (end === null) continue
    spans.push({ table, start: match.index, end })
  }
  return spans
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

    const line_start = source.lastIndexOf('\n', match.index) + 1
    const binding_match = source
      .slice(line_start, match.index)
      .match(BUILDER_BINDING_RE)
    if (binding_match)
      spans.push(
        ...builder_binding_spans({
          source,
          table: match[1],
          binding: binding_match[1],
          from_index: end
        })
      )
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
// A bare projection literal, qualified (`'table.column'`) or not (`'column'`).
// The closing quote is anchored, so an alias literal cannot match it.
const BARE_RE = /['"`]([a-z_][a-z_0-9]*)(?:\.([a-z_][a-z_0-9]*))?['"`]/g
// `select('*')` and `select('table.*')` project the row WHOLESALE -- the exact
// shape league CLAUDE.md records as gate 2's silent defect.
const WILDCARD_RE = /['"`](?:([a-z_][a-z_0-9]*)\.)?\*['"`]/g

// Case-INSENSITIVE, matching the alias regexes. Spelled `includes(' as ')` this
// skipped any file whose only alias literals use `AS`.
const has_alias_literal = / as /i

const line_of = (source, index) => source.slice(0, index).split('\n').length

// The same count `collect_alias_sites` produces, over whatever source it is
// handed. The negative control runs it on UNSTRIPPED source to prove the
// comment strip removes real prose from the real corpus.
const count_alias_literals = (source) => {
  let total = 0
  const qualified_indexes = new Set()
  QUALIFIED_ALIAS_RE.lastIndex = 0
  let match
  while ((match = QUALIFIED_ALIAS_RE.exec(source)) !== null) {
    qualified_indexes.add(match.index)
    total += 1
  }
  UNQUALIFIED_ALIAS_RE.lastIndex = 0
  while ((match = UNQUALIFIED_ALIAS_RE.exec(source)) !== null) {
    if (qualified_indexes.has(match.index)) continue
    if (match[0].includes('.')) continue
    total += 1
  }
  return total
}

// Every alias literal in one file, both anchor forms, with the table resolved.
// `table` is null for an unqualified alias whose statement has no `db('<table>')`
// literal to resolve against -- a declared blind spot, counted rather than
// silently dropped.
//
// Comments are stripped HERE rather than left to the caller. The strip is
// idempotent, so `run_scan` doing it once per file costs one extra pass on
// aliasing files and no caller of the export can forget it -- including the
// negative control, whose real-corpus denominator would otherwise count prose.
export const collect_alias_sites = ({ relative_path, source: raw_source }) => {
  const source = strip_comments(raw_source)
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

// The other half of SPLIT PRODUCERS: a producer of the same column that does
// NOT alias it back. Restricted to projection context, because a bare
// `rosters_players.roster_id` inside `groupBy(...)` is not a producer.
//
// THE BARE SIDE MUST READ EVERY SHAPE THE ALIAS SIDE READS. It matched only
// QUALIFIED `'table.column'` literals until 2026-08-06, so a `select('*')`
// producer and an unqualified `select('widget_salary')` producer both
// contributed nothing -- the finding was classed UNIFORM ("correct today") with
// an empty bare-producer list, telling the reviewer every producer aliases back
// when one does not. That is the `transactions.value` shape itself, and the
// wildcard case is the one league CLAUDE.md already documents as gate 2's
// silent defect. Three shapes now count:
//
//   qualified     'widgets.widget_salary'
//   unqualified   'widget_salary', resolved against the enclosing statement
//   wholesale     '*' or 'widgets.*', which projects every column of the table
//
// A wholesale site names no column, so it is a bare producer of EVERY column of
// its table and is matched by table alone at classification time.
const collect_bare_projections = ({
  relative_path,
  source,
  statement_spans,
  alias_sites
}) => {
  const projection_spans = collect_projection_spans(source)

  // A statement that aliases the column back is not a bare producer of it, even
  // when it also wildcards -- `libs-server/get-roster.mjs:48` writes
  // `.select('*', 'player_position as pos', 'roster_id as rid')`, whose row
  // carries BOTH names, so counting it against itself would report every such
  // producer as split with itself.
  const span_of = (index) => {
    const span = statement_spans.find(
      (entry) => index >= entry.start && index < entry.end
    )
    return span ? `${span.start}:${span.end}` : null
  }
  // (table.column) pairs aliased back within each statement span.
  const aliased_by_span = new Map()
  for (const site of alias_sites) {
    if (!site.table) continue
    const span_key = span_of(site.index)
    if (!aliased_by_span.has(span_key)) aliased_by_span.set(span_key, new Set())
    aliased_by_span.get(span_key).add(`${site.table}.${site.new_column}`)
  }
  const aliased_pairs_at = (index) =>
    aliased_by_span.get(span_of(index)) || new Set()

  const sites = []

  WILDCARD_RE.lastIndex = 0
  let match
  while ((match = WILDCARD_RE.exec(source)) !== null) {
    if (!in_projection(projection_spans, match.index)) continue
    const table = match[1] || table_at(statement_spans, match.index)
    if (!table) continue
    // A wholesale site names no column, so which pairs it is suppressed for is
    // decided at classification time against the pairs its own statement
    // aliases back.
    sites.push({
      table,
      column: null,
      aliased_pairs: aliased_pairs_at(match.index),
      file: relative_path,
      line: line_of(source, match.index)
    })
  }

  BARE_RE.lastIndex = 0
  while ((match = BARE_RE.exec(source)) !== null) {
    if (!in_projection(projection_spans, match.index)) continue
    const [, first, second] = match
    const table = second ? first : table_at(statement_spans, match.index)
    const column = second || first
    if (!table) continue
    if (aliased_pairs_at(match.index).has(`${table}.${column}`)) continue
    sites.push({
      table,
      column,
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
    // Stripped rather than line-filtered: a trailing `// reads .salary` comment
    // is not a read site, and a line-leading test cannot see one.
    const lines = strip_comments(read_file(file)).split('\n')
    lines.forEach((line, index) => {
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
    const source = strip_comments(read_file(file))
    const statement_spans = collect_statement_spans(source)
    const sites = has_alias_literal.test(source)
      ? collect_alias_sites({ relative_path, source })
      : []
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
    // A file with no alias literal can still hold bare projections.
    bare_projections.push(
      ...collect_bare_projections({
        relative_path,
        source,
        statement_spans,
        alias_sites: sites
      })
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

  // A bare producer of the same (table, new column) that aliases nothing. A
  // WHOLESALE producer names no column, so it is indexed by table and resolved
  // per column below -- minus the columns its own statement aliases back.
  const bare_by_pair = new Map()
  const wholesale_by_table = new Map()
  for (const site of bare_projections) {
    if (site.column === null) {
      if (!wholesale_by_table.has(site.table))
        wholesale_by_table.set(site.table, [])
      wholesale_by_table.get(site.table).push(site)
      continue
    }
    const key = `${site.table}.${site.column}`
    if (!bare_by_pair.has(key)) bare_by_pair.set(key, [])
    bare_by_pair.get(key).push(site)
  }

  const bare_producers_of = ({ table, column }) => [
    ...(bare_by_pair.get(`${table}.${column}`) || []),
    ...(wholesale_by_table.get(table) || []).filter(
      (site) => !site.aliased_pairs.has(`${table}.${column}`)
    )
  ]

  // Auditability note context: does the old name survive on ANOTHER table?
  const surviving_tables = (old_column) =>
    [...current_tables]
      .filter(([, columns]) => columns.has(old_column))
      .map(([table]) => table)

  const findings = residue.map((site) => {
    const bare_producers = bare_producers_of({
      table: site.table,
      column: site.new_column
    })
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
        (producer) =>
          `${producer.file}:${producer.line}` +
          (producer.column === null ? ' [wholesale]' : '')
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
// An entry that no longer suppresses anything is itself a FINDING -- but only
// when this run's base ref actually searched for it, which is the distinction
// `classify_unused_adjudications` draws. A repaired site forces its entry out
// rather than leaving a standing exemption for the name; a base ref that never
// covered the entry's rename says nothing about it either way.
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

// AN UNUSED ENTRY IS ONLY STALE IF THE GATE ACTUALLY LOOKED FOR IT. This
// classified every `used === 0` entry as STALE unconditionally until 2026-08-07,
// which made staleness a property of the CALLER'S BASE REF rather than of the
// tree. The whole candidate list is derived from the schema diff, so an entry
// whose `(table, column)` is outside this run's lost set could never have been
// exercised: the gate never searched for that site, found nothing because it
// never looked, and then reported the entry with the remedy "the site is gone,
// so the entry must go too". Measured on the real corpus, the split was total
// and had nothing to do with the code -- at `--base 62ca45544` (243 lost columns)
// all 15 entries were used and the gate was OK, while at `--base 8f1abd79d~1`
// (27 lost columns) and `--base c801b5a11` (0) all 15 read as stale. Acting on
// that output deletes live, load-bearing suppressions: every one of those sites
// is present in the working tree, including
// `scripts/process-projections-for-league-format.mjs:212`, whose own comment
// says the alias is load-bearing and whose unaliased form wiped a year of
// projection values in `72346e579`.
//
// So the two cases are separated. IN the lost set with no site means the gate
// searched and found nothing -- STALE, and a finding, because a repaired site
// must force its entry out rather than leave a standing exemption for the name.
// OUTSIDE it means NOT EXERCISED: no verdict, counted and printed so a run
// cannot read as full coverage of the adjudication file when it covered none
// of it.
export const classify_unused_adjudications = ({
  adjudications,
  lost_columns
}) => {
  const was_searched_for = (entry) => {
    const lost = lost_columns.get(entry.table)
    return Boolean(lost && lost.has(entry.column))
  }
  const unused = adjudications.filter((entry) => entry.used === 0)
  return {
    stale: unused.filter(was_searched_for).map((entry) => ({
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
      reason: `adjudication for ${entry.table}.${entry.column} at ${entry.file} suppresses nothing, and ${entry.column} IS in this run's lost-column set -- the gate searched for the site and did not find it, so the entry must go too`
    })),
    not_exercised: unused.filter((entry) => !was_searched_for(entry))
  }
}

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

// The bare side must read every shape the alias side reads. Each of these three
// was invisible to it until 2026-08-06, so an aliased producer paired with any
// of them reported UNIFORM -- "every producer aliases back" -- over a tree where
// one does not.
const CONTROL_WHOLESALE_PRODUCER = `
import db from '#db'
export const get_all_widgets = () => db('widgets').select('*')
`

const CONTROL_UNQUALIFIED_BARE_PRODUCER = `
import db from '#db'
export const get_some_widgets = () => db('widgets').select('widget_salary')
`

// get-roster.mjs's real shape: one statement that wildcards AND aliases back.
// The row carries both names, so it is not a divergent producer and must not be
// counted against itself -- the over-fire the wholesale rule could easily cause.
const CONTROL_WHOLESALE_AND_ALIAS_PRODUCER = `
import db from '#db'
export const get_roster = () =>
  db('widgets').select('*', 'widget_salary as salary')
`

// The imperative builder: one knex statement across two JS statements.
const CONTROL_IMPERATIVE_PRODUCER = `
import db from '#db'
export const get_widgets_imperatively = () => {
  const query = db('widgets')
  query.where({ uid: 1 })
  query.select('widget_salary as salary')
  return query
}
`

// Prose ABOUT an alias is not an alias site. This is the exact shape that made
// four keys permanently unreportable in check-saved-view-param-coverage.
const CONTROL_COMMENT_PROSE = `
import db from '#db'
// historical note: this used to read 'widgets.widget_salary as salary'
/* and in block form: 'widgets.widget_salary as salary' */
export const get_widgets = () => db('widgets').select('widgets.uid')
`

// A commented-out db() call must not mint a phantom statement span. The span
// sort is innermost-wins, so a short phantom beats the real enclosing statement
// and resolves this live alias to `gizmos` -- dropping it from the scan.
const CONTROL_PHANTOM_SPAN_PRODUCER = `
import db from '#db'
export const get_widgets = () =>
  db('widgets')
    // superseded: db('gizmos')
    .select('widget_salary as salary')
`

// The fast path was case-sensitive while the alias regexes are /i.
const CONTROL_UPPERCASE_ALIAS_PRODUCER = `
import db from '#db'
export const get_widgets = () =>
  db('widgets').select('widgets.widget_salary AS salary')
`

// The synthetic cases, plus the real-corpus denominator cases that keep them
// from going vacuous. A case that stops failing fails the whole run.
//
// Eleven of these were PROVEN RED at the pre-fix revision `23269028b` before
// the fix that makes them green was written, using a synthetic `run_scan` with
// an injected `read_file` -- the same rig the control uses. A fix whose test was
// never red proves nothing, and this gate's own adversarial review found nine
// defects behind an all-green control precisely because the control asserted
// existence rather than behaviour.
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

  // 3c. THE WHOLESALE BARE PRODUCER. A `select('*')` producer aliases nothing,
  //     so the finding is SPLIT PRODUCERS -- and it read UNIFORM ("correct
  //     today", empty bare-producer list) until 2026-08-06. This case goes red
  //     the moment the bare side stops seeing wildcards.
  {
    const files = [
      synthetic_path('aliased.mjs'),
      synthetic_path('wholesale.mjs')
    ]
    const sources = {
      [files[0]]: CONTROL_ALIASED_PRODUCER,
      [files[1]]: CONTROL_WHOLESALE_PRODUCER
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
      "a select('*') producer makes the finding SPLIT PRODUCERS, not UNIFORM",
      Boolean(reported) && reported.finding_class === 'SPLIT PRODUCERS'
    ])
  }

  // 3d. The UNQUALIFIED bare producer, the second shape the bare side could not
  //     see while the alias side could.
  {
    const files = [
      synthetic_path('aliased.mjs'),
      synthetic_path('unqualified-bare.mjs')
    ]
    const sources = {
      [files[0]]: CONTROL_ALIASED_PRODUCER,
      [files[1]]: CONTROL_UNQUALIFIED_BARE_PRODUCER
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
      'an unqualified bare producer makes the finding SPLIT PRODUCERS',
      Boolean(reported) && reported.finding_class === 'SPLIT PRODUCERS'
    ])
  }

  // 3e. The other direction, which the two above make easy to break: a
  //     statement that wildcards AND aliases back is ONE producer carrying both
  //     names, not a producer split against itself.
  {
    const files = [synthetic_path('wholesale-and-alias.mjs')]
    const sources = { [files[0]]: CONTROL_WHOLESALE_AND_ALIAS_PRODUCER }
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
      'a statement that wildcards AND aliases back is not its own bare producer',
      Boolean(reported) && reported.finding_class !== 'SPLIT PRODUCERS'
    ])
  }

  // 3f. The imperative builder. Reported NOTHING AT ALL before 2026-08-06 --
  //     not a misclassification, a total miss.
  {
    const files = [synthetic_path('imperative.mjs')]
    const sources = { [files[0]]: CONTROL_IMPERATIVE_PRODUCER }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    cases.push([
      'an imperative builder alias-back resolves its table and is reported',
      findings.some(
        (finding) => finding.table === 'widgets' && finding.column === 'salary'
      )
    ])
  }

  // 3g. Comment prose is not an alias site, and a commented-out db() does not
  //     mint a phantom span that steals a live alias's table.
  {
    const files = [synthetic_path('prose.mjs')]
    const sources = { [files[0]]: CONTROL_COMMENT_PROSE }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    cases.push([
      'an alias literal inside a comment is not an alias site',
      findings.length === 0
    ])
  }

  {
    const files = [synthetic_path('phantom.mjs')]
    const sources = { [files[0]]: CONTROL_PHANTOM_SPAN_PRODUCER }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    cases.push([
      'a commented-out db() call does not mint a phantom statement span',
      findings.some(
        (finding) => finding.table === 'widgets' && finding.column === 'salary'
      )
    ])
  }

  // 3h. The fast path is case-insensitive, matching the alias regexes.
  {
    const files = [synthetic_path('uppercase.mjs')]
    const sources = { [files[0]]: CONTROL_UPPERCASE_ALIAS_PRODUCER }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    cases.push([
      'an uppercase AS alias is not skipped by the fast path',
      findings.some(
        (finding) => finding.table === 'widgets' && finding.column === 'salary'
      )
    ])
  }

  // 3i. A partitioned parent parses, and its first child is a table of its own.
  //     Six tables were absent from the parsed map before this, which makes
  //     every alias against them fail the discriminator silently.
  {
    const parsed = parse_schema(`
CREATE TABLE public.control_parent (
    esbid integer NOT NULL,
    season_year smallint
)
PARTITION BY RANGE (season_year);

CREATE TABLE public.control_parent_default (
    esbid integer NOT NULL,
    season_year smallint
);
`)
    cases.push([
      'a PARTITION BY parent parses and does not swallow its first child',
      Boolean(
        parsed.get('control_parent') &&
          parsed.get('control_parent').has('season_year') &&
          parsed.get('control_parent_default')
      )
    ])
  }

  // 3j. The registry filter excludes the registry and NOTHING ELSE. The
  //     load-bearing exclusion must keep working while a real db() emitter
  //     living under a data-views path must be scanned.
  {
    const registry_file = path.join(
      repo_root,
      'libs-server/data-views-column-definitions/player-adp-column-definitions.mjs'
    )
    const emitter_file = path.join(
      repo_root,
      'libs-server/data-views/add-defensive-play-by-play-with-statement.mjs'
    )
    const scan_one = (file) =>
      run_scan({
        lost_columns: control_lost,
        current_tables: control_current,
        producer_files: [file],
        read_file: control_reader({ [file]: CONTROL_ALIASED_PRODUCER })
      }).findings
    cases.push([
      'the column-definitions registry stays excluded (load-bearing)',
      scan_one(registry_file).length === 0
    ])
    cases.push([
      'a real db() emitter under a data-views path is scanned',
      scan_one(emitter_file).length === 1
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

  // 4b. STALENESS IS A PROPERTY OF THE TREE, NOT OF THE CALLER'S BASE REF.
  //     Three cases, and the FIRST is the one that matters -- without it a fix
  //     for the false positive is indistinguishable from deleting the check.
  //
  //     A PLANTED entry whose (table, column) IS in the lost set and which
  //     suppresses nothing must STILL be reported STALE: the gate genuinely
  //     searched for that site and did not find it, which is the whole reason
  //     the class exists. The complement is the false positive itself -- an
  //     entry outside the lost set was never searched for, so it is NOT
  //     EXERCISED rather than stale, and reporting it as stale told a reviewer
  //     to delete a live suppression. Both directions are asserted here because
  //     each one alone is satisfiable by a gate that has stopped working.
  {
    const planted = {
      table: 'widgets',
      column: 'salary',
      file: synthetic_path('never-existed.mjs'),
      verdict: 'planted',
      reason: 'synthetic control entry, suppresses nothing by construction',
      used: 0
    }
    const { stale, not_exercised } = classify_unused_adjudications({
      adjudications: [planted],
      lost_columns: control_lost
    })
    cases.push([
      'a planted adjudication IN the lost set with no site is still reported STALE',
      stale.length === 1 &&
        stale[0].finding_class === 'STALE ADJUDICATION' &&
        stale[0].table === 'widgets' &&
        stale[0].column === 'salary' &&
        not_exercised.length === 0
    ])
  }

  {
    const planted = {
      table: 'widgets',
      column: 'salary',
      file: synthetic_path('never-existed.mjs'),
      used: 0
    }
    const { stale, not_exercised } = classify_unused_adjudications({
      adjudications: [planted],
      lost_columns: new Map()
    })
    cases.push([
      'the same entry is NOT EXERCISED, not stale, when the base ref lost no such column',
      stale.length === 0 && not_exercised.length === 1
    ])
  }

  //     And an entry that DID suppress a finding is neither. This is what keeps
  //     the two lists above from being satisfied by a classifier that ignores
  //     `used` entirely.
  {
    const files = [synthetic_path('aliased.mjs')]
    const sources = { [files[0]]: CONTROL_ALIASED_PRODUCER }
    const { findings } = run_scan({
      lost_columns: control_lost,
      current_tables: control_current,
      producer_files: files,
      read_file: control_reader(sources)
    })
    const adjudications = [
      {
        table: 'widgets',
        column: 'salary',
        file: path.relative(repo_root, files[0]),
        verdict: 'keep-aliased',
        reason: 'synthetic control entry that suppresses a real finding',
        used: 0
      }
    ]
    const applied = apply_adjudications(findings, adjudications)
    const { stale, not_exercised } = classify_unused_adjudications({
      adjudications,
      lost_columns: control_lost
    })
    cases.push([
      'an adjudication that suppresses a finding is neither stale nor not-exercised',
      applied.length === 1 &&
        applied[0].adjudicated === true &&
        stale.length === 0 &&
        not_exercised.length === 0
    ])
  }

  // 5, 6 and 7. DENOMINATOR against the REAL corpus. The synthetic cases above
  //    all pass over a corpus that stopped being walked or an extractor that
  //    stopped matching, so these state the denominator directly, anchored on
  //    ALL alias literals rather than on residue -- residue goes to zero when
  //    the tree is clean, which is the success state, not a blindness.
  //
  //    The first two asserted only `> 0` until 2026-08-06, and their count
  //    included COMMENT PROSE: `scripts/process-projections-for-league-format.mjs`
  //    discusses its own alias in backticks twice, so the denominator could have
  //    been carried entirely by prose while the extractor had stopped matching
  //    real code. The third case is what closes that -- it measures the corpus
  //    with comments left IN and requires the stripped count to be strictly
  //    lower, so the strip is proven to be doing work on real files rather than
  //    asserted. Both halves fail if either the walk or the strip breaks.
  {
    let qualified = 0
    let unqualified = 0
    let unstripped_literals = 0
    for (const file of walk_files(SERVER_ROOTS, ['.mjs', '.js'])) {
      const raw_source = fs.readFileSync(file, 'utf8')
      if (!has_alias_literal.test(raw_source)) continue
      const relative_path = path.relative(repo_root, file)
      for (const site of collect_alias_sites({
        relative_path,
        source: raw_source
      })) {
        if (site.anchor === 'qualified') qualified += 1
        else unqualified += 1
      }
      // `collect_alias_sites` strips; count the raw source separately by
      // re-inserting nothing and running the same regexes over it.
      unstripped_literals += count_alias_literals(raw_source)
    }
    const stripped_literals = qualified + unqualified
    cases.push([
      `the extractor still finds qualified alias literals in real CODE (${qualified})`,
      qualified > 0
    ])
    cases.push([
      `the extractor still finds unqualified alias literals in real CODE (${unqualified})`,
      unqualified > 0
    ])
    cases.push([
      `comment prose is excluded from the real corpus denominator ` +
        `(${unstripped_literals} raw, ${stripped_literals} in code)`,
      unstripped_literals > stripped_literals
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
    // No DEFAULT. `origin/master` was one, and against it the schema diff is
    // empty by construction: zero lost columns, therefore zero residue,
    // therefore no adjudication exercised and nothing said about the tree. A
    // gate with no base ref cannot run, which is the same exit 2 an
    // unresolvable ref gets.
    .option('base', {
      type: 'string',
      describe: 'git ref to diff the schema against (REQUIRED)'
    })
    .option('json', { type: 'boolean', default: false })
    .option('unadjudicated', {
      type: 'boolean',
      default: false,
      describe: 'report only findings no adjudication covers'
    })
    .parse()

  if (!argv.base) {
    console.error(
      'GATE ERROR: --base is required. This gate derives its whole candidate ' +
        'list from the schema diff, so with no base ref there are no lost ' +
        'columns, no residue, and every adjudication reads as stale. Give it ' +
        'the pre-cluster revision.'
    )
    return 2
  }

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
  const applied = apply_adjudications(scan.findings, adjudications)
  const { stale, not_exercised } = classify_unused_adjudications({
    adjudications,
    lost_columns
  })
  const findings = [...applied, ...stale]
  const unadjudicated = findings.filter((finding) => !finding.adjudicated)
  const reported = argv.unadjudicated ? unadjudicated : findings

  if (argv.json) {
    console.log(
      JSON.stringify(
        {
          ...scan,
          findings,
          not_exercised_adjudications: not_exercised.map((entry) => ({
            table: entry.table,
            column: entry.column,
            file: entry.file
          }))
        },
        null,
        2
      )
    )
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
      `${findings.length} finding(s), ${unadjudicated.length} unadjudicated`
    )
    // A run whose base ref covers none of the adjudication file's renames has
    // searched for none of its entries. Printed rather than silent, so the run
    // cannot read as coverage of a file it did not exercise.
    console.log(
      `${adjudications.length} adjudication(s), ${not_exercised.length} NOT EXERCISED ` +
        `by this base ref (their column is not in this run's lost-column set, so ` +
        `the gate never searched for the site -- no verdict, and NOT stale)\n`
    )
    for (const entry of not_exercised)
      console.log(
        `  [NOT EXERCISED] ${entry.table}.${entry.column}  ${entry.file}`
      )
    if (not_exercised.length) console.log('')

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

// Everything under `db/` is run by hand from a RELATIVE path, and `is_main`
// compares `process.argv[1]` VERBATIM against the resolved module path -- so an
// `is_main` guard here would silently do nothing and exit 0, the failure the
// sibling gates avoid by calling `main()` bare. But bare means importing any of
// the exported functions runs the whole gate and sets `process.exitCode = 1`,
// so no harness and no spec can import this file cleanly.
//
// Both are the same defect: `is_main` compares an UNRESOLVED path. Resolving
// BOTH sides through `realpathSync` removes the reason `is_main` fails here,
// so `node db/gates/check-rename-alias-residue.mjs` runs and an import does
// not. Anything that cannot be resolved is treated as not-direct rather than
// guessed at, and the negative control pins the relative-invocation case.
const is_direct_invocation = () => {
  if (!process.argv[1]) return false
  try {
    return (
      fs.realpathSync(path.resolve(process.argv[1])) ===
      fs.realpathSync(fileURLToPath(import.meta.url))
    )
  } catch {
    return false
  }
}

if (is_direct_invocation()) process.exitCode = main()
