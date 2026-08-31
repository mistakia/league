// @ts-check

// Contribution distillation — the DISTILL half of the confirm-then-distill
// substrate. Turns a CONFIRMED reproduction into a committed fixture that runs
// offline, in continuous integration, forever after.
//
// scripts/contribution-reproduce.mjs establishes that the reported behaviour is
// real by executing the captured request against production. That result is
// evidence, not an artifact: it cannot be committed, cannot run in CI, and stops
// being reproducible the moment the underlying rows change. This script extracts
// the minimal rows the confirmed query depended on and emits a
// `result_equivalence` fixture into test/data-view-queries/, which
// test/libs-server.data-view-queries-result-equivalence.mjs already knows how to
// seed, execute and assert inside a rolled-back transaction.
//
// NO SECOND FIXTURE DIRECTORY. `result_equivalence` already carries exactly the
// shape a distilled bug needs -- a `seed` of INSERT statements, a request, and
// an oracle -- and 55 fixtures already use it. Coining a parallel directory
// would mean a second loader, a second spec, and two conventions for one idea.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE CORRECTNESS ORACLE
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the question the whole substrate exists to answer, so it is settled
// here, next to the code that enforces it.
//
// The data-view regression harness (scripts/data-view-regression-check.mjs) is a
// DIFFERENTIAL oracle. It answers "did my change alter the results", by hashing
// the same query's rows across two code revisions. That is the right instrument
// for a refactor and it is the wrong instrument for a bug report, because a bug
// report asserts something a differential cannot express: "the current result is
// WRONG". A differential oracle is silent when both revisions are wrong
// together, which is precisely the case a report describes.
//
// A report's claim becomes an assertion in exactly one of two admissible forms.
// They are the two the result-equivalence harness already implements, and that
// is not a coincidence -- the harness was built for the same gap.
//
//   1. `reference_sql` -- INDEPENDENT DERIVATION. The reported quantity is
//      recomputed by SQL that shares no code path with the query builder. This
//      is the strongest form and the one to reach for first, because nobody has
//      to hand-write a number and the assertion survives the seed changing.
//
//      An INVARIANT is this form, not a third one. "A rate lies in [0,1]", "the
//      sum over partitions equals the sum over the whole", "a year_offset column
//      equals that column queried at the offset year directly" are each a SELECT
//      that returns what the correct answer must be. Folding invariants into
//      reference_sql is why this harness needs no extension to serve
//      reproduction.
//
//      The worked case is the percentage-pooling defect: passing success over
//      2021-2023 is the ratio of summed successes to summed attempts, and the
//      defect averaged three per-season rates. The correct definition is four
//      lines of SQL. It is red on the buggy revision and green after the fix
//      without anyone asserting 156.04 by hand.
//
//   2. `expected_rows` -- STATED EXPECTED VALUE. Admissible ONLY when the value
//      is derivable by hand from a seed small enough for a reviewer to check by
//      inspection. Because distillation AUTHORS the seed, this is usually
//      satisfiable: five rows and arithmetic a human can do in the review.
//
// THE PROHIBITED FORM, and the reason this section exists. `expected_rows`
// populated with the output of the code under test is a CHARACTERIZATION test.
// Against a bug report it asserts the bug -- it is green on master by
// construction, it can never be the red half of a red-then-green gate, and it
// permanently pins the defect as correct behaviour. It is also the single
// easiest fixture to produce, because the confirm step just handed you those
// rows. That combination is why the prohibition is mechanical below rather than
// advisory.
//
// HOW THE PROHIBITION IS ENFORCED, without trusting anyone's self-declaration.
// A distilled fixture is admissible only if it is RED against the revision the
// bug was reported on. A characterization oracle is green by construction, so
// requiring red excludes it without any provenance field an author could simply
// fill in wrongly. See assert_admissible_as_red_test.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE TWO PHASES, and why the intermediate one must not be committed
// ─────────────────────────────────────────────────────────────────────────────
//
//   PHASE 1, SEED SUFFICIENCY. Emit the fixture with a characterization oracle
//   -- expected_rows set to what production returned -- and run it offline. If
//   it is GREEN, the extracted seed is sufficient: the offline query saw
//   everything the production query saw. If it is RED, the seed is missing rows
//   and the extraction must widen. This is the only legitimate use of a
//   characterization oracle, it is a measurement of the seed rather than of the
//   code, and its fixture is a scratch artifact.
//
//   PHASE 2, ORACLE SUBSTITUTION. Replace the characterization oracle with an
//   admissible one. Run it offline again. It must now be RED. That red is the
//   deliverable: the admission gate the automated contribution path hangs on.
//
// Phase 1 green then phase 2 red is the signature of a genuine distillation.
// Phase 1 RED means the seed is incomplete and nothing has been proven. Phase 2
// GREEN means one of two things and they must not be conflated: either the
// oracle is still a characterization, or the defect is already fixed on this
// revision. The confirm step's observation distinguishes them -- it saw the
// wrong value or it did not.
//
// ─────────────────────────────────────────────────────────────────────────────
//
// WHAT THIS SCRIPT DOES NOT ESTABLISH. Seed extraction reads production, and a
// relation this module fails to name is a relation whose rows never reach the
// seed. That failure surfaces as a phase-1 red -- a missing row changes the
// offline result -- which is why phase 1 is not optional and why its green is
// the precondition for trusting anything downstream.
//
// Usage:
//   NODE_ENV=production node scripts/contribution-distill.mjs \
//     --table-state <path.json> --subject-pid <pid> --name <slug> [--out <path>]
//   ... --observed <path.json>  production rows, to emit a phase-1 seed check
//   ... --json                  machine-readable report on stdout

