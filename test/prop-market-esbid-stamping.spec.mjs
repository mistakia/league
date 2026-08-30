/* global describe, before, beforeEach, it */
import * as chai from 'chai'

import knex from '#db'
import insert_prop_markets from '#libs-server/insert-prop-markets.mjs'
import {
  extract_prizepicks_games,
  match_prizepicks_game
} from '#scripts/import-prizepicks-odds.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Two real 2024 games. NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww is stamped with both
// in production -- 43 index rows on the first and 379 on the second -- which is
// the drift this file exists to stop.
const WEEK_12_ESBID = 2024112404
const WEEK_13_ESBID = 2024112802

const market_row = ({
  source_market_id,
  time_type,
  esbid,
  season_year = 2024,
  is_market_settled = false
}) => ({
  source_id: 'PRIZEPICKS',
  source_market_id,
  time_type,
  market_type: 'GAME_RUSHING_YARDS',
  source_market_name: 'Rush Yards',
  source_event_id: 'NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww',
  esbid,
  season_year,
  is_open: true,
  is_live: false,
  selection_count: 2,
  is_market_settled,
  observed_at: new Date('2024-11-24T17:00:00Z')
})

const import_market = ({ source_market_id, esbid, season_year }) => ({
  source_id: 'PRIZEPICKS',
  source_market_id,
  market_type: 'GAME_RUSHING_YARDS',
  source_market_name: 'Rush Yards',
  source_event_id: 'NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww',
  source_event_name: null,
  esbid,
  season_year,
  is_open: true,
  is_live: false,
  selection_count: 2,
  observed_at: new Date('2024-11-28T17:00:00Z'),
  selections: []
})

