import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { groupBy } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, report_job } from '#libs-server'
import { build_salary_in_force_transaction_id } from '#libs-server/roster-player-salary.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate:franchise-tags')
enable_debug_namespaces('calculate:franchise-tags')

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
      // The salary in force at the week-0 roster of the PRIOR season, per the
      // one rule in roster-player-salary.mjs. This was a bare
      // `max(transaction_id)` with no as-of bound, so it could read a salary
      // agreed after the roster it is averaging over -- and these averages set
      // the franchise tag salaries, so a stale read here is a money number.
      .leftJoin('transactions', function () {
        this.on(
          'transactions.transaction_id',
          '=',
          build_salary_in_force_transaction_id({
            db,
            tid: 'rosters_players.tid',
            pid: 'rosters_players.pid',
            as_of_year: 'rosters_players.season_year',
            as_of_week: 'rosters_players.week'
          })
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

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
