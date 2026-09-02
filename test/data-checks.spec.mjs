/* global describe it beforeEach afterEach */
import * as chai from 'chai'

import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  classify_check_rows,
  load_parked,
  validate_registry
} from '#libs-server/data-check.mjs'
import {
  finding_message,
  run_check,
  run_data_checks
} from '#scripts/run-data-checks.mjs'
import registry from '#db/checks/registry.mjs'

const expect = chai.expect

const parked_entries = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'db/checks/parked.json'), 'utf8')
)

/*
  Drives the SHIPPED classifier over fixtures rather than a copy of it, which is
  the compensating control for the registered checks sharing one code path --
  editing libs-server/data-check.mjs is what these tests exercise.

  A check reading live production rows cannot mutate its corpus to prove it goes
  red, so this fixture corpus plus each check's `calibration` prose is the
  substitute for a negative control. Fixtures satisfy the sentinel rule by
  construction: nothing here derives a discriminator from the environment.

  ## Why the grain values differ in SHAPE

  Every fixture's grain columns carry values drawn from different distributions
  -- season years in the 2000s against weeks in single digits -- so a
  transposition between two grain columns changes the key and fails the
  matching. A fixture whose two grain columns hold the same value cannot detect
  that at all: the two are interchangeable in the output no matter how many
  assertions ride on them.
*/

const rate_check = {
  check_id: 'pfr-gamelog-agreement',
  grain: ['season_year', 'week'],
  min_rate: 1.0
}

const count_check = {
  check_id: 'gamelog-orphans',
  grain: ['child_table', 'esbid', 'pid'],
  max_count: 0
}

const gated_check = {
  check_id: 'reference-gated',
  grain: ['season_year', 'week'],
  precondition: (row) => row.reference_games === row.our_games,
  min_rate: 1.0
}

