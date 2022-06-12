import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('search-tables-for-player')
debug.enable('search-tables-for-player')

const run = async ({ pid }) => {
  const draft = await db('draft').where({ pid })
  log({ draft })

  const gamelogs = await db('gamelogs').where({ pid })
  log({ gamelogs })

  const ktc_rankings = await db('keeptradecut_rankings').where({ pid })
  log({ ktc_rankings })

  const league_baselines = await db('league_baselines').where({ pid })
  log({ league_baselines })

  const league_cutlist = await db('league_cutlist').where({ pid })
  log({ league_cutlist })

  const league_player_projection_points = await db(
    'league_player_projection_points'
  ).where({ pid })
  log({ league_player_projection_points })

  const league_player_projection_values = await db(
    'league_player_projection_values'
  ).where({ pid })
  log({ league_player_projection_values })

  const league_team_lineup_starters = await db(
    'league_team_lineup_starters'
  ).where({ pid })
  log({ league_team_lineup_starters })

  const offense = await db('offense').where({ pid })
  log({ offense })

  const player_changelog = await db('player_changelog').where('id', pid)
  log({ player_changelog })

  const players = await db('players').where({ pid })
  log({ players })

  const players_status = await db('players_status').where({ pid })
  log({ players_status })

  const poach_releases = await db('poach_releases').where({ pid })
  log({ poach_releases })

  const poaches = await db('poaches').where({ pid })
  log({ poaches })

  const practice = await db('practice').where({ pid })
  log({ practice })

  const projections = await db('projections').where({ pid })
  log({ projections })

  const props = await db('props').where({ pid })
  log({ props })

  const rankings = await db('rankings').where({ pid })
  log({ rankings })

  const ros_projections = await db('ros_projections').where({ pid })
  log({ ros_projections })

  const rosters_players = await db('rosters_players').where({ pid })
  log({ rosters_players })

  const trade_releases = await db('trade_releases').where({ pid })
  log({ trade_releases })

  const trades_players = await db('trades_players').where({ pid })
  log({ trades_players })

  const transactions = await db('transactions').where({ pid })
  log({ transactions })

  const transition_bids = await db('transition_bids').where({ pid })
  log({ transition_bids })

  const transition_releases = await db('transition_releases').where({ pid })
  log({ transition_releases })

  const waiver_releases = await db('waiver_releases').where({ pid })
  log({ waiver_releases })

  const waivers = await db('waivers').where({ pid })
  log({ waivers })
}

const main = async () => {
  let error
  try {
    await run({ pid: argv.pid })
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

export default run
