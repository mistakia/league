/* global describe it before after beforeEach */

import * as chai from 'chai'

import db from '#db'
import player_cache from '#libs-server/player-cache.mjs'
import { player_nfl_status } from '#constants'
import { isolate_player_cache } from './utils/player-cache-isolation.mjs'

const expect = chai.expect
chai.should()

// player_cache.find_player had no spec at all until this file, and it is the
// matcher with the least era awareness of the four. Its filters -- roster_status
// and current_nfl_team !== 'INA' -- are a RECENCY filter, not an era filter, and
// they default to ON. For a historical lookup that is backwards: the players a
// 2011 charting import wants are exactly the ones who have since retired.
//
// It does carry a name + nfl_draft_year composite index, which IS an era scope.
// Nothing requires a caller to use it, and the last two cases below are what
// that costs.

const RETIRED_PID = 'TEST-PCAC-000001'
const ACTIVE_PID = 'TEST-PCAC-000002'
const ERA_OLD_PID = 'TEST-PCAC-000003'
const ERA_NEW_PID = 'TEST-PCAC-000004'
const LONE_WRONG_ERA_PID = 'TEST-PCAC-000005'

const ALL_PIDS = [
  RETIRED_PID,
  ACTIVE_PID,
  ERA_OLD_PID,
  ERA_NEW_PID,
  LONE_WRONG_ERA_PID
]

const make_player = (overrides) => ({
  first_name: 'Cache',
  last_name: 'Fixture',
  short_name: 'C.Fixture',
  formatted_name: 'cache fixture',
  primary_position: 'WR',
  secondary_position: 'WR',
  date_of_birth: '1985-03-04',
  nfl_draft_year: 2007,
  current_nfl_team: 'KC',
  ...overrides
})

describe('LIBS-SERVER player_cache.find_player', function () {
  // The singleton short-circuits preload once initialized, so forcing a reload
  // means clearing the flag -- which mutates state every later spec file shares.
  // isolate_player_cache snapshots and restores it around this block.
  const reload_cache = isolate_player_cache()

  before(async () => {
    await db('player').whereIn('pid', ALL_PIDS).del()
    await db('player').insert([
      // Played 2007-2015, retired since. A historical lookup wants this row.
      make_player({
        pid: RETIRED_PID,
        first_name: 'Retired',
        formatted_name: 'retired fixture',
        roster_status: player_nfl_status.RETIRED,
        current_nfl_team: 'INA'
      }),
      make_player({
        pid: ACTIVE_PID,
        first_name: 'Active',
        formatted_name: 'active fixture',
        gsis_player_id: '00-0099001'
      }),
      // Same name, two eras -- the shape that SHOULD abstain.
      make_player({
        pid: ERA_OLD_PID,
        first_name: 'Twoera',
        formatted_name: 'twoera fixture',
        nfl_draft_year: 2005
      }),
      make_player({
        pid: ERA_NEW_PID,
        first_name: 'Twoera',
        formatted_name: 'twoera fixture',
        nfl_draft_year: 2021
      }),
      // One row only, and it is the WRONG era for a 2011 lookup.
      make_player({
        pid: LONE_WRONG_ERA_PID,
        first_name: 'Lonewrong',
        formatted_name: 'lonewrong fixture',
        nfl_draft_year: 2023
      })
    ])
  })

  after(async () => {
    await db('player').whereIn('pid', ALL_PIDS).del()
  })

  beforeEach(async () => {
    await reload_cache({ all_players: true, include_name_draft_index: true })
  })

  it('throws rather than answering when the cache was never preloaded', () => {
    player_cache.is_initialized = false
    expect(() => player_cache.find_player({ name: 'active fixture' })).to.throw(
      /not initialized/
    )
  })

  it('resolves by external id', () => {
    const player = player_cache.find_player({ gsis_player_id: '00-0099001' })
    player.should.be.an('object')
    player.pid.should.equal(ACTIVE_PID)
  })

  it('resolves an active player by name', () => {
    player_cache
      .find_player({ name: 'active fixture' })
      .pid.should.equal(ACTIVE_PID)
  })

  // The recency filter, stated as the defect it is for historical data. The row
  // exists, the name matches exactly, and the lookup still returns nothing --
  // because the player retired, which is a fact about TODAY and says nothing
  // about whether he played in the season being imported.
  it('drops a retired player under the default filters, however old the lookup', () => {
    expect(player_cache.find_player({ name: 'retired fixture' })).to.equal(null)
  })

  it('finds that same player once the recency filters are turned off', () => {
    player_cache
      .find_player({
        name: 'retired fixture',
        ignore_retired: false,
        ignore_free_agent: false
      })
      .pid.should.equal(RETIRED_PID)
  })

  // A caller that leaves the defaults alone cannot tell this null apart from
  // "no such player", which is the same indistinguishability that makes an
  // undefined from find_player_row dangerous at a minting call site.
  it('returns null for an absent name and for a filtered-out one alike', () => {
    expect(player_cache.find_player({ name: 'nobody at all' })).to.equal(null)
    expect(player_cache.find_player({ name: 'retired fixture' })).to.equal(null)
  })

  it('abstains when one name matches two players from different eras', () => {
    // The safe case: ambiguity is detected and nothing is guessed.
    expect(player_cache.find_player({ name: 'twoera fixture' })).to.equal(null)
  })

  it('resolves that ambiguity when the caller supplies the draft year', () => {
    player_cache
      .find_player({ name: 'twoera fixture', nfl_draft_year: 2005 })
      .pid.should.equal(ERA_OLD_PID)
    player_cache
      .find_player({ name: 'twoera fixture', nfl_draft_year: 2021 })
      .pid.should.equal(ERA_NEW_PID)
  })

  // The dangerous case, and the reason the abstention above is not enough. With
  // exactly ONE row carrying the name, there is no ambiguity to detect, so the
  // lookup returns it with full confidence even though the player had not
  // entered the league in the season being imported. Nothing in the signature
  // lets the caller say which season it is asking about.
  it('returns a single wrong-era match confidently, with no era signal available', () => {
    const player = player_cache.find_player({ name: 'lonewrong fixture' })
    player.should.be.an('object')
    player.pid.should.equal(LONE_WRONG_ERA_PID)
    // Drafted 2023 -- this row cannot have played in 2011, and find_player has
    // no parameter with which a 2011 caller could have said so.
    player.nfl_draft_year.should.equal(2023)
  })

  // The composite index falls through to the name-only lookup on a miss rather
  // than abstaining, so passing a draft year does NOT make the lookup era-safe
  // -- it makes it era-safe only when the index happens to hit.
  it('falls back to the name-only lookup when the draft year does not match', () => {
    player_cache
      .find_player({ name: 'lonewrong fixture', nfl_draft_year: 2011 })
      .pid.should.equal(LONE_WRONG_ERA_PID)
  })

  it('builds the name+draft-year index only when asked to', async () => {
    await reload_cache({ all_players: true })
    player_cache.get_cache_stats().name_draft_year_entries.should.equal(0)
    // With no index the composite lookup silently degrades to name-only, which
    // is why an era-scoped caller cannot rely on passing the year alone.
    expect(
      player_cache.find_player({ name: 'twoera fixture', nfl_draft_year: 2005 })
    ).to.equal(null)
  })
})
