/* global describe it */

import * as chai from 'chai'

import db from '#db'
import {
  FACT_SOURCES,
  SUBJECT_ATTRIBUTIONS,
  SUBJECT_ID_LOOKUPS,
  resolve_fact_source,
  subject_id_expression,
  validate_fact_source
} from '#libs-server/data-views/measure/fact-source-registry.mjs'
import { resolve_source_table } from '#libs-server/data-views/output-aggregator/measure-batch.mjs'

const expect = chai.expect

// `measure_source` conflated how a fact attributes to a subject with where the
// subject id is read from, and the period-CTE builder carried the conflation as
// a `pid_via` enum plus its own copy of the source table map. The registry owns
// both questions now; these pin the contract every consumer reads.

describe('data views fact source registry', function () {
  it('declares all four fields on every entry', function () {
    const names = Object.keys(FACT_SOURCES)
    // A floor, so a refactor that empties the registry cannot report
    // compliance over nothing.
    expect(names.length).to.be.at.least(5)
    for (const name of names) {
      const source = FACT_SOURCES[name]
      expect(source.table, `${name}.table`).to.be.a('string').and.not.empty
      expect(SUBJECT_ATTRIBUTIONS, `${name}.subject_attribution`).to.include(
        source.subject_attribution
      )
      expect(SUBJECT_ID_LOOKUPS, `${name}.subject_id_lookup`).to.include(
        source.subject_id_lookup
      )
      expect(source.partition_periods, `${name}.partition_periods`).to.be.an(
        'array'
      ).and.not.empty
    }
  })

  it('resolves an absent or unknown source to gamelogs', function () {
    // Back-compat with the legacy
    // `measure_source === 'plays' ? 'nfl_plays' : 'player_gamelogs'` semantic.
    expect(resolve_fact_source(undefined).table).to.equal('player_gamelogs')
    expect(resolve_fact_source('not_a_source').table).to.equal(
      'player_gamelogs'
    )
  })

  it('is the only source-table map — measure-batch reads it', function () {
    // `resolve_source_table` feeds `measure_expr`, whose rendered SQL is hashed
    // into every `m_<hash>` alias, so a second map drifting from this one moves
    // aliases in every golden.
    for (const [name, source] of Object.entries(FACT_SOURCES)) {
      expect(resolve_source_table(name), name).to.equal(source.table)
    }
    expect(resolve_source_table(undefined)).to.equal('player_gamelogs')
  })

  it('coalesces role columns in their DECLARED order', function () {
    // Order is load-bearing, not cosmetic: measured against production over
    // 2023+, `passer_pid` and `target_pid` are both non-null and different on
    // 60,547 plays, so a COALESCE naming one before the other credits a
    // different player on every pass.
    const plays = FACT_SOURCES.plays
    expect(
      subject_id_expression({
        fact_source: plays,
        role_columns: ['target_pid', 'passer_pid']
      }).expression
    ).to.equal('COALESCE(nfl_plays.target_pid, nfl_plays.passer_pid)')
    expect(
      subject_id_expression({
        fact_source: plays,
        role_columns: ['passer_pid', 'target_pid']
      }).expression
    ).to.equal('COALESCE(nfl_plays.passer_pid, nfl_plays.target_pid)')
  })

  it('emits a bare column for one role and for a direct source', function () {
    expect(
      subject_id_expression({
        fact_source: FACT_SOURCES.plays,
        role_columns: ['ball_carrier_pid']
      })
    ).to.deep.equal({
      expression: 'nfl_plays.ball_carrier_pid',
      requires_player_join: false
    })
    expect(
      subject_id_expression({ fact_source: FACT_SOURCES.gamelogs })
    ).to.deep.equal({
      expression: 'player_gamelogs.pid',
      requires_player_join: false
    })
  })

  it('reaches a gsis-bridged subject through the player join', function () {
    for (const name of ['snaps', 'plays_receiver']) {
      expect(
        subject_id_expression({ fact_source: FACT_SOURCES[name] }),
        name
      ).to.deep.equal({
        expression: 'player.pid',
        requires_player_join: true
      })
    }
  })

  describe('cohort expansion', function () {
    it('reads the subject id off the MEMBERS row, not the fact row', function () {
      // nfl_plays names a team play and carries no member at all, so a cohort
      // source that resolved against the fact table would group by a column
      // that cannot identify a subject.
      expect(
        subject_id_expression({ fact_source: FACT_SOURCES.plays_cohort })
      ).to.deep.equal({
        expression: 'pg.pid',
        requires_player_join: false
      })
    })

    it('emits the join create_team_share_stat already emits', function () {
      // The conversion must not move the share's SCAN -- the fan-out it pays is
      // the one production pays today. Compare the emitted join against the
      // incumbent CTE's, written here verbatim so a drift in either shows up as
      // a text difference rather than as a silently different denominator.
      const candidate = db('nfl_plays').select('pg.pid')
      FACT_SOURCES.plays_cohort.cohort_expansion.join(candidate)

      const incumbent = db('nfl_plays')
        .select('pg.pid')
        .join('player_gamelogs as pg', function () {
          this.on('nfl_plays.esbid', '=', 'pg.esbid').andOn(
            'nfl_plays.offense_nfl_team',
            '=',
            'pg.nfl_team'
          )
        })

      expect(candidate.toString()).to.equal(incumbent.toString())
    })

    it('refuses a cohort attribution with no expansion to name its members', function () {
      const { cohort_expansion, ...without_expansion } =
        FACT_SOURCES.plays_cohort
      expect(cohort_expansion).to.be.an('object')
      expect(() =>
        validate_fact_source('synthetic', without_expansion)
      ).to.throw(/must declare a cohort_expansion/)
    })

    it('refuses the two halves declared apart', function () {
      // Either half alone emits a scan that attributes to nobody, and neither
      // failure is visible in the SQL.
      expect(() =>
        validate_fact_source('synthetic', {
          ...FACT_SOURCES.plays_cohort,
          subject_id_lookup: 'column',
          subject_id_column: 'pid'
        })
      ).to.throw(/reads its subject id from 'column'/)

      expect(() =>
        validate_fact_source('synthetic', {
          ...FACT_SOURCES.plays_cohort,
          subject_attribution: 'direct'
        })
      ).to.throw(/does not attribute through one/)
    })

    it('accepts the registry entry it ships', function () {
      // The positive control: the three refusals above are only meaningful if
      // the real declaration passes the same function.
      expect(() =>
        validate_fact_source('plays_cohort', FACT_SOURCES.plays_cohort)
      ).to.not.throw()
    })
  })
})
