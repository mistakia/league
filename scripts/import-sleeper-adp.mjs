import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { isMain, report_job, sleeper, getPlayer } from '#libs-server'
import { constants } from '#libs-shared'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-sleeper-adp')
debug.enable('import-sleeper-adp,sleeper')

const format_adp = (projection_item) => {}

const format_projection = (projection_item) => {}

const import_sleeper_adp = async ({ ignore_cache = false } = {}) => {
  const projections = await sleeper.get_sleeper_projections({
    ignore_cache,
    year: constants.season.year,
    positions: ['DEF', 'K', 'QB', 'RB', 'TE', 'WR'],
    order_by: 'adp_std'
  })

  const distinct_values = {
    company: [...new Set(projections.map((p) => p.company))],
    game_id: [...new Set(projections.map((p) => p.game_id))],
    week: [...new Set(projections.map((p) => p.week))]
  }

  log(`Companies: ${distinct_values.company.join(', ')}`)
  log(`Game IDs: ${distinct_values.game_id.join(', ')}`)
  log(`Weeks: ${distinct_values.week.join(', ')}`)

  const apd_inserts = []
  const projection_inserts = []

  for (const projection of projections) {
    let player_row

    try {
      player_row = await getPlayer({ sleeper_id: projection.player_id })
    } catch (err) {
      log(`Error getting player: ${err}`)
      continue
    }

    const player_params = {
      name: `${projection?.player?.first_name} ${projection?.player?.last_name}`,
      pos: projection?.player?.position,
      team: projection?.player?.team
    }
    if (!player_row) {
      try {
        player_row = await getPlayer(player_params)
      } catch (err) {
        log(`Error getting player: ${err}`)
        log(player_params)
        continue
      }
    }
  }
  // get sleeper
}

const main = async () => {
  let error
  try {
    await import_sleeper_adp({ ignore_cache: argv.ignore_cache })
  } catch (err) {
    error = err
    log(error)
  }

  // await report_job({
  //   job_type: job_types.EXAMPLE,
  //   error
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_sleeper_adp
