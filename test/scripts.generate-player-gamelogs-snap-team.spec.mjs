/* global describe before after beforeEach it */
import * as chai from 'chai'

import db from '#db'
import { generate_snap_based_gamelogs } from '../scripts/generate-player-gamelogs.mjs'

const expect = chai.expect

/*
  The snap-only branch resolves a week team as `existing gamelog team ||
  play_stats team || resolver`, and priority 1 is THIS ROW'S OWN PREVIOUS VALUE.
  That is what made the week-team inversion self-perpetuating: a regeneration
  read a wrong team back as its first-priority evidence and rewrote it
  unchanged, reporting success and changing nothing, so the table could not heal
  and re-running the generator was never a repair.

  The fix is narrow on purpose. Priority 1 loses ONLY to a verdict both resolver
  sources agree on over three or more weeks of continuity -- the same
  admissibility rule the detector grades on and the repair writes on, shared as
  `is_agreeing_verdict` so the three cannot drift. Everything below that bar
  leaves the stored team alone.

  Four cases, and the three that do NOT override are the load-bearing half: a
  rule that overwrote a stored team on one source, or on thin continuity, would
  repair the inversion and corrupt everything else.
*/

const YEAR = 2024
const ESBID = 99010001
const CONTINUITY_ESBIDS = [99010002, 99010003, 99010004]
const ALL_ESBIDS = [ESBID, ...CONTINUITY_ESBIDS]

// The game under test. DEN is the team the player actually played for; the
// stored row names KC, the other side of this same matchup, which is the shape
// that defeats every null check and every foreign key.
const HOME_TEAM = 'KC'
const PLAYED_FOR = 'DEN'

const inverted_pid = 'SNAP-INVE-990001'
const one_source_pid = 'SNAP-ONES-990002'
const thin_support_pid = 'SNAP-THIN-990003'
const play_stats_pid = 'SNAP-FEED-990004'

const gsis_it_player_id_by_pid = {
  [inverted_pid]: 9901001,
  [one_source_pid]: 9901002,
  [thin_support_pid]: 9901003,
  [play_stats_pid]: 9901004
}

const smart_player_id_by_pid = {
  [inverted_pid]: 'SNAPINVE990001',
  [one_source_pid]: 'SNAPONES990002',
  [thin_support_pid]: 'SNAPTHIN990003',
  [play_stats_pid]: 'SNAPFEED990004'
}

const all_pids = Object.keys(gsis_it_player_id_by_pid)

const player_row = ({ pid, primary_position }) => ({
  pid,
  first_name: 'snap',
  last_name: pid,
  short_name: `s.${pid}`,
  formatted_name: `snap ${pid}`,
  primary_position,
  secondary_position: primary_position,
  current_nfl_team: 'INA',
  // Comfortably inside the era bound, so `player_could_have_played` cannot drop
  // a candidate and turn a real assertion into a vacuous one.
  date_of_birth: '1995-01-01',
  gsis_it_player_id: gsis_it_player_id_by_pid[pid],
  smart_player_id: smart_player_id_by_pid[pid]
})

const game_row = ({ esbid, week }) => ({
  esbid,
  season_year: YEAR,
  week,
  season_type: 'REG',
  home_nfl_team: HOME_TEAM,
  away_nfl_team: PLAYED_FOR
})

const gamelog_row = ({ pid, esbid, nfl_team, opponent_nfl_team }) => ({
  esbid,
  pid,
  season_year: YEAR,
  nfl_team,
  opponent_nfl_team,
  player_position: 'WR',
  targets: 0,
  rushing_first_downs: 0,
  receiving_first_downs: 0,
  rushing_yards_excluding_kneels: 0
})

// Continuity rows for the player's OTHER weeks. The resolver excludes the row's
// own esbid, so these are the only thing roster continuity can read.
const continuity_rows = ({ pid, count }) =>
  CONTINUITY_ESBIDS.slice(0, count).map((esbid) =>
    gamelog_row({
      pid,
      esbid,
      nfl_team: PLAYED_FOR,
      opponent_nfl_team: HOME_TEAM
    })
  )

// Four scrimmage snaps, one over the resolver's floor of three, all naming DEN
// as the offense. A WR is sided to offense by position group.
const SNAP_PLAY_IDS = [1, 2, 3, 4]

const run_branch = async () => {
  const player_gamelog_inserts = []
  await generate_snap_based_gamelogs({
    unique_esbids: [ESBID],
    season_year: YEAR,
    player_gamelog_inserts
  })
  return new Map(player_gamelog_inserts.map((insert) => [insert.pid, insert]))
}

