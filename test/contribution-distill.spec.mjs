/* global describe, it */

import * as chai from 'chai'

import { load_data_view_test_queries_sync } from '#libs-server'
import {
  extract_referenced_relations,
  get_known_relations,
  assert_oracle_admissible,
  assert_admissible_as_red_test,
  build_insert_statement,
  build_fixture,
  ORACLE_KINDS,
  SEED_CHECK_PHASE
} from '../scripts/contribution-distill.mjs'

const expect = chai.expect

// Every assertion in this file runs with NO database. That is deliberate and it
// is the point of the distill step: the artifact it produces is the one that
// runs offline in continuous integration, so the machinery producing it must be
// checkable the same way. The one half that does read production --
// extract_seed_rows -- is exercised through its pool seam in the integration
// spec, not here.

describe('Contribution Reproduction', () => {
  describe('Distill — relation extraction', () => {
    it('resolves relations from real generated data-view SQL', () => {
      const known = get_known_relations()
      expect(known.size).to.be.greaterThan(100)

      const relations = extract_referenced_relations({
        query_string:
          'with "tabc" as materialized (select COALESCE(passer_pid) as pid from "nfl_plays" ' +
          'where "season_year" in (2023)) select "player"."pid" from "player" ' +
          'inner join "nfl_games" on "nfl_games"."esbid" = 1',
        known_relations: known
      })

      expect(relations).to.include('nfl_plays')
      expect(relations).to.include('player')
      expect(relations).to.include('nfl_games')
    })

    it('returns relations sorted and deduplicated', () => {
      const relations = extract_referenced_relations({
        query_string: 'select * from "player", "nfl_plays", "player"',
        known_relations: new Set(['player', 'nfl_plays'])
      })
      expect(relations).to.deep.equal(['nfl_plays', 'player'])
    })

    // The negative control. A matcher that returned every token would pass the
    // assertions above while being useless, so require that it declines a token
    // that is not a granted relation.
    it('does not resolve a token that is not a granted relation', () => {
      const relations = extract_referenced_relations({
        query_string:
          'select "totally_not_a_relation"."x" from "totally_not_a_relation"',
        known_relations: get_known_relations()
      })
      expect(relations).to.deep.equal([])
    })

    // The property the seed extractor depends on: every stored fixture's SQL
    // names at least one relation, so distillation never emits an empty seed
    // for a request the builder could serve.
    it('resolves at least one relation for every stored fixture', () => {
      const known = get_known_relations()
      const fixtures = load_data_view_test_queries_sync().filter(
        (f) => f.expected_query
      )
      expect(fixtures.length).to.be.greaterThan(0)

      const empty = fixtures
        .filter(
          (f) =>
            extract_referenced_relations({
              query_string: f.expected_query,
              known_relations: known
            }).length === 0
        )
        .map((f) => f.filename)

      expect(empty).to.deep.equal([])
    })
  })

  describe('Distill — the correctness oracle', () => {
    it('names exactly the two admissible oracle forms', () => {
      expect(Object.keys(ORACLE_KINDS).sort()).to.deep.equal([
        'expected_rows',
        'reference_sql'
      ])
    })

    it('accepts an independent derivation', () => {
      expect(
        assert_oracle_admissible({ reference_sql: 'select 1 as x' })
      ).to.deep.equal({ kind: 'reference_sql' })
    })

    it('accepts a hand-derived expected value', () => {
      expect(
        assert_oracle_admissible({ expected_rows: [{ x: 1 }] })
      ).to.deep.equal({ kind: 'expected_rows' })
    })

    it('refuses an oracle carrying both forms', () => {
      expect(() =>
        assert_oracle_admissible({
          reference_sql: 'select 1',
          expected_rows: [{ x: 1 }]
        })
      ).to.throw(/exactly one/)
    })

    it('refuses an oracle carrying neither form', () => {
      expect(() => assert_oracle_admissible({})).to.throw(/exactly one/)
    })
  })

  describe('Distill — admissibility as a red test', () => {
    const red_fixture = {
      result_equivalence: {
        seed: ["INSERT INTO player (pid) VALUES ('TEST-AAAA-000001')"],
        reference_sql: 'select 1 as x'
      }
    }

    it('admits a fixture with a real oracle that is red', () => {
      expect(
        assert_admissible_as_red_test({ fixture: red_fixture, is_red: true })
      ).to.deep.equal({ admissible: true })
    })

    // THE CENTRAL PROHIBITION. A characterization oracle is green on the
    // revision it was captured from, so requiring red excludes it without
    // trusting any provenance the author declared.
    it('refuses a fixture that is green on the reported revision', () => {
      expect(() =>
        assert_admissible_as_red_test({ fixture: red_fixture, is_red: false })
      ).to.throw(/GREEN on the reported revision/)
    })

    it('refuses a phase-1 seed check outright, red or not', () => {
      const seed_check = {
        result_equivalence: {
          seed: [],
          expected_rows: [{ x: 1 }],
          phase: SEED_CHECK_PHASE
        }
      }
      expect(() =>
        assert_admissible_as_red_test({ fixture: seed_check, is_red: true })
      ).to.throw(/phase-1 seed check/)
    })

    it('refuses a fixture with no result_equivalence block', () => {
      expect(() =>
        assert_admissible_as_red_test({ fixture: {}, is_red: true })
      ).to.throw(/no result_equivalence/)
    })
  })

  describe('Distill — seed statement rendering', () => {
    it('renders typed literals', () => {
      const statement = build_insert_statement({
        relation: 'player',
        row: {
          pid: 'TEST-AAAA-000001',
          nfl_draft_year: 2020,
          is_active: true,
          secondary_position: null
        }
      })
      expect(statement).to.equal(
        'INSERT INTO player (pid, nfl_draft_year, is_active, secondary_position) ' +
          "VALUES ('TEST-AAAA-000001', 2020, true, NULL)"
      )
    })

    it('escapes a single quote rather than emitting broken SQL', () => {
      const statement = build_insert_statement({
        relation: 'player',
        row: { last_name: "O'Brien" }
      })
      expect(statement).to.equal(
        "INSERT INTO player (last_name) VALUES ('O''Brien')"
      )
    })

    it('omits an undefined column rather than inserting NULL over a default', () => {
      const statement = build_insert_statement({
        relation: 'player',
        row: { pid: 'TEST-AAAA-000001', formatted_name: undefined }
      })
      expect(statement).to.not.include('formatted_name')
    })
  })

  describe('Distill — fixture assembly', () => {
    const request = { columns: ['player_name'], sort: [], where: [] }

    it('emits a fixture the result-equivalence harness would accept', () => {
      const fixture = build_fixture({
        name: 'pooled-rate-over-a-year-range',
        request,
        seed: ["INSERT INTO player (pid) VALUES ('TEST-AAAA-000001')"],
        oracle: { reference_sql: 'select 1 as x' }
      })

      expect(fixture.request).to.deep.equal(request)
      expect(fixture.result_equivalence.seed).to.have.length(1)
      expect(fixture.result_equivalence.reference_sql).to.equal('select 1 as x')
      expect(fixture.result_equivalence.phase).to.equal(undefined)
      // The harness reads exactly one of these two; both present is its own error.
      expect(fixture.result_equivalence.expected_rows).to.equal(undefined)
    })

    it('refuses to assemble a committable fixture with no oracle', () => {
      expect(() =>
        build_fixture({ name: 'x', request, seed: [], oracle: {} })
      ).to.throw(/exactly one/)
    })

    it('marks a phase-1 seed check so it cannot be committed by accident', () => {
      const fixture = build_fixture({
        name: 'x',
        request,
        seed: [],
        oracle: { expected_rows: [{ x: 1 }] },
        seed_check: true
      })
      expect(fixture.result_equivalence.phase).to.equal(SEED_CHECK_PHASE)
      expect(() =>
        assert_admissible_as_red_test({ fixture, is_red: true })
      ).to.throw(/phase-1 seed check/)
    })
  })

  // The standing invariant on the committed fixture directory: a phase-1 seed
  // check must never reach it. This is the gate that makes the prohibition
  // structural rather than a convention in a comment.
  describe('Distill — the committed fixture directory', () => {
    it('carries no phase-1 seed check', () => {
      const leaked = load_data_view_test_queries_sync()
        .filter(
          (f) =>
            f.result_equivalence &&
            f.result_equivalence.phase === SEED_CHECK_PHASE
        )
        .map((f) => f.filename)
      expect(leaked).to.deep.equal([])
    })
  })
})