import fs from 'fs'
import path from 'path'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from '#libs-server/is-main.mjs'
import { get_data_view_results_query } from '#libs-server'
import { get_sandbox_db } from '#db/sandbox-pool.mjs'
import { run_sandboxed_read } from '#libs-server/sandboxed-read.mjs'
import {
  build_grant_plan,
  read_schema_sql,
  CONTRIBUTION_ROLE
} from '#db/tools/generate-reader-role-grants.mjs'

/**
 * The oracle half of a result_equivalence block. Exactly one of reference_sql /
 * expected_rows is populated; the projection fields are the harness's own.
 *
 * @typedef {object} Oracle
 * @property {string} [reference_sql]
 * @property {Array<Record<string, any>>} [expected_rows]
 * @property {Array<string>} [compare_columns]
 * @property {Array<string>} [ignore_columns]
 */

/**
 * @typedef {Oracle & { seed: Array<string>, phase?: string }} ResultEquivalence
 */

/**
 * @typedef {object} Fixture
 * @property {string} name
 * @property {string} description
 * @property {Record<string, any>} request
 * @property {ResultEquivalence} result_equivalence
 * @property {Array<string>} tags
 */

// The two admissible oracle forms. Keyed by the result_equivalence field that
// carries each, so a caller naming a kind cannot name a field the harness does
// not read.
export const ORACLE_KINDS = {
  reference_sql:
    'an independent SQL derivation of the reported quantity, including an invariant',
  expected_rows:
    'a hand-derived value, admissible only against a seed checkable by inspection'
}

// The phase marker a fixture carries while it is still a seed measurement.
// Fixtures under test/data-view-queries/ must never carry it; see
// assert_admissible_as_red_test.
export const SEED_CHECK_PHASE = 'seed-check'

export const DISTILL_OUTCOMES = {
  distilled: 'the fixture carries an admissible oracle and is ready to commit',
  seed_insufficient:
    'the offline fixture did not reproduce the production observation',
  no_oracle:
    'the reported quantity has no independent derivation, no invariant, and no hand-checkable seed'
}

/**
 * The relations league_contribution_reader is granted, which is also the set a
 * generated query can possibly read.
 *
 * Read from the committed schema export rather than from a live connection, so
 * extraction works with no database at all.
 *
 * @returns {Set<string>}
 */
export const get_known_relations = () =>
  new Set(
    build_grant_plan(read_schema_sql(), { role: CONTRIBUTION_ROLE }).granted
  )

/**
 * Name every granted relation the generated SQL references.
 *
 * WHY TOKEN MATCHING AGAINST A KNOWN SET RATHER THAN PARSING. Generated
 * data-view SQL is deep in materialized CTEs whose names are content hashes, and
 * a general parser has to model every construct the builder can emit to avoid
 * missing a FROM. Matching identifiers against the ENUMERATED grant list inverts
 * that: the set is finite, committed, and reviewed, so the question is set
 * membership rather than grammar. Validated against all 280 stored fixtures --
 * every one resolves at least one relation.
 *
 * THE ERROR DIRECTION IS DELIBERATE. A column or alias that happens to share a
 * relation's name is a FALSE POSITIVE, which costs one unnecessary production
 * read and seeds rows nothing queries. A false NEGATIVE would silently omit
 * rows, and that is the failure that looks like success -- so it is caught
 * downstream by the phase-1 seed check rather than trusted away here.
 *
 * @param {object} opts
 * @param {string} opts.query_string
 * @param {Set<string>} [opts.known_relations]
 * @returns {Array<string>} sorted
 */
export const extract_referenced_relations = ({
  query_string,
  known_relations = get_known_relations()
}) => {
  const found = new Set()
  const tokens = query_string.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  for (const token of tokens) {
    if (known_relations.has(token)) found.add(token)
  }
  return [...found].sort()
}