describe('prop market esbid stamping', function () {
  this.timeout(60 * 1000)

  describe('settled markets are immune to a moving stamp', function () {
    before(async function () {
      await knex('prop_markets_index').del()
      await knex('prop_markets_history').del()
    })

    beforeEach(async function () {
      await knex('prop_markets_index').del()
      await knex('prop_markets_history').del()
    })

    // Red against the pre-fix code, which used a bare .merge() and so rewrote
    // esbid and season_year on every re-observation regardless of settlement.
    it('leaves esbid and season_year unchanged under a settled market', async function () {
      await knex('prop_markets_index').insert([
        market_row({
          source_market_id: 'settled-market',
          time_type: 'OPEN',
          esbid: WEEK_12_ESBID,
          is_market_settled: true
        }),
        market_row({
          source_market_id: 'settled-market',
          time_type: 'CLOSE',
          esbid: WEEK_12_ESBID,
          is_market_settled: true
        })
      ])

      // The resolver has moved on to a different game -- a later week, or a
      // traded player's new team. The write must not follow it.
      await insert_prop_markets([
        import_market({
          source_market_id: 'settled-market',
          esbid: WEEK_13_ESBID,
          season_year: 2025
        })
      ])

      const rows = await knex('prop_markets_index')
        .where({ source_id: 'PRIZEPICKS', source_market_id: 'settled-market' })
        .orderBy('time_type')

      expect(rows).to.have.lengthOf(2)
      for (const row of rows) {
        expect(Number(row.esbid)).to.equal(WEEK_12_ESBID)
        expect(row.season_year).to.equal(2024)
      }
    })

    // The paired control. Without it a guard that froze the stamp for EVERY
    // market would pass the assertion above, and the check would be vacuous.
    it('still moves the stamp under a market that is not settled', async function () {
      await knex('prop_markets_index').insert([
        market_row({
          source_market_id: 'open-market',
          time_type: 'OPEN',
          esbid: WEEK_12_ESBID,
          is_market_settled: false
        }),
        market_row({
          source_market_id: 'open-market',
          time_type: 'CLOSE',
          esbid: WEEK_12_ESBID,
          is_market_settled: false
        })
      ])

      await insert_prop_markets([
        import_market({
          source_market_id: 'open-market',
          esbid: WEEK_13_ESBID,
          season_year: 2025
        })
      ])

      const rows = await knex('prop_markets_index')
        .where({ source_id: 'PRIZEPICKS', source_market_id: 'open-market' })
        .orderBy('time_type')

      expect(rows).to.have.lengthOf(2)
      for (const row of rows) {
        expect(Number(row.esbid)).to.equal(WEEK_13_ESBID)
        expect(row.season_year).to.equal(2025)
      }
    })

    // A NULL is not a settlement. The column defaults to false but is nullable,
    // and reading NULL as settled would freeze the stamp on every market whose
    // row predates the default.
    it('treats a null is_market_settled as not settled', async function () {
      await knex('prop_markets_index').insert([
        {
          ...market_row({
            source_market_id: 'null-settled-market',
            time_type: 'CLOSE',
            esbid: WEEK_12_ESBID
          }),
          is_market_settled: null
        }
      ])

      await insert_prop_markets([
        import_market({
          source_market_id: 'null-settled-market',
          esbid: WEEK_13_ESBID,
          season_year: 2025
        })
      ])

      const row = await knex('prop_markets_index')
        .where({
          source_id: 'PRIZEPICKS',
          source_market_id: 'null-settled-market',
          time_type: 'CLOSE'
        })
        .first()

      expect(Number(row.esbid)).to.equal(WEEK_13_ESBID)
    })
  })

  describe('resolving a prizepicks game from the payload', function () {
    // The shape PrizePicks actually returns, trimmed to the fields read. The
    // `game` entity sits in the same `included` array as `new_player`.
    const prizepicks_included = [
      {
        type: 'new_player',
        id: '10001',
        attributes: { name: 'Some Player', team: 'MIA' }
      },
      {
        type: 'game',
        id: '162483',
        attributes: {
          external_game_id: 'NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww',
          start_time: '2024-11-24T13:00:00.000-05:00',
          metadata: {
            game_id: 'NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww',
            game_info: {
              teams: {
                away: { abbreviation: 'NE' },
                home: { abbreviation: 'MIA' }
              }
            }
          }
        }
      }
    ]

    const nfl_games = [
      {
        esbid: WEEK_12_ESBID,
        away_nfl_team: 'NE',
        home_nfl_team: 'MIA',
        season_year: 2024,
        kickoff_at: new Date('2024-11-24T13:00:00-05:00')
      },
      {
        esbid: WEEK_13_ESBID,
        away_nfl_team: 'MIA',
        home_nfl_team: 'GB',
        season_year: 2024,
        kickoff_at: new Date('2024-11-28T16:30:00-05:00')
      }
    ]

    it('extracts the game entity keyed by the book game id', function () {
      const games = extract_prizepicks_games(prizepicks_included)

      expect(games.size).to.equal(1)
      expect(games.get('NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww')).to.exist
    })

    it('resolves the game from the two teams and the kickoff', function () {
      const matched = match_prizepicks_game({
        prizepicks_game: extract_prizepicks_games(prizepicks_included).get(
          'NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww'
        ),
        nfl_games
      })

      expect(matched).to.exist
      expect(matched.esbid).to.equal(WEEK_12_ESBID)
    })

    // The paired control against the resolver being replaced. The player was on
    // MIA in week 12 and the game list is that week's, so the team match is
    // right; once he is on GB and the week has moved to 13, the SAME market
    // resolves to a different game. The payload resolver does not move, because
    // nothing it reads moved.
    it('does not follow the player team the way the team match does', function () {
      const team_match = (current_nfl_team, week_games) =>
        week_games.find(
          (game) =>
            game.away_nfl_team === current_nfl_team ||
            game.home_nfl_team === current_nfl_team
        )

      // First observation: correct.
      expect(team_match('MIA', [nfl_games[0]]).esbid).to.equal(WEEK_12_ESBID)
      // Re-observed a week later, after a trade: silently a different game.
      expect(team_match('GB', [nfl_games[1]]).esbid).to.equal(WEEK_13_ESBID)

      const prizepicks_game = extract_prizepicks_games(prizepicks_included).get(
        'NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww'
      )
      // The payload resolver, given the whole season rather than one week and
      // no knowledge of the player at all, answers the same both times.
      expect(
        match_prizepicks_game({ prizepicks_game, nfl_games }).esbid
      ).to.equal(WEEK_12_ESBID)
    })

    it('declines rather than guessing when the game entity is missing', function () {
      expect(match_prizepicks_game({ prizepicks_game: undefined, nfl_games }))
        .to.be.null
    })

    it('declines when no game matches the teams and kickoff', function () {
      const unknown_game = {
        attributes: {
          external_game_id: 'NFL_game_unknown',
          start_time: '2024-11-24T13:00:00.000-05:00',
          metadata: {
            game_info: {
              teams: {
                away: { abbreviation: 'DAL' },
                home: { abbreviation: 'SF' }
              }
            }
          }
        }
      }

      expect(
        match_prizepicks_game({ prizepicks_game: unknown_game, nfl_games })
      ).to.be.null
    })
  })
})
