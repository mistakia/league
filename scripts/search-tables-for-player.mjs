import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('search-tables-for-player')
debug.enable('search-tables-for-player')

const run = async ({ player }) => {
  const draft = await db('draft').where('player', player)
  log({ draft })

  const gamelogs = await db('gamelogs').where('player', player)
  log({ gamelogs })

  const ktc_rankings = await db('keeptradecut_rankings').where('player', player)
  log({ ktc_rankings })

  const league_baselines = await db('league_baselines').where('player', player)
  log({ league_baselines })

  const league_cutlist = await db('league_cutlist').where('player', player)
  log({ league_cutlist })

  const league_player_projection_points = await db(
    'league_player_projection_points'
  ).where('player', player)
  log({ league_player_projection_points })

  const league_player_projection_values = await db(
    'league_player_projection_values'
  ).where('player', player)
  log({ league_player_projection_values })

  const league_team_lineup_starters = await db(
    'league_team_lineup_starters'
  ).where('player', player)
  log({ league_team_lineup_starters })

  const offense = await db('offense').where('player', player)
  log({ offense })

  const player_changelog = await db('player_changelog').where('id', player)
  log({ player_changelog })

  const players = await db('players').where('player', player)
  log({ players })

  const players_status = await db('players_status').where('player', player)
  log({ players_status })

  const poach_releases = await db('poach_releases').where('player', player)
  log({ poach_releases })

  const poaches = await db('poaches').where('player', player)
  log({ poaches })

  const practice = await db('practice').where('player', player)
  log({ practice })

  const projections = await db('projections').where('player', player)
  log({ projections })

  const props = await db('props').where('player', player)
  log({ props })

  const rankings = await db('rankings').where('player', player)
  log({ rankings })

  const ros_projections = await db('ros_projections').where('player', player)
  log({ ros_projections })

  const rosters_players = await db('rosters_players').where('player', player)
  log({ rosters_players })

  const trade_releases = await db('trade_releases').where('player', player)
  log({ trade_releases })

  const trades_players = await db('trades_players').where('player', player)
  log({ trades_players })

  const transactions = await db('transactions').where('player', player)
  log({ transactions })

  const transition_bids = await db('transition_bids').where('player', player)
  log({ transition_bids })

  const transition_releases = await db('transition_releases').where(
    'player',
    player
  )
  log({ transition_releases })

  const waiver_releases = await db('waiver_releases').where('player', player)
  log({ waiver_releases })

  const waivers = await db('waivers').where('player', player)
  log({ waivers })
}

const main = async () => {
  let error
  try {
    const player = argv.player
    await run({ player })
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