describe('data checks', function () {
  describe('classifier / min_rate arm', function () {
    it('reports nothing on a clean corpus and still carries its denominator', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 635 },
          { season_year: 2024, week: 1, numerator: 913, denominator: 913 }
        ],
        check: rate_check
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.gradeable).to.have.lengthOf(2)
      expect(result.ungradeable).to.have.lengthOf(0)
      expect(result.gradeable[0].denominator).to.equal(635)
    })

    it('reports a row below the threshold', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 636 },
          { season_year: 2024, week: 1, numerator: 913, denominator: 913 }
        ],
        check: rate_check
      })

      expect(result.findings).to.have.lengthOf(1)
      expect(result.findings[0].season_year).to.equal(2022)
      expect(result.findings[0].week).to.equal(8)
    })

    it('reads a string numerator and denominator as numbers', () => {
      // pg returns count() as a string, so a classifier comparing them raw
      // would compare lexically and pass everything.
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: '635', denominator: '636' }
        ],
        check: rate_check
      })

      expect(result.findings).to.have.lengthOf(1)
    })
  })

  describe('classifier / max_count arm', function () {
    it('reports a violation while still reporting the scanned population', () => {
      const result = classify_check_rows({
        rows: [
          {
            child_table: 'player_receiving_gamelogs',
            esbid: 2003081503,
            pid: 'TAYL-WHIT-019422',
            numerator: 1,
            denominator: 269483
          }
        ],
        check: count_check
      })

      expect(result.findings).to.have.lengthOf(1)
      expect(result.gradeable[0].denominator).to.equal(269483)
    })

    it('is clean on a zero-violation row rather than empty', () => {
      // The whole point of the denominator contract: a clean max_count check
      // still returns a row, so an emptied predicate is distinguishable from a
      // healthy corpus.
      const result = classify_check_rows({
        rows: [
          {
            child_table: 'player_receiving_gamelogs',
            esbid: null,
            pid: null,
            numerator: 0,
            denominator: 269483
          }
        ],
        check: count_check
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.gradeable).to.have.lengthOf(1)
      expect(result.gradeable[0].denominator).to.equal(269483)
    })

    it('throws on a row carrying no denominator', () => {
      expect(() =>
        classify_check_rows({
          rows: [
            {
              child_table: 'player_receiving_gamelogs',
              esbid: 2003081503,
              pid: 'TAYL-WHIT-019422',
              numerator: 1
            }
          ],
          check: count_check
        })
      ).to.throw(/denominator/)
    })
  })

  describe('classifier / zero denominator', function () {
    it('reports a zero-denominator rate row as un-gradeable, never as clean', () => {
      // Reachable in production: the PFR probe writes `bucket.totals[column] ||
      // 0`, so a reference field-name drift zeroes a stat's denominator across
      // every week. Graded, this passed silently AND counted toward the floor.
      const result = classify_check_rows({
        rows: [{ season_year: 2022, week: 8, numerator: 300, denominator: 0 }],
        check: rate_check
      })

      expect(result.ungradeable).to.have.lengthOf(1)
      expect(result.gradeable).to.have.lengthOf(0)
      expect(result.findings).to.have.lengthOf(0)
    })

    it('reports a zero-denominator count row as un-gradeable, never as clean', () => {
      const result = classify_check_rows({
        rows: [
          {
            child_table: 'player_receiving_gamelogs',
            esbid: null,
            pid: null,
            numerator: 0,
            denominator: 0
          }
        ],
        check: count_check
      })

      expect(result.ungradeable).to.have.lengthOf(1)
      expect(result.gradeable).to.have.lengthOf(0)
    })
  })

  describe('classifier / max_count is a budget, not a per-row test', function () {
    const budgeted_check = {
      check_id: 'gamelog-orphans',
      grain: ['child_table', 'esbid', 'pid'],
      max_count: 5
    }

    const orphan_rows = (count) =>
      Array.from({ length: count }, (_, index) => ({
        child_table: 'player_receiving_gamelogs',
        esbid: 2003081500 + index,
        pid: `PLAY-ER${index}-01234${index}`,
        numerator: 1,
        denominator: 137900
      }))

    it('reports every violation once the TOTAL exceeds the budget', () => {
      // The regression: compared per row, `numerator: 1 > 5` is false for each
      // of the ten, so ten orphans would report zero findings under a budget of
      // five and the check would be silently disabled.
      const result = classify_check_rows({
        rows: orphan_rows(10),
        check: budgeted_check
      })

      expect(result.findings).to.have.lengthOf(10)
    })

    it('stays clean while the total sits inside the budget', () => {
      const result = classify_check_rows({
        rows: orphan_rows(5),
        check: budgeted_check
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.gradeable).to.have.lengthOf(5)
    })

    it('spends the budget on UNSUPPRESSED violations only', () => {
      const rows = orphan_rows(7)
      const parked = rows.slice(0, 3).map((row) => ({
        check_id: 'gamelog-orphans',
        grain: {
          child_table: row.child_table,
          esbid: row.esbid,
          pid: row.pid
        },
        disposition: 'baselined',
        owner: 'user:task/league/example.md'
      }))

      const result = classify_check_rows({
        rows,
        check: budgeted_check,
        parked
      })

      // 7 violations, 3 parked, 4 unsuppressed -- inside a budget of 5.
      expect(result.baselined).to.have.lengthOf(3)
      expect(result.findings).to.have.lengthOf(0)
    })

    it('treats an aggregate-count row the same way', () => {
      const result = classify_check_rows({
        rows: [{ scope: 'all', numerator: 6, denominator: 32461 }],
        check: {
          check_id: 'route-share-unfilled',
          grain: ['scope'],
          max_count: 5
        }
      })

      expect(result.findings).to.have.lengthOf(1)
    })
  })

  describe('classifier / precondition', function () {
    it('reports a row failing the precondition as un-gradeable, never as passed', () => {
      const result = classify_check_rows({
        rows: [
          {
            season_year: 2022,
            week: 8,
            reference_games: 14,
            our_games: 14,
            numerator: 635,
            denominator: 635
          },
          {
            season_year: 2025,
            week: 3,
            reference_games: 11,
            our_games: 16,
            numerator: 550,
            denominator: 100
          }
        ],
        check: gated_check
      })

      expect(result.gradeable).to.have.lengthOf(1)
      expect(result.ungradeable).to.have.lengthOf(1)
      expect(result.ungradeable[0].season_year).to.equal(2025)
      // The un-gradeable row reads 5.5 -- above the floor rather than below it,
      // which is exactly how a stale reference passes a one-sided threshold
      // silently when nothing gates it.
      expect(result.findings).to.have.lengthOf(0)
    })
  })

  describe('classifier / parking', function () {
    const parked = [
      {
        check_id: 'pfr-gamelog-agreement',
        grain: { season_year: 2022, week: 8 },
        disposition: 'adjudicated',
        reason: 'PFR counts a reception our feed does not.',
        evidence: 'ours 635, PFR 636',
        validated_at: '2026-08-14'
      },
      {
        check_id: 'pfr-gamelog-agreement',
        grain: { season_year: 2024, week: 2 },
        disposition: 'baselined',
        owner: 'user:task/league/example.md'
      }
    ]

    it('suppresses an adjudicated finding and keeps its entry', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 636 }
        ],
        check: rate_check,
        parked
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.adjudicated).to.have.lengthOf(1)
      expect(result.adjudicated[0].parked.reason).to.match(/reception/)
    })

    it('suppresses a baselined finding into its own population', () => {
      const result = classify_check_rows({
        rows: [{ season_year: 2024, week: 2, numerator: 10, denominator: 26 }],
        check: rate_check,
        parked
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.baselined).to.have.lengthOf(1)
      expect(result.adjudicated).to.have.lengthOf(0)
    })

    it('reports a parked entry that suppressed nothing', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 636, denominator: 636 }
        ],
        check: rate_check,
        parked
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.stale_parked).to.have.lengthOf(2)
    })

    it('reports an UNREGISTERED subject rather than defaulting it to parked', () => {
      // The omission path, whose failure mode is silence. A grain row with no
      // entry must be a finding -- if it were suppressed by default, forgetting
      // to register a subject would silently disable the check for it.
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 10, numerator: 816, denominator: 817 }
        ],
        check: rate_check,
        parked
      })

      expect(result.findings).to.have.lengthOf(1)
      expect(result.findings[0].week).to.equal(10)
    })

    it('keys per grain row, so parking one week cannot mask another', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 636 },
          { season_year: 2022, week: 9, numerator: 700, denominator: 701 }
        ],
        check: rate_check,
        parked
      })

      expect(result.adjudicated).to.have.lengthOf(1)
      expect(result.findings).to.have.lengthOf(1)
      expect(result.findings[0].week).to.equal(9)
    })

    it('does not match a grain row whose columns are transposed', () => {
      // season_year 2022 / week 8 against season_year 8 / week 2022. A fixture
      // holding one value in both columns could not tell these apart.
      const result = classify_check_rows({
        rows: [
          { season_year: 8, week: 2022, numerator: 635, denominator: 636 }
        ],
        check: rate_check,
        parked
      })

      expect(result.adjudicated).to.have.lengthOf(0)
      expect(result.findings).to.have.lengthOf(1)
    })

    it('ignores entries belonging to another check', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 636 }
        ],
        check: { ...rate_check, check_id: 'another-check' },
        parked
      })

      expect(result.findings).to.have.lengthOf(1)
      expect(result.stale_parked).to.have.lengthOf(0)
    })
  })

  describe('parked loader', function () {
    const adjudicated = {
      check_id: 'pfr-gamelog-agreement',
      grain: { season_year: 2022, week: 8 },
      disposition: 'adjudicated',
      reason: 'PFR counts a reception our feed does not.',
      evidence: 'ours 635, PFR 636',
      validated_at: '2026-08-14'
    }

    const baselined = {
      check_id: 'gamelog-orphans',
      grain: { child_table: 'player_receiving_gamelogs', esbid: 1, pid: 'A' },
      disposition: 'baselined',
      owner: 'user:task/league/example.md'
    }

    it('accepts a well-formed file', () => {
      expect(
        load_parked({ entries: [adjudicated, baselined] })
      ).to.have.lengthOf(2)
    })

    it('throws on an adjudicated entry with no reason', () => {
      const { reason, ...without_reason } = adjudicated
      expect(reason).to.be.a('string')
      expect(() => load_parked({ entries: [without_reason] })).to.throw(
        /reason/
      )
    })

    it('throws on an adjudicated entry with no evidence', () => {
      const { evidence, ...without_evidence } = adjudicated
      expect(evidence).to.be.a('string')
      expect(() => load_parked({ entries: [without_evidence] })).to.throw(
        /evidence/
      )
    })

    it('does NOT require evidence on a baselined entry', () => {
      // The two dispositions demand different fields; that difference is the
      // whole reason the disposition exists.
      expect(() => load_parked({ entries: [baselined] })).to.not.throw()
    })

    it('throws on a baselined entry with no owner', () => {
      const { owner, ...without_owner } = baselined
      expect(owner).to.be.a('string')
      expect(() => load_parked({ entries: [without_owner] })).to.throw(/owner/)
    })

    it('throws on an entry with no disposition', () => {
      const { disposition, ...without_disposition } = adjudicated
      expect(disposition).to.equal('adjudicated')
      expect(() => load_parked({ entries: [without_disposition] })).to.throw(
        /disposition/
      )
    })

    it('throws on an entry naming a check that is not in the registry', () => {
      expect(() =>
        load_parked({
          entries: [{ ...adjudicated, check_id: 'no-such-check' }],
          checks_by_id: new Map([['pfr-gamelog-agreement', rate_check]])
        })
      ).to.throw(/not in the registry/)
    })
  })
})

