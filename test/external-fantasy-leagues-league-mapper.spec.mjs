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

      result.should.have.property('exclude_quarterback_kneels', true)
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
