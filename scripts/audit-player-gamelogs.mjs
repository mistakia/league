import debug from 'debug'
import diff from 'deep-diff'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, pfr } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('audit-player-gamelogs')
debug.enable('audit-player-gamelogs,pro-football-reference')

const format_gamelog = ({
  pa = 0,
  pc = 0,
  py = 0,
  ints = 0,
  tdp = 0,

  ra = 0,
  ry = 0,
  tdr = 0,
  fuml = 0,

  trg = 0,
  rec = 0,
  recy = 0,
  tdrec = 0,

  // twoptc

  prtd = 0,
  krtd = 0
}) => ({
  pa,
  pc,
  py,
  ints,
  tdp,

  ra,
  ry,
  tdr,
  fuml,

  trg,
  rec,
  recy,
  tdrec,

  // twoptc

  prtd,
  krtd
})

const audit_player_gamelogs = async ({
  year = constants.season.year,
  ignore_cache = false
} = {}) => {
  // create any missing gamelogs
  const pfr_player_gamelogs_for_season =
    await pfr.get_player_gamelogs_for_season({ year, ignore_cache })
  const player_gamelogs = await db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'player.pfr_id',
      'nfl_games.seas_type',
      'nfl_games.week',
      'nfl_games.year'
    )
    .join('player', 'player.pid', 'player_gamelogs.pid')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where({ year })

  // compare pfr player gamelogs to our gamelogs
  for (const pfr_player_gamelog of pfr_player_gamelogs_for_season) {
    // TODO temporarily ignore non fantasy positions
    if (!constants.positions.includes(pfr_player_gamelog.pos)) {
      continue
    }

    const player_gamelog = player_gamelogs.find(
      (p) =>
        p.pfr_id === pfr_player_gamelog.pfr_id &&
        p.week === pfr_player_gamelog.week &&
        p.seas_type === pfr_player_gamelog.seas_type
    )

    if (!player_gamelog) {
      log(
        `missing gamelog for ${pfr_player_gamelog.pfr_id} week ${pfr_player_gamelog.week} ${pfr_player_gamelog.seas_type}`
      )
      continue
    }

    const formated_pfr_gamelog = format_gamelog(pfr_player_gamelog)
    const formated_db_gamelog = format_gamelog(player_gamelog)
    const differences = diff(formated_pfr_gamelog, formated_db_gamelog)
    if (differences && differences.length) {
      log(
        `differences for ${player_gamelog.pid} week ${player_gamelog.week} ${player_gamelog.seas_type} pfr_game_id ${pfr_player_gamelog.pfr_game_id}`
      )
      log(differences)
    }
  }
}

const main = async () => {
  let error
  try {
    await audit_player_gamelogs({
      year: argv.year,
      ignore_cache: argv.ignore_cache
    })
  } catch (err) {
    error = err
    log(error)
  }

  //   await db('jobs').insert({
  //     type: constants.jobs.EXAMPLE,
  //     succ: error ? 0 : 1,
  //     reason: error ? error.message : null,
  //     timestamp: Math.round(Date.now() / 1000)
  //   })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default audit_player_gamelogs