/*
  The coverage-collapse arm, driven through the SHIPPED `run_check`.

  These are the negative control for the detector-health floor itself. Every
  fixture below reports zero findings, which is exactly what an emptied corpus
  looks like, so a green result here means the runner cannot tell a clean sweep
  from a scan that reached nothing.

  No signals API is configured under test, so both emits decline before any
  transport and `emits_ok` is false throughout. That is deliberate: it keeps
  these cases about the floor, and the emit arm is specced in
  test/libs-shared.log.spec.mjs where the fetch recorder lives.
*/
describe('data checks / coverage collapse', function () {
  const HEALTHY_TABLES = {
    player_receiving_gamelogs: 137900,
    player_rushing_gamelogs: 67621,
    player_defender_gamelogs: 60090,
    player_passing_gamelogs: 3870
  }

  // Shaped like gamelog-orphans: one sentinel row per child table when clean,
  // so the row count is fixed at 4 and only the denominator moves.
  const fixed_size_check = ({ denominator_by_table, ...overrides }) => ({
    check_id: 'gamelog-orphans',
    grain: ['child_table', 'esbid', 'pid'],
    max_count: 0,
    min_gradeable_units: 4,
    min_denominator: 3000,
    invariant: 'Every gamelog child row has a parent.',
    repair_command: 'adjudicate per row',
    rows: async () =>
      Object.entries(denominator_by_table).map(
        ([child_table, denominator]) => ({
          child_table,
          esbid: null,
          pid: null,
          numerator: 0,
          denominator
        })
      ),
    ...overrides
  })

  const rejection_from = async (promise) => {
    try {
      await promise
    } catch (err) {
      return err
    }
    return null
  }

  // A fully emptied corpus is caught by the ROW-COUNT floor, because a
  // zero-denominator row is un-gradeable rather than clean -- so the four
  // sentinel rows never reach `gradeable` at all. min_denominator is what
  // catches the harder case below, where the scan is thin but not empty.
  it('throws when every scanned population is empty', async () => {
    const emptied = Object.fromEntries(
      Object.keys(HEALTHY_TABLES).map((child_table) => [child_table, 0])
    )

    const err = await rejection_from(
      run_check({
        check: fixed_size_check({ denominator_by_table: emptied }),
        parked: []
      })
    )

    expect(err).to.be.an('error')
    expect(err.name).to.equal('CoverageCollapseError')
    expect(err.message).to.match(/graded only 0 unit\(s\)/)
  })

  it('throws when ONE sub-population collapses behind healthy siblings', async () => {
    const err = await rejection_from(
      run_check({
        check: fixed_size_check({
          denominator_by_table: {
            ...HEALTHY_TABLES,
            player_passing_gamelogs: 12
          }
        }),
        parked: []
      })
    )

    expect(err).to.be.an('error')
    expect(err.message).to.match(/scanned only 12 row\(s\)/)
  })

  it('passes when every scanned population is above the floor', async () => {
    const { result } = await run_check({
      check: fixed_size_check({ denominator_by_table: HEALTHY_TABLES }),
      parked: []
    })

    expect(result.findings).to.be.empty
    expect(result.gradeable).to.have.lengthOf(4)
  })

  it('leaves a check declaring no min_denominator on the row-count floor alone', async () => {
    // The same thin scan that trips the floor above passes here, because
    // without a declared min_denominator the row count is the only floor and
    // all four rows are gradeable.
    const { result } = await run_check({
      check: fixed_size_check({
        denominator_by_table: {
          ...HEALTHY_TABLES,
          player_passing_gamelogs: 12
        },
        min_denominator: undefined
      }),
      parked: []
    })

    expect(result.gradeable).to.have.lengthOf(4)
  })

  it('still reports the row-count floor when the denominator is healthy', async () => {
    const err = await rejection_from(
      run_check({
        check: fixed_size_check({
          denominator_by_table: HEALTHY_TABLES,
          min_gradeable_units: 99
        }),
        parked: []
      })
    )

    expect(err).to.be.an('error')
    expect(err.message).to.match(/graded only 4 unit\(s\)/)
  })
})