describe('SCRIPTS generate-player-gamelogs snap-based week team', function () {
  this.timeout(60 * 1000)

  before(async () => {
    await db('nfl_games').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_games').insert([
      game_row({ esbid: ESBID, week: 5 }),
      game_row({ esbid: CONTINUITY_ESBIDS[0], week: 6 }),
      game_row({ esbid: CONTINUITY_ESBIDS[1], week: 7 }),
      game_row({ esbid: CONTINUITY_ESBIDS[2], week: 8 })
    ])

    await db('player')
      .insert([
        player_row({ pid: inverted_pid, primary_position: 'WR' }),
        // A kicker plays only on units whose possession names no side, so the
        // scrimmage source cannot speak for him and continuity stands alone.
        player_row({ pid: one_source_pid, primary_position: 'K' }),
        player_row({ pid: thin_support_pid, primary_position: 'WR' }),
        player_row({ pid: play_stats_pid, primary_position: 'WR' })
      ])
      .onConflict('pid')
      .ignore()

    await db('nfl_plays').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_plays').insert(
      SNAP_PLAY_IDS.map((play_id) => ({
        esbid: ESBID,
        play_id,
        season_year: YEAR,
        week: 5,
        season_type: 'REG',
        play_type: 'PASS',
        offense_nfl_team: PLAYED_FOR,
        defense_nfl_team: HOME_TEAM,
        updated: new Date()
      }))
    )

    await db('nfl_snaps').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_snaps').insert(
      all_pids.flatMap((pid) =>
        SNAP_PLAY_IDS.map((play_id) => ({
          esbid: ESBID,
          play_id,
          gsis_it_player_id: gsis_it_player_id_by_pid[pid],
          season_year: YEAR
        }))
      )
    )

    await db('nfl_play_stats').whereIn('esbid', ALL_ESBIDS).del()
    // The feed's own statement of this player's team, and it corroborates the
    // stored row. It is the oracle both resolver sources were scored against.
    await db('nfl_play_stats').insert([
      {
        esbid: ESBID,
        play_id: SNAP_PLAY_IDS[0],
        stat_id: 1,
        nfl_team: HOME_TEAM,
        smart_player_id: smart_player_id_by_pid[play_stats_pid]
      }
    ])
  })

  beforeEach(async () => {
    await db('player_gamelogs').whereIn('esbid', ALL_ESBIDS).del()

    await db('player_gamelogs').insert([
      // Every one of the four carries the SAME stored inversion: KC, the other
      // side of the game. Only the evidence available about them differs, so
      // any difference in outcome is the admissibility rule and nothing else.
      ...all_pids.map((pid) =>
        gamelog_row({
          pid,
          esbid: ESBID,
          nfl_team: HOME_TEAM,
          opponent_nfl_team: PLAYED_FOR
        })
      ),
      ...continuity_rows({ pid: inverted_pid, count: 3 }),
      ...continuity_rows({ pid: one_source_pid, count: 3 }),
      // Two other weeks, one under the floor.
      ...continuity_rows({ pid: thin_support_pid, count: 2 }),
      ...continuity_rows({ pid: play_stats_pid, count: 3 })
    ])
  })

  after(async () => {
    await db('player_gamelogs').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_play_stats').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_snaps').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_plays').whereIn('esbid', ALL_ESBIDS).del()
    await db('nfl_games').whereIn('esbid', ALL_ESBIDS).del()
    await db('player').whereIn('pid', all_pids).del()
  })

  it('overrules the stored week team when both resolver sources agree against it', async () => {
    const inserts = await run_branch()
    const insert = inserts.get(inverted_pid)

    // THE SELF-PERPETUATION CONTROL. Remove the override and this reads KC --
    // the stored value handed back to itself, which is exactly what a
    // regeneration did to all 547 repaired rows.
    expect(insert).to.not.equal(undefined)
    expect(insert.nfl_team).to.equal(PLAYED_FOR)
    // Derived from the CORRECTED team. It was derived from the bad one.
    expect(insert.opponent_nfl_team).to.equal(HOME_TEAM)
  })

  it('leaves the stored week team alone when only one source spoke', async () => {
    const inserts = await run_branch()

    // Continuity alone is enough to WRITE a team where none is stored and not
    // enough to OVERWRITE one. A single source disagreeing with the row is the
    // 2.3%-in-every-season reading that is blind to the defect.
    expect(inserts.get(one_source_pid).nfl_team).to.equal(HOME_TEAM)
  })

  it('leaves the stored week team alone when continuity rests on too few weeks', async () => {
    const inserts = await run_branch()

    // Both sources agree here. What fails is the support floor: continuity over
    // two other weeks is a coin flip on a player who moved, and this is the
    // case a loosened rule would take first.
    expect(inserts.get(thin_support_pid).nfl_team).to.equal(HOME_TEAM)
  })

  it('never overrules the play-stat feed, which states the team directly', async () => {
    const inserts = await run_branch()

    // The resolver's two sources agree on DEN for this player as well, and they
    // still lose: `nfl_play_stats.nfl_team` is the feed's own statement of whose
    // team he was on, and it is the independent oracle the resolver's own error
    // rates were measured against.
    expect(inserts.get(play_stats_pid).nfl_team).to.equal(HOME_TEAM)
  })
})
