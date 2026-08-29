// Gate: every league-scoped table is cleared by the per-league test fixture.
//
// THE INCIDENT CLASS. `db/fixtures/reset-league-tables.mjs` resets per-league
// test state by naming each table explicitly. A table added later and not added to that list
// keeps its rows across spec FILES, because nothing else clears them -- the
// fixture is the only thing that does, and `test/global.mjs` drops tables once
// per RUN, not per file. It has produced two incidents:
//
//   2026-08-02  a new restricted-free-agency table's omission made
//               teams.restricted-free-agency fail only in full-suite order,
//               and turned master red.
//   2026-08-13  league_pauses (the pause primitive) was omitted. Latent rather
//               than firing, because test/league-pause.spec.mjs happens to
//               clean up after itself in both a beforeEach and an after.
//
// Both are the same bug: a human has to remember to edit a list. That is what
// this gate replaces. Note the second one shows why an EMPIRICAL residue check
// (run the suite, look for leftover rows) is the wrong oracle -- league_pauses
// left no residue and such a check would have been green over it. The defect is
// a missing list entry, so the list is what has to be checked.
//
// WHAT "LEAGUE-SCOPED" MEANS, AND WHY IT IS NOT OBVIOUS. Three rules that each
// look right are each wrong, and they were measured against this schema before
// the derivation below was chosen:
//
//   An FK-WALK from `leagues` is structurally impossible here. This schema has
//   exactly TWO foreign keys referencing `leagues`, and none at all between the
//   trade/waiver/poach child tables and their parents. league_pauses carries a
//   bare `league_id integer NOT NULL` with no FK whatsoever, so the very table
//   the 2026-08-13 incident was about is invisible to an FK-walk.
//
//   A COLUMN-NAME rule alone over-fires. 46 tables carry lid/league_id/tid/
//   team_id and, when this was measured, only 20 were in the reset list; the
//   fixture deliberately does not clear the derived analytics tables. A gate that fires on tables
//   nobody should reset is worse than no gate, because it will be silenced.
//
//   REACHING ONLY THE DIRECTLY-SCOPED TABLES under-fires. 4 of the reset list's
//   entries (waiver_releases, poach_releases, trades_transactions,
//   restricted_free_agency_releases) carry no league or team column at all --
//   they are scoped through a parent ROW ID.
//
// So the derivation is a fixed point over the committed schema, and the two
// halves pull in opposite directions on purpose:
//
//   TIER 1 (direct)      a column named lid / league_id / tid / team_id.
//                        `teams` is itself per-league and the fixture deletes
//                        every row of it, so team-scoped IS league-scoped.
//   TIER 2 (transitive)  a column <X>id or <X>_id where <X> singularizes to a
//                        table already classified league-scoped.
//
// Tier 2 adds exactly the 4 child tables above and nothing else -- measured
// across all 286 tables, zero other matches. That is not luck to rely on
// silently, so a control asserts both that it FINDS them and that it stays
// SILENT on a table it must not claim (see the controls at the bottom: half of
// what this gate does is decide a table is NOT in scope).
//
// THE VERDICT. Every league-scoped table must be one of:
//   - named in the fixture's reset list, or
//   - cascade-cleared, derived from the schema: an ON DELETE CASCADE foreign
//     key to a table the reset list itself deletes, or
//   - adjudicated, with a required reason, in the file beside this one.
//
// WHAT THIS GATE DOES NOT CHECK, stated because the reset list mixes concerns
// and a reader will assume otherwise: it checks MEMBERSHIP only. The list is
// ORDERED, and its own comments explain that some entries are placed where they
// are so that rows are cleared before a sequence hands their ids out again.
// Nothing here validates that ordering, the sequence restarts, or the deletes
// the fixture performs for reasons other than league scope (player_gamelogs and
// practice are not league-scoped and are cleared for global test isolation).
//
// ADJUDICATION, AND WHY IT IS NOT A NAME FILTER. A finding is repaired by
// adding the table to the fixture, or recorded in
// league-fixture-reset-adjudications.json keyed on the TABLE with a required
// prose reason. It cannot decay into a stoplist of names, because:
//   - an adjudication that suppresses nothing is itself a finding (the table is
//     now reset, or no longer scoped, or gone from the schema), and
//   - each entry records the roots that WRITE the table, verified every run. A
//     table adjudicated as "no suite-reachable writer" that gains an insert
//     site in api/ or libs-server/ is reported, because the reasoning the entry
//     rests on has changed underneath it.
// That second rule is what keeps the reasons from rotting silently. It is
// deliberately a recorded FACT rather than a reachability analysis: a shallow
// import-graph walk would fail toward green, which is the direction this
// codebase's gates keep failing in.
//
// CI: yes. It reads the committed schema and the committed fixture, needs no
// base ref and no database, and answers in well under a second. It CAN go red
// on a table a sibling adds -- that is the gate working, and it is the same
// disposition as check-schema-conformance-ratchet, which is in CI for the same
// reason. The in-flight-migration objection that keeps the other gates out does
// not apply: those diff against a base ref or read production, while both
// inputs here land in the same commit under this repo's own one-commit rule for
// DDL plus schema export plus dependent code.

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  format_corpus,
  resolve_corpus,
  verdict_suffix
} from './scan-corpus.mjs'