/*
  The resolve arm, driven through the SHIPPED `run_check` over a stubbed
  transport.

  `resolve_signal` returns null only when it could not POST. A resolve that
  REACHED the route and closed nothing comes back TRUTHY as
  `{ resolved: false, reason }`, so these pin the one distinction a null check
  cannot make. The reason vocabulary is the resolver's own: `no_open_signal` is
  the benign clean-run answer, and `missing_dedup_key` / `update_failed` /
  `writer_unreachable` each leave a row open.

  Every check here is CLEAN — no findings, denominator above both floors — so
  nothing is emitted and the only signal traffic is the two resolves.
*/
describe('data checks / resolve inspection', function () {
  let original_base_api_url
  let original_machine_slug
  let original_key_file
  let original_fetch
  let key_dir

  beforeEach(() => {
    original_base_api_url = process.env.BASE_API_URL
    original_machine_slug = process.env.BASE_MACHINE_SLUG
    original_key_file = process.env.BASE_INSTANCE_KEY_FILE
    original_fetch = globalThis.fetch

    key_dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'data-checks-resolve-spec-')
    )
    const key_path = path.join(key_dir, 'instance-private.key')
    const { privateKey } = crypto.generateKeyPairSync('ed25519')
    fs.writeFileSync(
      key_path,
      privateKey.export({ format: 'pem', type: 'pkcs8' }),
      { mode: 0o600 }
    )

    process.env.BASE_API_URL = 'http://localhost:9999'
    process.env.BASE_MACHINE_SLUG = 'league'
    process.env.BASE_INSTANCE_KEY_FILE = key_path
  })

  afterEach(() => {
    globalThis.fetch = original_fetch
    process.env.BASE_API_URL = original_base_api_url
    process.env.BASE_MACHINE_SLUG = original_machine_slug
    process.env.BASE_INSTANCE_KEY_FILE = original_key_file
    fs.rmSync(key_dir, { recursive: true, force: true })
  })

  const stub_resolve_response = (payload) => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => payload
    })
  }

  const clean_check = {
    check_id: 'duplicate-person-rows',
    grain: ['pid'],
    max_count: 0,
    min_gradeable_units: 1,
    min_denominator: 25000,
    invariant: 'No person holds both a canonical row and a shell row.',
    repair_command: 'adjudicate each pair',
    rows: async () => [{ pid: null, numerator: 0, denominator: 27748 }]
  }

  it('counts a clean run that closed nothing as a successful resolve', async () => {
    stub_resolve_response({ resolved: false, reason: 'no_open_signal' })

    const { result, emits_ok } = await run_check({
      check: clean_check,
      parked: []
    })

    expect(result.findings).to.be.empty
    expect(emits_ok).to.equal(true)
  })

  it('counts a resolve that actually closed a row as successful', async () => {
    stub_resolve_response({ resolved: true })

    const { emits_ok } = await run_check({ check: clean_check, parked: [] })

    expect(emits_ok).to.equal(true)
  })

  // The regression this arm exists for: every one of these is a TRUTHY response
  // that closed nothing, which a null check reports as a successful close.
  for (const reason of [
    'writer_unreachable',
    'update_failed',
    'missing_dedup_key'
  ]) {
    it(`reports a truthy resolve that closed nothing (${reason}) as detector ill-health`, async () => {
      stub_resolve_response({ resolved: false, reason })

      const { emits_ok } = await run_check({ check: clean_check, parked: [] })

      expect(emits_ok).to.equal(false)
    })
  }

  /*
    Findings and a stale parked entry are INDEPENDENT conditions and now take
    separate keys. Under one key, findings clearing while an entry went stale
    emitted into an already-open findings row, which dedup collapses into a
    no-op, so the stale entry left no trace anywhere.

    The emitted KEY cannot be asserted here: `config.signals_api_url` is empty
    under NODE_ENV=test, so `create_logger().error` declines before any
    transport and no emit reaches the stubbed fetch. What that makes observable
    is the distinction itself -- a clean run with a stale entry ATTEMPTS an emit
    (which declines, so emits_ok goes false) while a clean run without one only
    resolves (so emits_ok stays true). The classifier-level `stale_parked`
    population is asserted separately above.
  */
  const stale_entry = {
    check_id: 'duplicate-person-rows',
    grain: { pid: 'NOBO-DYHE-000000' },
    disposition: 'adjudicated',
    reason: 'Validated as a genuine namesake pair.',
    evidence: 'Distinct dates of birth on both rows.',
    validated_at: '2026-08-14'
  }

  it('treats a stale parked entry as its own condition on a clean run', async () => {
    stub_resolve_response({ resolved: true })

    const with_stale = await run_check({
      check: clean_check,
      parked: [stale_entry]
    })

    expect(with_stale.result.findings).to.be.empty
    expect(with_stale.result.stale_parked).to.have.lengthOf(1)
    expect(with_stale.emits_ok).to.equal(false)

    const without_stale = await run_check({ check: clean_check, parked: [] })

    expect(without_stale.result.stale_parked).to.be.empty
    expect(without_stale.emits_ok).to.equal(true)
  })

  it('reports a resolve that could not POST at all as detector ill-health', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    })

    const { emits_ok } = await run_check({ check: clean_check, parked: [] })

    expect(emits_ok).to.equal(false)
  })
})

