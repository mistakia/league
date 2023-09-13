import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, createDefaultLeague } from '#libs-shared'
import { isMain, getLeague } from '#libs-server'

import process_play_stats from './process-play-stats.mjs'
import generate_league_format_player_careerlogs from './generate-league-format-player-careerlogs.mjs'
import generate_league_format_player_gamelogs from './generate-league-format-player-gamelogs.mjs'
import generate_league_format_player_seasonlogs from './generate-league-format-player-seasonlogs.mjs'
import generate_nfl_team_seasonlogs from './generate-nfl-team-seasonlogs.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-stats-weekly')
debug.enable('update-stats-weekly')

const update_league_stats = async ({ lid, league_format_hash, week }) => {
  log(`updating stats for league ${lid} week ${week}`)

  await generate_league_format_player_gamelogs({
    week,
    lid,
    league_format_hash
  })
  // TODO update to use league_format_hash instead of lid

  await generate_league_format_player_seasonlogs({ lid, league_format_hash })
  await generate_league_format_player_careerlogs({ lid, league_format_hash })
}

const update_stats_weekly = async ({ week } = {}) => {
  const day = dayjs().day()
  if (!week) {
    week = Math.max(
      [2, 3].includes(day) ? constants.season.week - 1 : constants.season.week,
      1
    )
  }

  log(`updating stats for week ${week}`)

  // process play stats / generate player_gamelogs
  await process_play_stats({ week })

  // process default league
  const default_league = createDefaultLeague()
  const { league_format_hash: default_league_format_hash } = default_league
  await update_league_stats({
    lid: 0,
    league_format_hash: default_league_format_hash,
    week
  })

  const league_ids = await db('leagues')
    .where({ hosted: 1 })
    .whereNull('archived_at')
    .pluck('uid')
  for (const lid of league_ids) {
    const league = await getLeague({ lid })
    const { league_format_hash } = league
    await update_league_stats({ lid, league_format_hash, week })
  }

  // TODO generate player_seasonlogs
  await generate_nfl_team_seasonlogs()
}

const main = async () => {
  let error
  try {
    await update_stats_weekly({ week: argv.week })
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

export default update_stats_weekly