const gate_dir = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(gate_dir, '..', '..')
const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')
// The single shared reset list. It was split across league.mjs and user.mjs
// until 2026-08-14, and the two had drifted seventeen tables apart -- this
// gate's own class of defect, duplicated, with no gate on the second copy.
const fixture_path = path.join(
  repo_root,
  'db',
  'fixtures',
  'reset-league-tables.mjs'
)
const adjudications_path = path.join(
  gate_dir,
  'league-fixture-reset-adjudications.json'
)

// A column that scopes a row to one league, or to one team (and every team
// belongs to exactly one league, so a team-scoped row is league-scoped). These
// four are the vocabulary this schema actually uses; both spellings of each are
// live, which is why the pair is listed rather than a pattern being guessed.
const DIRECT_SCOPE_COLUMNS = new Set(['lid', 'league_id', 'tid', 'team_id'])

// The roots whose insert sites are recorded per adjudication. `private` is
// included because it holds real writers and is in no other gate's corpus.
const WRITER_ROOTS = ['api', 'libs-server', 'scripts', 'jobs', 'private']

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// The column list ends at a `)` in column ZERO, and what follows it is a TAIL
// clause -- `WITH (...)` storage parameters, or `PARTITION BY RANGE (...)` --
// before the statement's semicolon. Terminating on `\n);` instead treats a
// tailed table as unterminated: the non-greedy body runs on to the NEXT table's
// `\n);`, so the tailed table is recorded under its own name with its
// SUCCESSOR's columns, and the successor is not recorded at all.
//
// That is not hypothetical and it is not a partitioning-only concern. Six
// partitioned parents carried a tail for as long as they have been partitioned,
// each silently swallowing its first partition, and the gate stayed green
// because none of the seven pairs mattered. It went red the day a `WITH (...)`
// landed on keeptradecut_valuations, whose successor is league_baselines: the
// gate then reported keeptradecut_valuations as league-scoped via an `lid` it
// does not have, and league_baselines as absent from a schema that defines it.
// Two findings, both false, from one unanchored terminator.
/**
 * The tables `source` DECLARES, counted independently of `parse_schema`. The
 * two disagreeing means the parser dropped one, which is the only way this gate
 * can narrow its own subject without saying so.
 */
export const declared_table_names = (source) =>
  [...source.matchAll(/^CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/gm)].map(
    (match) => match[1]
  )

export const unparsed_tables = ({ source, tables }) =>
  declared_table_names(source).filter((table) => !(table in tables))

export const parse_schema = (source) => {
  const tables = {}
  const table_re =
    /CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)\s*\(([\s\S]*?)\n\)[^;]*;/g
  let match
  while ((match = table_re.exec(source)) !== null) {
    const [, table, body] = match
    tables[table] = body
      .split('\n')
      .map((line) => line.trim().replace(/,$/, ''))
      .filter(Boolean)
      .filter(
        (line) =>
          !/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK|EXCLUDE)\b/i.test(
            line
          )
      )
      .map((line) => line.replace(/^"?(\w+)"?.*$/, '$1'))
      .filter(Boolean)
  }
  return tables
}

/**
 * Foreign keys carrying ON DELETE CASCADE, as { table, references }. Only the
 * cascading ones matter: a plain FK does not clear anything.
 */