/*
  The whole-registry runner, over injected fixture checks.

  What these pin is the DISPOSITION: a finding never turns the run red, while a
  crash, a coverage collapse and a failed emit all do. That is the claim the
  system exists to make, and until run_data_checks took its checks as a
  parameter nothing could reach it without five production queries.
*/
/*
  The signal headline, over the two shapes that made it lie.

  A findings signal is the ONLY surface most of these checks ever reach a human
  through, so a headline that misstates the rate is a defect in the system
  rather than in a check. It is also the one part of the emit path a spec can
  reach: `emit_condition` is module-private and declines under NODE_ENV=test,
  which is why this shipped wrong and stayed green for weeks.

  Both fixtures are production measurements taken 2026-09-01, not invented
  numbers, so a future edit that re-derives the rate from the row count fails
  against the case that actually occurred.
*/
describe('data checks / finding message', function () {
  const check = {
    check_id: 'prop-market-open-close-esbid-coherence',
    invariant: 'OPEN and CLOSE name the same game.',
    repair_command: 'do the thing'
  }

  // 9,160 drifted markets emit 9,160 rows plus 6 clean per-book sentinels. The
  // honest denominator is the scanned population, and 9,160 / 179,175 is 5.1%.
  it('reports the scanned population, not the emitted row count', () => {
    const message = finding_message({
      check,
      finding_count: 9160,
      graded: 9167,
      smallest_denominator: 179175,
      largest_denominator: 363570,
      summary: 'a sample'
    })

    expect(message).to.match(/scanned population 179175-363570/)
    expect(message).to.match(/9160 finding\(s\) across 9167 graded row\(s\)/)
  })

  // The wording carries the whole fix, so it is asserted rather than assumed.
  // "over N graded units" invites exactly the ratio the reader must not compute.
  it('never phrases the row count as the denominator of a rate', () => {
    const message = finding_message({
      check,
      finding_count: 9160,
      graded: 9167,
      smallest_denominator: 179175,
      largest_denominator: 363570,
      summary: 'a sample'
    })

    expect(message).to.not.match(/over \d+ graded unit/)
  })

  // The same artifact in the other direction, and the reason a fix that only
  // special-cased huge finding counts would not be general: 4 findings over 9
  // emitted rows reads as a gradeability collapse until the population appears.
  it('makes a small emitted-row count legible too', () => {
    const message = finding_message({
      check: { ...check, check_id: 'prop-market-selection-grade-consistency' },
      finding_count: 4,
      graded: 9,
      smallest_denominator: 132086,
      largest_denominator: 132086,
      summary: 'a sample'
    })

    expect(message).to.match(/4 finding\(s\) across 9 graded row\(s\)/)
    expect(message).to.match(/scanned population 132086-132086/)
  })
})