/**
 * Reject an oracle that is not one of the two admissible forms.
 *
 * @param {Oracle} oracle
 * @returns {{ kind: string }}
 */
export const assert_oracle_admissible = (oracle) => {
  if (!oracle || typeof oracle !== 'object') {
    throw new Error(
      `an oracle is required; expected one of ${Object.keys(ORACLE_KINDS).join(', ')}`
    )
  }
  const has_reference = Boolean(oracle.reference_sql)
  const has_expected = Array.isArray(oracle.expected_rows)
  if (has_reference === has_expected) {
    throw new Error(
      'an oracle carries exactly one of reference_sql / expected_rows, ' +
        `not ${has_reference ? 'both' : 'neither'}`
    )
  }
  return { kind: has_reference ? 'reference_sql' : 'expected_rows' }
}

/**
 * Refuse a fixture that cannot serve as the red half of a red-then-green gate.
 *
 * THE CHECK IS THE RED ITSELF, not a declaration about the oracle's provenance.
 * An author can write `provenance: derived` over a characterization oracle; an
 * author cannot make a characterization oracle fail against the revision it was
 * characterized from. So admissibility is decided by the observed result of
 * running the fixture, and a caller must pass what actually happened.
 *
 * @param {object} opts
 * @param {Partial<Fixture>} opts.fixture
 * @param {boolean} opts.is_red - did the fixture FAIL on the reported revision
 * @returns {{ admissible: true }}
 */
export const assert_admissible_as_red_test = ({ fixture, is_red }) => {
  const re = fixture && fixture.result_equivalence
  if (!re) {
    throw new Error('fixture carries no result_equivalence block')
  }
  if (re.phase === SEED_CHECK_PHASE) {
    throw new Error(
      'this fixture is a phase-1 seed check: its oracle is the production ' +
        'observation, so committing it would assert the defect as correct ' +
        'behaviour. Substitute an admissible oracle first.'
    )
  }
  assert_oracle_admissible(re)
  if (!is_red) {
    throw new Error(
      'fixture is GREEN on the reported revision, so it is not a reproduction. ' +
        'Either the oracle still characterizes the code under test, or the ' +
        "defect is already fixed -- the confirm step's observation tells you " +
        'which, and they must not be conflated.'
    )
  }
  return { admissible: true }
}

/**
 * Render one row as an INSERT the result-equivalence harness can seed.
 *
 * Values are literalized rather than bound because the harness seeds through
 * `trx.raw(stmt)` with no bindings, and because a committed fixture whose seed
 * is readable is reviewable -- the whole argument for the expected_rows oracle
 * form rests on a human being able to check the arithmetic.
 *
 * @param {object} opts
 * @param {string} opts.relation
 * @param {Record<string, any>} opts.row
 * @returns {string}
 */
export const build_insert_statement = ({ relation, row }) => {
  const columns = Object.keys(row).filter((c) => row[c] !== undefined)
  const literal = (/** @type {any} */ value) => {
    if (value === null) return 'NULL'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (value instanceof Date) return `'${value.toISOString()}'`
    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`
    }
    return `'${String(value).replace(/'/g, "''")}'`
  }
  return (
    `INSERT INTO ${relation} (${columns.join(', ')}) VALUES ` +
    `(${columns.map((c) => literal(row[c])).join(', ')})`
  )
}

/**
 * Read the subject's rows from each referenced relation, through the same
 * read-only envelope and the same scoped role the confirm step used.
 *
 * NOT the main pool, for the reason the confirm step does not use it either: an
 * agent acting on an anonymous report holds this connection, and
 * league_contribution_reader is the role whose reach was reviewed for that.
 *
 * A relation with no column matching the subject predicate is read whole up to
 * `row_limit`. That is correct for the small dimension tables data views join
 * (teams, adp_format) and wrong for a fact table, so the limit is low and
 * overflow is reported rather than silently truncated -- a truncated seed
 * produces a phase-1 red, which is recoverable, but only if the operator can see
 * why.
 *
 * @param {object} opts
 * @param {Array<string>} opts.relations
 * @param {string} opts.subject_column
 * @param {string} opts.subject_value
 * @param {number} [opts.row_limit]
 * @param {import('knex').Knex|null} [opts.sandbox_db] - test seam for the pool
 */