export const parse_cascade_edges = (source) => {
  const edges = []
  const re =
    /ALTER TABLE ONLY public\.(\w+)[\s\S]{0,200}?ADD CONSTRAINT \w+ FOREIGN KEY \([^)]+\) REFERENCES public\.(\w+)\([^)]+\)([^;]*);/g
  let match
  while ((match = re.exec(source)) !== null) {
    const [, table, references, tail] = match
    if (/ON DELETE CASCADE/i.test(tail)) edges.push({ table, references })
  }
  return edges
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Table names a `<X>id` / `<X>_id` column could be referring to. */
const referent_candidates = (column) => {
  const out = []
  for (const suffix of ['_id', 'id']) {
    if (!column.endsWith(suffix)) continue
    const base = column.slice(0, -suffix.length)
    if (!base) continue
    out.push(base, `${base}s`, `${base}es`)
  }
  return out
}

/**
 * Fixed point: tier 1 seeds on a direct scoping column, tier 2 propagates
 * through a column naming an already-scoped table's row id.
 */
export const classify_league_scoped = ({ tables }) => {
  const scoped = new Map()
  for (const [table, columns] of Object.entries(tables)) {
    const hit = columns.find((c) => DIRECT_SCOPE_COLUMNS.has(c))
    if (hit) scoped.set(table, { tier: 'direct', via: hit })
  }

  let changed = true
  while (changed) {
    changed = false
    for (const [table, columns] of Object.entries(tables)) {
      if (scoped.has(table)) continue
      for (const column of columns) {
        const referent = referent_candidates(column).find(
          (name) => name !== table && scoped.has(name)
        )
        if (referent) {
          scoped.set(table, { tier: 'transitive', via: column, referent })
          changed = true
          break
        }
      }
    }
  }
  return scoped
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

/**
 * The tables the fixture deletes, in source order. Anchored on the `.del()`
 * call rather than on a table-name list, so the gate cannot be fooled by a
 * table named in a comment -- this repo has already had a gate blinded exactly
 * that way (check-saved-view-param-coverage tokenized comments, and the comment
 * documenting an incident made that incident unreportable).
 */
export const parse_reset_list = (source) => {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const out = []
  const re = /(?:knex|db|trx)\(\s*['"](\w+)['"]\s*\)\s*\.del\(\)/g
  let match
  while ((match = re.exec(stripped)) !== null) out.push(match[1])
  return out
}

// ---------------------------------------------------------------------------
// Writer roots
// ---------------------------------------------------------------------------

const walk = async (dir, out = []) => {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out)
    else if (/\.(mjs|js)$/.test(entry.name)) out.push(full)
  }
  return out
}

/**
 * Which roots hold an INSERT site for each table. A recorded fact, compared
 * against what each adjudication was reasoned against -- not a reachability
 * claim, and deliberately not one.
 */
export const find_writer_roots = async ({ tables, root_dir = repo_root }) => {
  const by_table = new Map(tables.map((t) => [t, new Set()]))
  for (const root of WRITER_ROOTS) {
    const files = await walk(path.join(root_dir, root))
    for (const file of files) {
      let source
      try {
        source = await fs.readFile(file, 'utf8')
      } catch {
        continue
      }
      for (const table of tables) {
        if (!source.includes(`'${table}'`) && !source.includes(`"${table}"`))
          continue
        // Any identifier, not just db/knex/trx. A builder is routinely held in
        // a local (`const query = db.transaction(...)`, then
        // `query('player_team_extension_state').insert(...)`), and anchoring on
        // the three familiar names missed exactly that site -- which then read
        // as "this table has no writer at all". The `.insert(` requirement is
        // what keeps the wider match precise.
        const builder = new RegExp(`\\w+\\(\\s*['"]${table}['"]\\s*\\)`, 'g')
        let match
        let found = false
        while (!found && (match = builder.exec(source)) !== null) {
          if (
            /\.insert\s*\(/.test(source.slice(match.index, match.index + 600))
          )
            found = true
        }
        if (
          !found &&
          new RegExp(`batch_insert\\s*\\([\\s\\S]{0,200}['"]${table}['"]`).test(
            source
          )
        )
          found = true
        if (found) by_table.get(table).add(root)
      }
    }
  }
  return by_table
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/**
 * Pure, so the negative controls can drive it with mutated inputs. Returns
 * findings plus the coverage denominators.
 */
export const evaluate = ({
  tables,
  cascade_edges,
  reset_list,
  adjudications,
  writer_roots
}) => {
  const findings = []
  const scoped = classify_league_scoped({ tables })
  const reset_set = new Set(reset_list)

  // Cascade closure: a table is cleared if it cascades, directly or through a
  // chain, from something the fixture deletes.
  const cascade_cleared = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const { table, references } of cascade_edges) {
      if (cascade_cleared.has(table)) continue
      if (reset_set.has(references) || cascade_cleared.has(references)) {
        cascade_cleared.add(table)
        changed = true
      }
    }
  }

  const adjudicated = new Map(
    (adjudications.tables || []).map((entry) => [entry.table, entry])
  )
  const used_adjudications = new Set()

  const uncovered = []
  for (const [table, how] of scoped) {
    if (reset_set.has(table)) continue
    if (cascade_cleared.has(table)) continue

    const entry = adjudicated.get(table)
    if (!entry) {
      uncovered.push({ table, how })
      const writers = [...(writer_roots.get(table) || [])].sort()
      findings.push(
        `${table} is league-scoped (${how.tier} via ${how.via}) but the fixture ` +
          'never clears it, nothing cascades to it, and it carries no ' +
          `adjudication [insert sites in: ${writers.join(', ') || 'none'}]`
      )
      continue
    }
    used_adjudications.add(table)

    // The recorded writer roots are what the reason was reasoned against. A
    // change means the reason may no longer hold, so it is a finding rather
    // than a silent inheritance.
    const observed = [...(writer_roots.get(table) || [])].sort()
    const recorded = [...(entry.writer_roots || [])].sort()
    if (observed.join(',') !== recorded.join(',')) {
      findings.push(
        `${table} is adjudicated against writer roots [${recorded.join(', ') || 'none'}] ` +
          `but now has insert sites in [${observed.join(', ') || 'none'}] -- ` +
          're-read the reason, it may no longer hold'
      )
    }

    // A `cleared_by_other_fixture` entry must name a fixture that really does
    // clear it. Otherwise the claim is unfalsifiable.
    if (entry.cleared_by_fixture) {
      const other = entry._resolved_other_fixture_tables
      if (!other || !other.includes(table)) {
        findings.push(
          `${table} claims it is cleared by ${entry.cleared_by_fixture}, but that ` +
            'fixture does not delete it'
        )
      }
    }
  }

  // Stale adjudications. An entry that suppresses nothing must go, or it
  // becomes a standing exemption for the NAME -- which is the stoplist this
  // gate must never decay into.
  for (const [table, entry] of adjudicated) {
    if (used_adjudications.has(table)) continue
    const why = !tables[table]
      ? 'no such table in the schema'
      : !scoped.has(table)
        ? 'the table is no longer league-scoped'
        : reset_set.has(table)
          ? 'the fixture now clears it'
          : 'it cascades from a table the fixture clears'
    findings.push(
      `adjudication for ${table} suppresses nothing (${why}) -- remove it. ` +
        `Recorded reason: ${entry.reason}`
    )
  }

  // A reset-list entry naming a table the schema does not define is a stale
  // list, and it cannot be found any other way.
  for (const table of reset_list) {
    if (!tables[table]) {
      findings.push(
        `the fixture deletes '${table}', which is not a table in the schema`
      )
    }
  }

  return {
    findings,
    scoped,
    reset_set,
    cascade_cleared,
    adjudicated,
    uncovered
  }
}

/**
 * `--schema` / `--fixture` point the gate at a file other than the committed
 * one. That is what makes the POSITIVE control a single command: pointed at
 * `git show fe21b939c~1:db/fixtures/league.mjs`, a tree where league_pauses is
 * genuinely missing, the gate must report league_pauses and nothing else.
 */
const read_flag = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : process.argv[index + 1]
}