describe('data checks / runner disposition', function () {
  const fixture_check = ({ check_id, rows, ...overrides }) => ({
    check_id,
    invariant: 'Something must hold.',
    grain: ['scope'],
    max_count: 0,
    calibration: 'Measured today.',
    min_gradeable_units: 1,
    repair_command: 'do the thing',
    rows,
    ...overrides
  })

  const clean_rows = async () => [
    { scope: 'all', numerator: 0, denominator: 1000 }
  ]

  // A finding is reported and does not make the check ill. Under NODE_ENV=test
  // `config.signals_api_url` is empty, so the emit declines and shows up as a
  // failed emit -- which is itself correct behaviour. What must NOT appear is
  // the check being counted as crashed or below its coverage floor.
  it('does NOT turn the run red BECAUSE of a finding', async () => {
    const { total_findings, unhealthy } = await run_data_checks({
      checks: [
        fixture_check({
          check_id: 'finds-something',
          rows: async () => [{ scope: 'all', numerator: 3, denominator: 1000 }]
        })
      ],
      parked_entries: []
    })

    expect(total_findings).to.equal(1)
    expect(unhealthy.join(' ')).to.not.match(/crashed/)
    expect(unhealthy.join(' ')).to.not.match(/below coverage floor/)
  })

  // One broken query must not silently green the rest of the registry.
  it('isolates a crashing check and still runs the others', async () => {
    const ran = []

    const { unhealthy } = await run_data_checks({
      checks: [
        fixture_check({
          check_id: 'first',
          rows: async () => {
            ran.push('first')
            return clean_rows()
          }
        }),
        fixture_check({
          check_id: 'crashes',
          rows: async () => {
            throw new Error('query exploded')
          }
        }),
        fixture_check({
          check_id: 'third',
          rows: async () => {
            ran.push('third')
            return clean_rows()
          }
        })
      ],
      parked_entries: []
    })

    expect(ran).to.deep.equal(['first', 'third'])
    expect(unhealthy.join(' ')).to.match(/crashed: crashes/)
  })

  it('turns the run red on a coverage collapse, separately from a crash', async () => {
    const { unhealthy } = await run_data_checks({
      checks: [
        fixture_check({
          check_id: 'collapsed',
          min_gradeable_units: 5,
          rows: clean_rows
        })
      ],
      parked_entries: []
    })

    expect(unhealthy.join(' ')).to.match(/below coverage floor: collapsed/)
    expect(unhealthy.join(' ')).to.not.match(/crashed/)
  })

  it('refuses to run at all when a check is missing a required field', async () => {
    const broken = fixture_check({ check_id: 'no-floor', rows: clean_rows })
    delete broken.min_gradeable_units

    let error
    try {
      await run_data_checks({ checks: [broken], parked_entries: [] })
    } catch (err) {
      error = err
    }

    expect(error).to.be.an('error')
    expect(error.message).to.match(/min_gradeable_units/)
  })
})

