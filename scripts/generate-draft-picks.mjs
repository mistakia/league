import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-draft-picks')

const run = async ({ future_year = current_season.year + 1 }) => {
  const leagues = await db('leagues').where('is_hosted', 1)

  if (current_season.isRegularSeason) {
    log('not generating future draft picks during the regular season')
    return
  }

  for (const league of leagues) {
    const picks = await db('draft')
      .where({ lid: league.league_id, season_year: future_year })
      .limit(1)
    if (picks.length) continue

    const teams = await db('teams').where({
      lid: league.league_id,
      season_year: current_season.year
    })
    for (const team of teams) {
      for (let i = 1; i < 4; i++) {
        const rows = await db('draft').where({
          original_team_id: team.team_id,
          round: i,
          lid: league.league_id,
          season_year: future_year
        })

        if (rows.length) {
          log(
            `picks exist for team ${team.team_id} in round ${i}, year ${future_year}`
          )
          continue
        }

        await db('draft').insert({
          tid: team.team_id,
          original_team_id: team.team_id,
          lid: league.league_id,
          round: i,
          season_year: future_year
        })
      }
    }

    log(`generated picks for ${teams.length} teams`)
  }
}

const main = async () => {
  enable_debug_namespaces('generate-draft-picks')
  let error
  try {
    const argv = initialize_cli()
    await run({ future_year: argv.year })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_DRAFT_PICKS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
