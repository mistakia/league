import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { groupBy } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate:franchise-tags')
debug.enable('calculate:franchise-tags')

const average = (array) => array.reduce((a, b) => a + b) / array.length

const franchise_tag_salary_columns = {
  QB: 'franchise_tag_salary_quarterback',
  RB: 'franchise_tag_salary_running_back',
  WR: 'franchise_tag_salary_wide_receiver',
  TE: 'franchise_tag_salary_tight_end'
}

const run = async ({ year = current_season.year, dry_run = false } = {}) => {
  const seasons = await db('seasons')
    .select('seasons.*')
    .join('leagues', 'leagues.league_id', '=', 'seasons.lid')
    .where('leagues.is_hosted', 1)
    .where('season_year', year)

  for (const { lid, season_year: year } of seasons) {
    log(`Calculating franchise tags for lid ${lid} in ${year}`)
    const rosters = await db('rosters_players')
      .select(
        'rosters_players.*',
        'transactions.type',
        'transactions.player_salary',
        'transactions.occurred_at',
        'transactions.season_year'
      )
      .leftJoin('transactions', function () {
        this.on(
          'transactions.transaction_id',
          '=',
          db.raw(
            '(select max(uid) from transactions where transactions.tid = rosters_players.tid and transactions.pid = rosters_players.pid)'
          )
        )
      })
      .where('rosters_players.lid', lid)
      .where('rosters_players.week', 0)
      .where('rosters_players.season_year', year - 1)

    if (!rosters.length) {
      log(`Missing roster, skipping lid ${lid}`)
      continue
    }

    const grouped = groupBy(rosters, 'player_position')
    const key = {
      QB: 10,
      RB: 10,
      WR: 10,
      TE: 5
    }

    const update = {}
    for (const pos in key) {
      const players = grouped[pos]
      if (!players) {
        continue
      }

      const sorted = players.sort((a, b) => b.player_salary - a.player_salary)
      const top = sorted.slice(0, key[pos])
      const values = top.map((p) => p.player_salary)
      const avg = average(values)
      update[franchise_tag_salary_columns[pos]] = Math.round(avg)
    }

    if (dry_run) {
      log(update)
      continue
    }

    log(`Updating lid ${lid} for ${year} with:`, update)
    await db('seasons').update(update).where({ lid, season_year: year })
  }
}

export default run

// TODO - accept leagueId
const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await run({ year: argv.year, dry_run: argv.dry })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.CALCULATE_FRANCHISE_TAGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