describe('data check registry / load-time validation', function () {
  const valid_check = () => ({
    check_id: 'example-check',
    invariant: 'Something must hold.',
    grain: ['season_year'],
    rows: async () => [],
    max_count: 0,
    calibration: 'Measured today: zero.',
    min_gradeable_units: 1,
    repair_command: 'do the thing'
  })

  it('accepts the shipped registry', () => {
    expect(() => validate_registry({ checks: registry })).to.not.throw()
  })

  it('accepts a well-formed check', () => {
    expect(() => validate_registry({ checks: [valid_check()] })).to.not.throw()
  })

  // The consequential one. An absent floor does not throw at grading time --
  // `graded < undefined` is false -- so the check keeps running with no
  // coverage guarantee at all and nothing anywhere says so.
  it('throws on a check with no min_gradeable_units', () => {
    const check = valid_check()
    delete check.min_gradeable_units

    expect(() => validate_registry({ checks: [check] })).to.throw(
      /min_gradeable_units/
    )
  })

  for (const field of ['invariant', 'calibration', 'repair_command']) {
    it(`throws on a check with no ${field}`, () => {
      const check = valid_check()
      delete check[field]

      expect(() => validate_registry({ checks: [check] })).to.throw(field)
    })

    it(`throws on a check whose ${field} is whitespace`, () => {
      const check = valid_check()
      check[field] = '   '

      expect(() => validate_registry({ checks: [check] })).to.throw(field)
    })
  }

  it('throws on a check declaring neither threshold', () => {
    const check = valid_check()
    delete check.max_count

    expect(() => validate_registry({ checks: [check] })).to.throw(/min_rate/)
  })

  it('throws on a check declaring both thresholds', () => {
    expect(() =>
      validate_registry({ checks: [{ ...valid_check(), min_rate: 1.0 }] })
    ).to.throw(/min_rate/)
  })

  it('throws on a check with no rows function', () => {
    const check = valid_check()
    check.rows = 'not a function'

    expect(() => validate_registry({ checks: [check] })).to.throw(/rows/)
  })

  it('throws on a check with an empty grain', () => {
    const check = valid_check()
    check.grain = []

    expect(() => validate_registry({ checks: [check] })).to.throw(/grain/)
  })

  // Two rows sharing an id would emit and resolve on ONE pair of pinned
  // fingerprints, so each would close the other's open signal.
  it('throws on a duplicate check_id', () => {
    expect(() =>
      validate_registry({ checks: [valid_check(), valid_check()] })
    ).to.throw(/repeats the check_id/)
  })

  it('throws on an empty registry', () => {
    expect(() => validate_registry({ checks: [] })).to.throw(/non-empty/)
  })

  it('throws on a non-positive min_denominator', () => {
    expect(() =>
      validate_registry({ checks: [{ ...valid_check(), min_denominator: 0 }] })
    ).to.throw(/min_denominator/)
  })

  it('throws on a precondition that is not a function', () => {
    expect(() =>
      validate_registry({
        checks: [{ ...valid_check(), precondition: 'nope' }]
      })
    ).to.throw(/precondition/)
  })
})

