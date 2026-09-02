/* global describe it */

import * as chai from 'chai'

import {
  get_caesars_market_team,
  is_team_grain_market_type
} from '#libs-server/caesars/caesars-team-attribution.mjs'
import {
  team_game_market_types,
  team_grain_market_types
} from '#libs-shared/bookmaker-constants.mjs'

const expect = chai.expect

describe('LIBS-SERVER caesars team attribution', function () {
  describe('is_team_grain_market_type', function () {
    it('splits team_game_market_types on the TEAM token, not a prefix', () => {
      // GAME_ALT_TEAM_TOTAL is team grain and does NOT start with GAME_TEAM_,
      // so a startsWith rule would drop it. This is the case that distinguishes
      // the two rules.
      expect(
        is_team_grain_market_type(team_game_market_types.GAME_ALT_TEAM_TOTAL)
      ).to.equal(true)
      expect(
        is_team_grain_market_type(team_game_market_types.GAME_TEAM_TOTAL)
      ).to.equal(true)
      expect(
        is_team_grain_market_type(
          team_game_market_types.GAME_TEAM_FIRST_HALF_TOTAL_YARDS
        )
      ).to.equal(true)
    })

    it('rejects every GAME-grain member of the same group', () => {
      // Enumerated from the group, not from the names that prompted this.
      const game_grain = Object.values(team_game_market_types).filter(
        (market_type) => !market_type.split('_').includes('TEAM')
      )
      expect(game_grain).to.include(team_game_market_types.GAME_SPREAD)
      expect(game_grain).to.include(
        team_game_market_types.GAME_FIRST_HALF_TOTAL
      )
      for (const market_type of game_grain) {
        expect(is_team_grain_market_type(market_type), market_type).to.equal(
          false
        )
      }
    })

    it('partitions the group with nothing left over', () => {
      const all = Object.values(team_game_market_types)
      const team_grain = all.filter((market_type) =>
        team_grain_market_types.has(market_type)
      )
      const game_grain = all.filter(
        (market_type) => !team_grain_market_types.has(market_type)
      )

      // Both halves are non-empty, so neither assertion below can pass
      // vacuously on an empty set.
      expect(team_grain.length).to.be.above(0)
      expect(game_grain.length).to.be.above(0)
      expect(team_grain.length + game_grain.length).to.equal(all.length)
      expect(team_grain_market_types.size).to.equal(team_grain.length)
    })

    it('rejects a player market type', () => {
      expect(is_team_grain_market_type('GAME_PASSING_YARDS')).to.equal(false)
    })
  })

  describe('get_caesars_market_team', function () {
    // Every market name below is a verbatim market-name segment stored in
    // prop_markets_index for a CAESARS team-grain market, one per name form
    // Caesars has used, plus each abbreviation fixTeam does not take verbatim.
    const cases = [
      // abbreviation form, the 2024-era templates
      ['MIN Total Team Passing Yards', ['MIN', 'NYG'], 'MIN'],
      ['NYG Total Team Passing Yards', ['MIN', 'NYG'], 'NYG'],
      ['SEA Total Points', ['LA', 'SEA'], 'SEA'],
      ['ATL Total Points', ['ATL', 'LV'], 'ATL'],
      // the three Caesars abbreviations that are not the canonical form
      ['WSC Total Points', ['WAS', 'PHI'], 'WAS'],
      ['LVR Total Points', ['LV', 'ATL'], 'LV'],
      ['NOR Total Points', ['NO', 'TB'], 'NO'],
      // full-name form, the live Team Total Points template
      ['Seattle Seahawks Total Points', ['LA', 'SEA'], 'SEA'],
      ['Los Angeles Rams Total Points', ['LA', 'SEA'], 'LA'],
      ['Los Angeles Chargers Total Points', ['LAC', 'KC'], 'LAC'],
      ['San Francisco 49ers Total Points', ['SF', 'NE'], 'SF'],
      ['New York Giants Total Points', ['NYG', 'NYJ'], 'NYG'],
      ['New York Jets Total Points', ['NYG', 'NYJ'], 'NYJ']
    ]

    for (const [market_name, game_nfl_teams, expected] of cases) {
      it(`resolves ${market_name}`, () => {
        expect(
          get_caesars_market_team({ market_name, game_nfl_teams })
        ).to.equal(expected)
      })
    }

    it('returns null rather than a confident wrong team when the prefix names neither side', () => {
      // The failure mode a bare parse cannot report: a real team prefix, but
      // not one of this game's teams.
      expect(
        get_caesars_market_team({
          market_name: 'SEA Total Points',
          game_nfl_teams: ['BUF', 'MIA']
        })
      ).to.equal(null)
    })

    it('returns null on a market name with no team prefix at all', () => {
      expect(
        get_caesars_market_team({
          market_name: 'Total Points',
          game_nfl_teams: ['LA', 'SEA']
        })
      ).to.equal(null)
    })

    it('returns null on missing inputs', () => {
      expect(
        get_caesars_market_team({
          market_name: null,
          game_nfl_teams: ['LA', 'SEA']
        })
      ).to.equal(null)
      expect(
        get_caesars_market_team({
          market_name: 'SEA Total Points',
          game_nfl_teams: []
        })
      ).to.equal(null)
    })
  })
})
