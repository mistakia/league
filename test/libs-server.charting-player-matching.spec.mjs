/* global describe it before after beforeEach */

import * as chai from 'chai'

import db from '#db'
import { current_season, player_nfl_status } from '#constants'
import {
  match_charting_player,
  reset_sumer_id_cache
} from '#libs-server/charting-data/player-matching.mjs'
import { isolate_player_cache } from './utils/player-cache-isolation.mjs'

const expect = chai.expect
chai.should()

// match_charting_player used to scope every lookup by `current_nfl_team` and by
// player_cache's default "active now" filters. Both describe the player TODAY,
// which is the wrong season for every historical charting row -- and they fail
// in both directions at once: the team filter loses a player who has since been
// traded, `ignore_retired` loses every player who has since retired.
//
// The historical season here is deliberately expressed against current_season
// rather than hardcoded, so these cases keep meaning what they say as the clock
// moves. See CLAUDE.md on clock-derived fixtures.
const HISTORICAL_SEASON = current_season.year - 6
const TRADED_PID = 'TEST-CHRT-000001'
const RETIRED_PID = 'TEST-CHRT-000002'
const WRONG_ERA_PID = 'TEST-CHRT-000003'

const ALL_PIDS = [TRADED_PID, RETIRED_PID, WRONG_ERA_PID]

const make_player = (overrides) => ({
  first_name: 'Charting',
  last_name: 'Fixture',
  short_name: 'C.Fixture',
  formatted_name: 'charting fixture',
  primary_position: 'WR',
  secondary_position: 'WR',
  date_of_birth: '0000-00-00',
  nfl_draft_year: HISTORICAL_SEASON - 2,
  draft_round: 3,
  jersey_number: 17,
  current_nfl_team: 'KC',
  ...overrides
})

describe('LIBS-SERVER match_charting_player season scoping', function () {
  // player_cache is a singleton shared by every spec file -- see
  // test/utils/player-cache-isolation.mjs.
  const reload_cache = isolate_player_cache()

  before(async () => {
    await db('player').whereIn('pid', ALL_PIDS).del()
    await db('player').insert([
      // Played the historical season for BUF; plays for KC today.
      make_player({
        pid: TRADED_PID,
        first_name: 'Traded',
        formatted_name: 'traded fixture',
        current_nfl_team: 'KC'
      }),
      // Played the historical season; retired since.
      make_player({
        pid: RETIRED_PID,
        first_name: 'Retiredchart',
        formatted_name: 'retiredchart fixture',
        roster_status: player_nfl_status.RETIRED,
        current_nfl_team: 'INA'
      }),
      // The only row carrying this name, and it entered the league years AFTER
      // the season being imported.
      make_player({
        pid: WRONG_ERA_PID,
        first_name: 'Wrongera',
        formatted_name: 'wrongera fixture',
        nfl_draft_year: current_season.year,
        draft_round: 1
      })
    ])
  })

  after(async () => {
    await db('player').whereIn('pid', ALL_PIDS).del()
    reset_sumer_id_cache()
  })

  beforeEach(async () => {
    reset_sumer_id_cache()
    await reload_cache({ all_players: true })
  })

  // Characterization, not a fix: this case already passed before the season
  // scoping, because the no-team fallback catches it. It is here to pin that
  // the fallback survives -- dropping the team filter on the historical path
  // must not be the only thing making this work.
  it('matches a since-traded player against the season he actually charted in', async () => {
    // The charting row says BUF, the player row says KC. Scoped to the
    // historical season, today's team is not evidence and must not exclude him.
    const pid = await match_charting_player({
      football_name: 'Traded',
      last_name: 'Fixture',
      team_code: 'BUF',
      jersey_number: 17,
      season_year: HISTORICAL_SEASON
    })
    expect(
      pid,
      'the traded player was lost to the current-team filter'
    ).to.equal(TRADED_PID)
  })

  it('matches a since-retired player in a historical season', async () => {
    // `ignore_retired` defaults ON in player_cache, and for an old season that
    // filter removes most of the roster.
    const pid = await match_charting_player({
      football_name: 'Retiredchart',
      last_name: 'Fixture',
      team_code: 'BUF',
      jersey_number: 17,
      season_year: HISTORICAL_SEASON
    })
    expect(pid, 'the retired player was lost to the recency filter').to.equal(
      RETIRED_PID
    )
  })

  it('refuses a single same-named match that could not have played that season', async () => {
    // The dangerous case: exactly one row carries the name, so there is no
    // ambiguity for player_cache to abstain on, and the old code returned it
    // with full confidence. The next step WRITES sumer_player_id onto that row,
    // which is what makes the wrong match permanent.
    const pid = await match_charting_player({
      football_name: 'Wrongera',
      last_name: 'Fixture',
      jersey_number: 17,
      season_year: HISTORICAL_SEASON
    })
    expect(pid, 'an era-impossible row was matched confidently').to.equal(null)
  })

  it('still honors the current team when the season IS the current one', async () => {
    // Dropping the team filter is scoped to historical seasons only. For the
    // current season `current_nfl_team` is exactly the right evidence, and a
    // charting row naming a different team should not resolve to this player.
    const pid = await match_charting_player({
      football_name: 'Traded',
      last_name: 'Fixture',
      team_code: 'KC',
      jersey_number: 17,
      season_year: current_season.year
    })
    pid.should.equal(TRADED_PID)
  })

  it('does not falsify a match when no season is supplied', async () => {
    // Absent evidence is not a rejection. A caller that has not been updated
    // keeps its previous behaviour rather than silently losing players.
    const pid = await match_charting_player({
      football_name: 'Wrongera',
      last_name: 'Fixture',
      jersey_number: 17
    })
    pid.should.equal(WRONG_ERA_PID)
  })
})