describe('data check registry', function () {
  const checks_by_id = new Map(registry.map((check) => [check.check_id, check]))

  /*
    Drives nflfastr-dropback-coverage's DECLARED min_rate against the two
    readings its calibration names. This is the coverage the deleted
    scripts.audit-route-share-coverage spec used to carry: it pinned
    COVERAGE_FLOOR = 0.8 against the corpus first percentile (0.857) and the
    real 2021 week 15 defect (0.425). Without it, moving the floor to 0.9 passes
    every other test in this file while turning roughly the first percentile of
    a 533-week corpus red.
  */
  describe('nflfastr-dropback-coverage calibration', function () {
    const dropback = checks_by_id.get('nflfastr-dropback-coverage')

    const week_at = (rate) => ({
      season_year: 2021,
      week: 15,
      season_type: 'REG',
      numerator: Math.round(1000 * rate),
      denominator: 1000
    })

    it('passes the healthy first-percentile reading of 0.857', () => {
      const result = classify_check_rows({
        rows: [week_at(0.857)],
        check: dropback,
        parked: []
      })

      expect(result.gradeable).to.have.lengthOf(1)
      expect(result.findings).to.have.lengthOf(0)
    })

    it('reports the real 2021 week 15 defect reading of 0.425', () => {
      const result = classify_check_rows({
        rows: [week_at(0.425)],
        check: dropback,
        parked: []
      })

      expect(result.findings).to.have.lengthOf(1)
    })

    it('passes the observed healthy minimum of 0.8493', () => {
      const result = classify_check_rows({
        rows: [week_at(0.8493)],
        check: dropback,
        parked: []
      })

      expect(result.findings).to.have.lengthOf(0)
    })
  })

  // Pins what pfr-gamelog-agreement can and cannot see, through its SHIPPED
  // precondition. The calibration claimed for a while that a single missing
  // game "reads about 0.94 and is detectable"; it is not, because the
  // precondition compares game COUNTS and rejects the week before any ratio is
  // computed. Asserting it here is what stops that claim drifting back in.
  describe('pfr-gamelog-agreement reach', function () {
    const pfr = checks_by_id.get('pfr-gamelog-agreement')

    const week_rows = ({ week, our_games, reference_games, ratio }) =>
      ['receptions', 'receiving_yards', 'targets'].map((stat) => ({
        season_year: 2022,
        week,
        stat,
        our_games,
        reference_games,
        numerator: 1000 * ratio,
        denominator: 1000
      }))

    it('reports a week MISSING a whole game as un-gradeable, never as a finding', () => {
      const result = classify_check_rows({
        rows: week_rows({
          week: 18,
          our_games: 9,
          reference_games: 16,
          ratio: 0.44
        }),
        check: pfr,
        parked: []
      })

      expect(result.ungradeable).to.have.lengthOf(3)
      expect(result.gradeable).to.have.lengthOf(0)
      expect(result.findings).to.have.lengthOf(0)
    })

    it('DOES report disagreement within games both sides cover', () => {
      const result = classify_check_rows({
        rows: week_rows({
          week: 8,
          our_games: 16,
          reference_games: 16,
          ratio: 0.94
        }),
        check: pfr,
        parked: []
      })

      expect(result.gradeable).to.have.lengthOf(3)
      expect(result.findings).to.have.lengthOf(3)
    })
  })

  it('holds thirty-four checks with unique ids', () => {
    expect(registry).to.have.lengthOf(34)
    expect(checks_by_id.size).to.equal(registry.length)
  })

  registry.forEach((check) => {
    describe(check.check_id, function () {
      it('declares a grain', () => {
        expect(check.grain).to.be.an('array')
        expect(check.grain).to.not.be.empty
      })

      it('declares a callable rows function', () => {
        expect(check.rows).to.be.a('function')
      })

      it('declares a usable min_denominator or none at all', () => {
        if (check.min_denominator === undefined) return
        expect(check.min_denominator).to.be.a('number')
        expect(check.min_denominator).to.be.above(0)
      })

      it('declares exactly one of min_rate / max_count', () => {
        const declared = [check.min_rate, check.max_count].filter(
          (value) => value !== undefined
        )
        expect(declared).to.have.lengthOf(1)
      })

      it('carries non-empty calibration prose', () => {
        // A threshold with no recorded distribution is a number nobody can
        // re-derive, and the first reader to see a finding cannot tell laxity
        // from a source limit.
        expect(check.calibration).to.be.a('string')
        expect(check.calibration.trim()).to.not.equal('')
      })

      it('carries an invariant, a repair command and a detector-health floor', () => {
        expect(check.invariant).to.be.a('string').and.not.equal('')
        expect(check.repair_command).to.be.a('string').and.not.equal('')
        expect(check.min_gradeable_units).to.be.a('number')
      })
    })
  })

  it('declares a precondition on every check comparing against an external reference', () => {
    // A check that cannot refresh its reference MUST be able to say the
    // reference is too thin to judge against -- otherwise an incomplete
    // reference inverts the comparison and a one-sided floor passes it.
    const external_reference_checks = ['pfr-gamelog-agreement']

    for (const check_id of external_reference_checks) {
      expect(checks_by_id.get(check_id).precondition, check_id).to.be.a(
        'function'
      )
    }
  })

  it('loads db/checks/parked.json with zero schema errors', () => {
    expect(() =>
      load_parked({ entries: parked_entries, checks_by_id })
    ).to.not.throw()
  })

  it('parks baselined debt only where a repair genuinely cannot land', () => {
    // The set is pinned rather than the count, so a baselined entry appearing
    // on a different check is visible in this file. Debt is the exception:
    // gamelog-orphans, for one, measured zero on all four child tables on
    // 2026-08-14 and ships as a regression detector over a clean population, so
    // a baselined entry there would suppress nothing and report stale forever.
    //
    // Two checks genuinely hold it, and both for the same reason: the missing
    // data cannot be fetched again, so no repair command exists to clear the
    // finding and adjudicating it would assert the absence is correct.
    //
    // adp-source-season-coverage -- the ADP vendors serve the current season
    // only, so its 2025 findings are unrecoverable by construction.
    //
    // prop-market-selection-coverage -- no book serves closing prices for a
    // settled game, and the lost selections are absent from
    // prop_market_selections_history as well as from the index, so they cannot
    // be replayed from anything we hold.
    //
    // Its two 2026 book-seasons were left unparked when the check landed and
    // were adjudicated on 2026-09-02, so both are now parked with a cause
    // rather than as unexplained debt. They are the two entries here that a
    // reader should NOT expect to behave like the rest. PRIZEPICKS 2026 is a
    // fixed numerator against a growing denominator and is expected to report
    // STALE within days, which is its designed close rather than a defect in
    // the entry. BETMGM 2026 is the only baselined entry on this check whose
    // repair is a code change -- the header over-declares selection_count on
    // placeholder markets, so no data was lost and the owning task clears it.
    const baselined = parked_entries.filter(
      (entry) => entry.disposition === 'baselined'
    )

    expect(
      [...new Set(baselined.map((entry) => entry.check_id))].sort()
    ).to.deep.equal([
      'adp-source-season-coverage',
      'prop-market-selection-coverage'
    ])

    for (const entry of baselined) {
      expect(entry.owner, entry.check_id).to.be.a('string')
    }
  })
})