export const extract_seed_rows = async ({
  relations,
  subject_column,
  subject_value,
  row_limit = 200,
  sandbox_db = null
}) => {
  const pool = sandbox_db || get_sandbox_db('contribution')
  /** @type {Array<string>} */
  const statements = []
  /** @type {Array<{ relation: string, reason: string }>} */
  const truncated = []

  for (const relation of relations) {
    // Identifiers are interpolated because they came from the enumerated grant
    // list, never from caller text; the subject VALUE is bound.
    const query_string = `SELECT * FROM ${relation} WHERE ${subject_column} = $1 LIMIT ${row_limit + 1}`
    let rows
    try {
      ;({ rows } = await run_sandboxed_read({
        pool,
        query_string,
        bindings: [subject_value]
      }))
    } catch (error) {
      // A relation with no subject column is the ordinary case, not an error:
      // most data views join dimension tables keyed on something else. Recorded
      // so a phase-1 red can be traced to it.
      truncated.push({
        relation,
        reason: `not filterable on ${subject_column}: ${error && error.message}`
      })
      continue
    }
    if (rows.length > row_limit) {
      truncated.push({ relation, reason: `more than ${row_limit} rows` })
      rows = rows.slice(0, row_limit)
    }
    for (const row of rows) {
      statements.push(build_insert_statement({ relation, row }))
    }
  }

  return { statements, truncated }
}

/**
 * Assemble a result_equivalence fixture.
 *
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} [opts.description]
 * @param {Record<string, any>} opts.request - the captured table_state
 * @param {Array<string>} opts.seed
 * @param {Oracle} opts.oracle - reference_sql or expected_rows, plus projection
 * @param {boolean} [opts.seed_check] - mark as phase 1, uncommittable
 * @returns {Fixture}
 */
export const build_fixture = ({
  name,
  description,
  request,
  seed,
  oracle,
  seed_check = false
}) => {
  if (!seed_check) assert_oracle_admissible(oracle)

  /** @type {ResultEquivalence} */
  const result_equivalence = { seed, ...oracle }
  if (seed_check) result_equivalence.phase = SEED_CHECK_PHASE

  return {
    name,
    description: description || `Distilled from a contribution report: ${name}`,
    request,
    result_equivalence,
    tags: ['contribution', 'reproduction', 'result-equivalence']
  }
}

const FIXTURE_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'test',
  'data-view-queries'
)

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('table-state', {
      type: 'string',
      demandOption: true,
      description: 'path to the confirmed table_state JSON'
    })
    .option('subject-pid', {
      type: 'string',
      demandOption: true,
      description:
        'the player the report is about; the seed is restricted to it'
    })
    .option('subject-column', { type: 'string', default: 'pid' })
    .option('name', { type: 'string', demandOption: true })
    .option('observed', {
      type: 'string',
      description:
        'path to the production rows, to emit a phase-1 seed check rather than a fixture'
    })
    .option('out', { type: 'string' })
    .option('row-limit', { type: 'number', default: 200 })
    .option('json', { type: 'boolean', default: false })
    .strict()
    .parseSync()

  const request = JSON.parse(fs.readFileSync(argv['table-state'], 'utf8'))
  const { query } = await get_data_view_results_query(request)
  const relations = extract_referenced_relations({
    query_string: query.toString()
  })

  const { statements, truncated } = await extract_seed_rows({
    relations,
    subject_column: argv['subject-column'],
    subject_value: argv['subject-pid'],
    row_limit: argv['row-limit']
  })

  // With --observed this emits the phase-1 seed check, whose oracle is the
  // production observation ON PURPOSE and which build_fixture marks
  // uncommittable. Without it, the oracle is the author's job: this script will
  // not invent one, because inventing one means characterizing the code.
  const observed_path = argv.observed
  const seed_check = Boolean(observed_path)
  /** @type {Oracle} */
  const oracle = observed_path
    ? { expected_rows: JSON.parse(fs.readFileSync(observed_path, 'utf8')) }
    : { reference_sql: 'TODO: author an independent derivation or invariant' }

  const fixture = build_fixture({
    name: argv.name,
    request,
    seed: statements,
    oracle,
    seed_check
  })

  const out =
    argv.out || path.join(FIXTURE_DIR, `${argv.name}-result-equivalence.json`)
  fs.writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`)

  const report = {
    relations,
    seed_statements: statements.length,
    truncated,
    phase: seed_check ? SEED_CHECK_PHASE : 'oracle',
    written: out
  }

  if (argv.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`relations: ${relations.length} -- ${relations.join(', ')}`)
    console.log(`seed:      ${statements.length} INSERT statements`)
    for (const t of truncated)
      console.log(`  skipped ${t.relation}: ${t.reason}`)
    console.log(`phase:     ${report.phase}`)
    console.log(`written:   ${out}`)
    if (seed_check) {
      console.log(
        '\nphase 1. Run the result-equivalence suite: this fixture must be ' +
          'GREEN, which proves the seed is sufficient. Then replace its oracle ' +
          'and delete the phase marker.'
      )
    }
  }

  return 0
}

if (is_main(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(
        `fatal: ${error && error.stack ? error.stack : error}\n`
      )
      process.exit(1)
    })
}
