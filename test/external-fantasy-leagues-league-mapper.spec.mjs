/* global describe, it, before */
import * as chai from 'chai'

import { load_platform_response } from './utils/fixture-loader.mjs'
import { LeagueConfigMapper } from '#libs-server/external-fantasy-leagues/mappers/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()

describe('External Fantasy Leagues - League Config Mapper', function () {
  let sleeper_fixture
  let mapper

  before(async function () {
    sleeper_fixture = await load_platform_response('sleeper', 'league-config')
    mapper = new LeagueConfigMapper()
  })

  describe('map_league_config', function () {
    it('produces scoring_params and league_params for the real Sleeper fixture', function () {
      const league = sleeper_fixture.data.league
      const result = mapper.map_league_config({
        platform: 'sleeper',
        league_config: { num_teams: league.total_rosters },
        scoring_config: league.scoring_settings,
        roster_config: league.roster_positions
      })

      result.should.have.property('scoring_params').that.is.an('object')
      result.should.have.property('league_params').that.is.an('object')
      result.scoring_params.should.have.property('passing_yards')
      result.league_params.should.have.property('num_teams')
    })

    it('throws for an unsupported platform', function () {
      chai
        .expect(() =>
          mapper.map_league_config({
            platform: 'fake-platform',
            league_config: {},
            scoring_config: {},
            roster_config: []
          })
        )
        .to.throw(/Unsupported platform/i)
    })

    it('produces stable params across repeated mappings of the same input', function () {
      const league = sleeper_fixture.data.league
      const args = {
        platform: 'sleeper',
        league_config: { num_teams: league.total_rosters },
        scoring_config: league.scoring_settings,
        roster_config: league.roster_positions
      }
      const a = mapper.map_league_config(args)
      const b = mapper.map_league_config(args)
      JSON.stringify(a.scoring_params).should.equal(
        JSON.stringify(b.scoring_params)
      )
      JSON.stringify(a.league_params).should.equal(
        JSON.stringify(b.league_params)
      )
    })
  })

  describe('map_scoring_config', function () {
    it('converts Sleeper decimal point values into the canonical integer scale', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: {
          pass_yd: 0.04,
          rush_yd: 0.1,
          rec_yd: 0.1,
          pass_td: 6
        }
      })

      result.should.have.property('passing_yards', 4)
      result.should.have.property('rushing_yards', 10)
      result.should.have.property('receiving_yards', 10)
      result.should.have.property('passing_touchdowns', 6)
    })

    it('passes through Sleeper-specific exclude_qb_kneels rule', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: { exclude_qb_kneels: true, pass_yd: 0.04 }
      })

      result.should.have.property('is_excluding_quarterback_kneels', true)
      result.should.have.property('passing_yards', 4)
    })

    it('translates ESPN scoring keys into the canonical scoring_format', function () {
      const result = mapper.map_scoring_config({
        platform: 'espn',
        scoring_config: {
          passing_yards: 0.04,
          passing_touchdowns: 4,
          rushing_yards: 0.1,
          receiving_receptions: 1,
          receiving_yards: 0.1
        }
      })

      result.should.have.property('passing_yards', 4)
      result.should.have.property('passing_touchdowns', 4)
      result.should.have.property('rushing_yards', 10)
      result.should.have.property('receptions', 1)
      result.should.have.property('receiving_yards', 10)
    })

    it('maps Sleeper field goal distance bands and extra points', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: {
          fgm_0_19: 3,
          fgm_20_29: 3,
          fgm_30_39: 3,
          fgm_40_49: 4,
          fgm_50p: 5,
          xpm: 1
        }
      })

      result.should.have.property('field_goals_made_0_19_yards', 3)
      result.should.have.property('field_goals_made_20_29_yards', 3)
      result.should.have.property('field_goals_made_30_39_yards', 3)
      result.should.have.property('field_goals_made_40_49_yards', 4)
      result.should.have.property('field_goals_made_50_plus_yards', 5)
      result.should.have.property('extra_points_made', 1)
    })

    // Scoring is additive -- bands PLUS a per-yard rate -- and find-or-create
    // fills an absent field_goal_yards from the registry default of 0.1. A
    // banded league that did not zero the rate would score every field goal
    // twice, and nothing downstream could detect it.
    it('zeroes the per-yard field goal rate when Sleeper bands are present', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: { fgm_40_49: 4 }
      })

      result.should.have.property('field_goal_yards', 0)
    })

    it('leaves field_goal_yards absent when the platform scores no bands', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: { pass_yd: 0.04 }
      })

      result.should.not.have.property('field_goal_yards')
    })

    it('maps the flat Sleeper DST events', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: {
          sack: 1,
          int: 2,
          ff: 1,
          fum_rec: 2,
          def_td: 6,
          safe: 2,
          blk_kick: 2,
          pass_int: -2
        }
      })

      result.should.have.property('defensive_sacks', 1)
      result.should.have.property('defensive_interceptions', 2)
      result.should.have.property('defensive_forced_fumbles', 1)
      result.should.have.property('defensive_recovered_fumbles', 2)
      result.should.have.property('defensive_touchdowns', 6)
      result.should.have.property('defensive_safeties', 2)
      result.should.have.property('defensive_blocked_kicks', 2)

      // `int` is the DST interception and `pass_int` the passing one; mapping
      // both onto the same column would be silent and wrong.
      result.should.have.property('passing_interceptions', -2)
    })

    // Sleeper scores points allowed as a seven-band step function, which a
    // rate-beyond-threshold pair cannot represent. Dropping it is deliberate:
    // the registry default of -0.4 per point beyond 20 is OUR scoring, and
    // letting it stand would invent a rule the imported league never had.
    it('drops points-against scoring when Sleeper supplies banded points allowed', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: { pts_allow_0: 10, pts_allow_35p: -4 }
      })

      result.should.have.property('defensive_points_against', 0)
    })

    it('leaves points-against absent when no banded points allowed are supplied', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: { sack: 1 }
      })

      result.should.not.have.property('defensive_points_against')
    })

    // Every sibling default is 0 and no platform map carries a source key for
    // this column, so a nonzero default was the only value it could ever take
    // -- it silently gave every imported league six points per fumble return
    // touchdown whether or not the platform scored them.
    it('defaults fumble return touchdowns to zero, like every sibling', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: { pass_yd: 0.04 }
      })

      result.should.have.property('fumble_return_touchdowns', 0)
    })

    // The 21 kicking and DST columns are absent by design so find-or-create
    // fills them from the registry, rather than minting a format that scores
    // all of them at nothing.
    it('omits unmapped kicking and DST columns rather than zeroing them', function () {
      const result = mapper.map_scoring_config({
        platform: 'sleeper',
        scoring_config: { pass_yd: 0.04 }
      })

      result.should.not.have.property('defensive_sacks')
      result.should.not.have.property('extra_points_made')
      result.should.not.have.property('defensive_points_against_threshold')
    })
  })

  describe('validate_mapped_config', function () {
    it('returns true for a fully-mapped Sleeper config from the real fixture', function () {
      const league = sleeper_fixture.data.league
      const mapped = mapper.map_league_config({
        platform: 'sleeper',
        league_config: { num_teams: league.total_rosters },
        scoring_config: league.scoring_settings,
        roster_config: league.roster_positions
      })

      mapper.validate_mapped_config(mapped).should.equal(true)
    })

    it('returns false for a config with no starting roster slots', function () {
      const mapped = mapper.map_league_config({
        platform: 'sleeper',
        league_config: { num_teams: 12 },
        scoring_config: { pass_yd: 0.04 },
        roster_config: ['BN', 'BN']
      })

      mapper.validate_mapped_config(mapped).should.equal(false)
    })
  })
})