const run = async () => {
  const schema_file = read_flag('schema') || schema_path
  const fixture_file = read_flag('fixture') || fixture_path
  const schema_source = await fs.readFile(schema_file, 'utf8')
  const fixture_source = await fs.readFile(fixture_file, 'utf8')
  const adjudications = JSON.parse(
    await fs.readFile(adjudications_path, 'utf8')
  )

  const tables = parse_schema(schema_source)
  const cascade_edges = parse_cascade_edges(schema_source)
  const reset_list = parse_reset_list(fixture_source)

  if (!Object.keys(tables).length) {
    console.error('TOOLING ERROR: parsed no tables out of the schema file')
    process.exit(2)
  }

  // The parse must account for EVERY `CREATE TABLE` in the file. A non-empty
  // parse is not evidence it is complete: the terminator defect above dropped
  // seven tables while leaving 309, which reads as a healthy parse and is the
  // failure mode this gate is least able to notice from its own output. Anchor
  // on a count derived independently of the parser, so a table shape nobody
  // anticipated is a TOOLING ERROR rather than a silently narrowed subject.
  const unparsed = unparsed_tables({ source: schema_source, tables })
  if (unparsed.length) {
    console.error(
      `TOOLING ERROR: schema declares ` +
        `${declared_table_names(schema_source).length} tables but the parse ` +
        `recorded ${Object.keys(tables).length}; not parsed: ` +
        unparsed.join(', ')
    )
    process.exit(2)
  }
  if (!reset_list.length) {
    console.error('TOOLING ERROR: parsed no .del() calls out of the fixture')
    process.exit(2)
  }

  const scoped_names = [...classify_league_scoped({ tables }).keys()]
  const writer_roots = await find_writer_roots({ tables: scoped_names })

  // Resolve every `cleared_by_other_fixture` claim against the named file, so
  // the claim is checked rather than trusted.
  for (const entry of adjudications.tables || []) {
    if (!entry.cleared_by_fixture) continue
    try {
      const other = await fs.readFile(
        path.join(repo_root, entry.cleared_by_fixture),
        'utf8'
      )
      entry._resolved_other_fixture_tables = parse_reset_list(other)
    } catch {
      entry._resolved_other_fixture_tables = []
    }
  }

  const result = evaluate({
    tables,
    cascade_edges,
    reset_list,
    adjudications,
    writer_roots
  })

  // ---- Coverage ---------------------------------------------------------
  // Printed BEFORE the findings, because a gate over part of a corpus that
  // reads as full coverage is the failure mode this repo keeps hitting.
  const direct = [...result.scoped.values()].filter(
    (v) => v.tier === 'direct'
  ).length
  const transitive = result.scoped.size - direct
  const unclassified = Object.keys(tables).length - result.scoped.size
  const reset_not_scoped = reset_list.filter((t) => !result.scoped.has(t))

  // Which of WRITER_ROOTS actually existed. `private` is a submodule no
  // workflow checks out, so in CI this gate has been recording writer roots
  // over an empty directory and reporting full coverage.
  const corpus = resolve_corpus({ roots: WRITER_ROOTS, repo_root })
  console.log(format_corpus({ corpus }))
  console.log('')

  console.log('league fixture reset coverage')
  console.log(
    `  tables in the schema considered      ${Object.keys(tables).length}`
  )
  console.log(
    `  classified league-scoped             ${result.scoped.size}  (${direct} direct, ${transitive} transitive)`
  )
  console.log(
    `  NOT classified league-scoped         ${unclassified}  (no league/team column, and no column naming a scoped table's row id -- OUT OF SUBJECT, not checked)`
  )
  console.log(`  of the league-scoped tables:`)
  console.log(
    `    cleared by the fixture             ${[...result.scoped.keys()].filter((t) => result.reset_set.has(t)).length}`
  )
  console.log(
    `    cascade-cleared from the schema    ${[...result.scoped.keys()].filter((t) => !result.reset_set.has(t) && result.cascade_cleared.has(t)).length}`
  )
  console.log(
    `    adjudicated                        ${result.adjudicated.size}`
  )
  console.log(
    `    unaccounted for                    ${result.uncovered.length}`
  )
  console.log(
    `  fixture deletes not in subject       ${reset_not_scoped.length}  (${reset_not_scoped.join(', ') || 'none'})`
  )
  console.log(
    '  NOT checked: list ORDER, sequence restarts, or any delete made for a reason other than league scope'
  )

  // ---- Negative controls -------------------------------------------------
  // Always on. Three assert the gate REPORTS, two assert it stays SILENT --
  // half of what this gate does is decide a table is not in scope, and an
  // over-eager classifier fails in the direction that looks like success.
  const controls = []
  const base = { tables, cascade_edges, adjudications, writer_roots }

  // 1. The requirement from the incident itself: drop a table from the reset
  //    list in memory and confirm the gate names it.
  const victim =
    reset_list.find(
      (t) => result.scoped.has(t) && !result.cascade_cleared.has(t)
    ) || null
  if (!victim) {
    controls.push(['a reset-list entry can be withheld and reported', false])
  } else {
    const without = evaluate({
      ...base,
      reset_list: reset_list.filter((t) => t !== victim)
    })
    controls.push([
      `withholding '${victim}' from the reset list is reported`,
      without.findings.some(
        (f) => f.startsWith(`${victim} `) && f.includes('never clears it')
      )
    ])
  }

  // 2. Blanking the reset list must report EVERY scoped table that is not
  //    cascade-cleared or adjudicated. This is what proves the parse is
  //    load-bearing rather than decorative.
  const blanked = evaluate({ ...base, reset_list: [] })
  const expected_blanked = [...result.scoped.keys()].filter(
    (t) => !result.adjudicated.has(t)
  ).length
  controls.push([
    `an empty reset list reports every unadjudicated scoped table (${blanked.uncovered.length} of ${expected_blanked})`,
    blanked.uncovered.length >= expected_blanked && expected_blanked > 0
  ])

  // 3. The adjudication machinery, driven in BOTH directions with a synthetic
  //    entry. Driving it synthetically rather than by withholding a real entry
  //    is deliberate: it works on an empty adjudication file, so the control
  //    cannot quietly become vacuous the day the file is emptied -- which is
  //    exactly when it matters most. Without this, "no findings" and "cannot
  //    see findings" are indistinguishable, a distinction a gate in this repo
  //    has already failed once.
  if (!victim) {
    controls.push([
      'an adjudication suppresses, and a stale one is caught',
      false
    ])
  } else {
    const synthetic = {
      table: victim,
      reason: 'synthetic control entry -- never written to disk',
      writer_roots: [...(writer_roots.get(victim) || [])].sort()
    }
    const withheld_list = reset_list.filter((t) => t !== victim)

    // Suppresses when it should: the table is uncovered, the entry covers it.
    const suppressed = evaluate({
      ...base,
      reset_list: withheld_list,
      adjudications: { tables: [synthetic] }
    })
    const it_suppressed = !suppressed.findings.some(
      (f) => f.startsWith(`${victim} `) && f.includes('carries no adjudication')
    )

    // Reported as stale when it should be: the table is back in the reset
    // list, so the entry suppresses nothing and must not survive as a
    // standing exemption for the NAME.
    const stale = evaluate({
      ...base,
      reset_list,
      adjudications: { tables: [synthetic] }
    })
    const it_went_stale = stale.findings.some(
      (f) =>
        f.includes(`adjudication for ${victim} suppresses nothing`) &&
        f.includes('the fixture now clears it')
    )

    controls.push([
      `a synthetic adjudication for '${victim}' suppresses its finding, and is reported stale once the fixture clears it again`,
      it_suppressed && it_went_stale
    ])

    // 3b. The writer-roots ratchet: an entry reasoned against a different set
    //     of insert sites must be reported, or the reasons rot silently.
    const drifted = evaluate({
      ...base,
      reset_list: withheld_list,
      adjudications: {
        tables: [{ ...synthetic, writer_roots: ['a-root-that-does-not-exist'] }]
      }
    })
    controls.push([
      `a drifted writer-roots record on '${victim}' is reported`,
      drifted.findings.some(
        (f) => f.startsWith(`${victim} `) && f.includes('re-read the reason')
      )
    ])
  }

  // 4. SILENCE: a table with no scoping column must not be claimed. `player`
  //    is the one every over-eager rule reaches for, and it is not per-league.
  const scoped_wrongly = ['player', 'nfl_games', 'nfl_plays'].filter((t) =>
    tables[t] ? result.scoped.has(t) : false
  )
  controls.push([
    'the classifier stays SILENT on player / nfl_games / nfl_plays',
    scoped_wrongly.length === 0
  ])

  // 5. SILENCE + REACH on tier 2 together. It must find the child tables that
  //    have no league or team column, AND it must stop there: with the direct
  //    seed removed, the transitive step has nothing to propagate from and must
  //    claim nothing at all.
  const tier2 = [...result.scoped.entries()]
    .filter(([, v]) => v.tier === 'transitive')
    .map(([t]) => t)
  const seedless = classify_league_scoped({
    tables: Object.fromEntries(
      Object.entries(tables).map(([t, cols]) => [
        t,
        cols.filter((c) => !DIRECT_SCOPE_COLUMNS.has(c))
      ])
    )
  })
  controls.push([
    `tier 2 finds the parent-scoped children (${tier2.length}) and claims nothing without a seed (${seedless.size})`,
    tier2.length > 0 && seedless.size === 0
  ])

  // 7. The schema parser against both TAIL forms, on a planted fixture rather
  //    than on the real schema. A tailed table must be recorded with its OWN
  //    columns and must not consume its successor. Asserting the successor's
  //    presence is the half that matters -- the swallow leaves the tailed table
  //    present and merely WRONG, so a check that only counts names, or only
  //    looks up the tailed table, passes while the defect is live.
  const planted_schema = [
    'CREATE TABLE public.control_tailed_with (',
    '    pid character varying(25) NOT NULL',
    ")\nWITH (autovacuum_vacuum_scale_factor='0.005');",
    '',
    'CREATE TABLE public.control_tailed_partition (',
    '    pid character varying(25) NOT NULL',
    ')\nPARTITION BY RANGE (season_year);',
    '',
    'CREATE TABLE public.control_successor (',
    '    lid integer NOT NULL',
    ');'
  ].join('\n')
  const planted = parse_schema(planted_schema)
  controls.push([
    'a WITH(...) table and a PARTITION BY table each keep their own columns ' +
      'and do not swallow the table after them',
    planted.control_tailed_with?.join() === 'pid' &&
      planted.control_tailed_partition?.join() === 'pid' &&
      planted.control_successor?.join() === 'lid'
  ])

  // 8. And the completeness invariant itself, driven red through the SAME
  //    helper `run` uses, so the control cannot pass against a second copy of
  //    the logic while `run`'s copy is broken.
  //
  //    A SINGLE-LINE table is the stand-in. The parser anchors the end of the
  //    column list on a `)` in column zero, and a one-line statement has none.
  //    pg_dump does not emit that shape today, which is exactly the point: this
  //    invariant exists for the shape nobody anticipated, so it has to be
  //    driven by one the parser genuinely cannot read. The first attempt here
  //    used a stray semicolon inside a WITH(...) tail and STAYED GREEN -- the
  //    terminator just stopped early and the table parsed fine.
  const unterminatable =
    'CREATE TABLE public.control_unterminatable (a integer);'
  controls.push([
    'a table the parser cannot terminate is named by the completeness ' +
      'invariant rather than dropped from the subject',
    unparsed_tables({
      source: unterminatable,
      tables: parse_schema(unterminatable)
    }).includes('control_unterminatable')
  ])

  // And the same invariant must stay SILENT on a schema that parses cleanly,
  // or it would report every day and mean nothing.
  controls.push([
    'the completeness invariant is silent on a schema that parses cleanly',
    unparsed_tables({ source: planted_schema, tables: planted }).length === 0
  ])

  console.log('\nNEGATIVE CONTROL')
  let control_failed = false
  for (const [name, passed] of controls) {
    console.log(`  ${passed ? 'RED (good)' : 'STAYED GREEN (bad)'}: ${name}`)
    if (!passed) control_failed = true
  }

  if (control_failed) {
    console.error(
      '\nA negative control did not fire. Everything above proves nothing -- ' +
        'a green here would be indistinguishable from a gate that cannot read ' +
        'the schema, the fixture, or its own adjudications.'
    )
    process.exit(2)
  }

  if (result.findings.length) {
    console.error(`\n${result.findings.length} finding(s):`)
    for (const finding of result.findings) console.error(`  ${finding}`)
    console.error(
      '\nRepair by adding the table to db/fixtures/reset-league-tables.mjs, or ' +
        'record why it ' +
        'must not be reset in db/gates/league-fixture-reset-adjudications.json ' +
        '(a reason is required; a name filter is not an option).'
    )
    process.exit(1)
  }

  console.log(
    `\nGATE OK -- every league-scoped table is cleared or adjudicated${verdict_suffix(corpus)}`
  )
}

run().catch((error) => {
  console.error(error)
  process.exit(2)
})
