import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, createDefaultLeague } from '#libs-shared'
import { isMain, getLeague } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

import process_play_stats from './process-play-stats.mjs'

import generate_scoring_format_player_gamelogs from './generate-scoring-format-player-gamelogs.mjs'
import generate_scoring_format_player_seasonlogs from './generate-scoring-format-player-seasonlogs.mjs'
import generate_scoring_format_player_careerlogs from './generate-scoring-format-player-careerlogs.mjs'

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

  await generate_league_format_player_seasonlogs({ league_format_hash })
  await generate_league_format_player_careerlogs({ league_format_hash })
}

const update_scoring_format_stats = async ({ week, scoring_format_hash }) => {
  log(`updating stats for scoring format ${scoring_format_hash} week ${week}`)

  await generate_scoring_format_player_gamelogs({ week, scoring_format_hash })
  await generate_scoring_format_player_seasonlogs({ scoring_format_hash })
  await generate_scoring_format_player_careerlogs({ scoring_format_hash })
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

  const processed_scoring_format_hashes_index = {}

  // process play stats / generate player_gamelogs
  await process_play_stats({ week })

  // process default league
  const default_league = createDefaultLeague()
  const {
    league_format_hash: default_league_format_hash,
    scoring_format_hash: default_scoring_format_hash
  } = default_league

  await update_scoring_format_stats({
    week,
    scoring_format_hash: default_scoring_format_hash
  })
  processed_scoring_format_hashes_index[default_scoring_format_hash] = true

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
    const { league_format_hash, scoring_format_hash } = league

    if (!processed_scoring_format_hashes_index[scoring_format_hash]) {
      await update_scoring_format_stats({ week, scoring_format_hash })
      processed_scoring_format_hashes_index[scoring_format_hash] = true
    }

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

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default update_stats_weekly
