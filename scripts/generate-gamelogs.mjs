import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  constants,
  calculateStatsFromPlays,
  groupBy,
  calculateDstStatsFromPlays
} from '#common'
import { isMain, get_plays_query, get_plays } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-gamelogs')
debug.enable('generate-gamelogs')

const player_gamelog_fields = [
  'esbid',
  'pid',
  'tm',
  'opp',
  'pos',
  'snp',
  // 'off',
  // 'def',
  ...constants.fantasy_stats
]

const format_player_gamelog = (item) => {
  const result = {}
  for (const field of player_gamelog_fields) {
    result[field] = item[field] || 0
  }

  return result
}

const generate_gamelogs = async ({
  week = constants.season.week,
  year = constants.season.year,
  seas_type = 'REG'
} = {}) => {
  log(`loading plays for ${year} week ${week}`)
  let query = get_plays_query(db)
  query = query
    .select(
      'nfl_games.esbid',
      'nfl_plays.def',
      'nfl_plays.pos_team',
      'nfl_plays.drive_play_count',
      'nfl_plays.type_nfl',
      'nfl_games.h',
      'nfl_games.v'
    )
    .where('nfl_games.week', week)
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', seas_type)

  const all_plays = await get_plays({ query, include_play_stats: true, db })
  log(`loaded ${all_plays.length} plays`)

  const player_gamelogs = []
  const team_defense_and_special_teams_gamelogs = []

  const plays_by_esbid = groupBy(all_plays, 'esbid')
  for (const esbid in plays_by_esbid) {
    const plays = plays_by_esbid[esbid]
    log(`esbid ${esbid} has ${plays.length} plays`)

    // generate team offense gamelogs
    const { players } = calculateStatsFromPlays(plays)
    const pids = Object.keys(players)
    const player_rows = await db('player')
      .select('pid', 'pos')
      .whereIn('pid', pids)

    for (const pid in players) {
      const player_row = player_rows.find((p) => p.pid === pid)
      player_gamelogs.push(
        format_player_gamelog({
          pid,
          esbid,
          pos: player_row.pos,
          ...players[pid]
        })
      )
    }

    // generate team defense and special teams gamelogs
    const home_team = plays[0].h
    const away_team = plays[0].v
    const plays_by_pos_team = groupBy(plays, 'pos_team')

    const home_plays = plays_by_pos_team[home_team]
    const away_dst_stats = calculateDstStatsFromPlays(home_plays, away_team)
    team_defense_and_special_teams_gamelogs.push(
      format_player_gamelog({
        pid: away_team,
        esbid,
        pos: 'DST',
        tm: away_team,
        opp: home_team,
        ...away_dst_stats
      })
    )

    const away_plays = plays_by_pos_team[away_team]
    const home_dst_stats = calculateDstStatsFromPlays(away_plays, home_team)
    team_defense_and_special_teams_gamelogs.push(
      format_player_gamelog({
        pid: home_team,
        esbid,
        pos: 'DST',
        tm: home_team,
        opp: away_team,
        ...home_dst_stats
      })
    )
  }

  if (player_gamelogs.length) {
    const pids = player_gamelogs.map((p) => p.pid)
    const deleted_count = await db('player_gamelogs')
      .leftJoin('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
      .where('nfl_games.week', week)
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', seas_type)
      .whereNotIn('player_gamelogs.pid', pids)
      .whereNot('pos', 'DST')
      .del()
    log(`Deleted ${deleted_count} excess gamelogs`)

    log(`Updated ${player_gamelogs.length} gamelogs`)
    await db('player_gamelogs').insert(player_gamelogs).onConflict().merge()
  }

  if (team_defense_and_special_teams_gamelogs) {
    const pids = team_defense_and_special_teams_gamelogs.map((p) => p.pid)
    const deleted_count = await db('player_gamelogs')
      .leftJoin('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
      .where('nfl_games.week', week)
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', seas_type)
      .whereNotIn('player_gamelogs.pid', pids)
      .where('pos', 'DST')
      .del()
    log(`Deleted ${deleted_count} excess defense and special teams gamelogs`)

    log(`Updated ${team_defense_and_special_teams_gamelogs.length} gamelogs`)
    await db('player_gamelogs')
      .insert(team_defense_and_special_teams_gamelogs)
      .onConflict()
      .merge()
  }

  // generate splits
  // - all
  // - neutral
  // - leading
  // - trailing
  // - blitz
  // - zone
  // - man

  // generate team defense allowed over offense average gamelogs
}

const main = async () => {
  let error
  try {
    await generate_gamelogs({
      week: argv.week,
      year: argv.year,
      seas_type: argv.seas_type
    })
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_gamelogs
