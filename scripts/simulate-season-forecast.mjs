import debug from 'debug'
import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, simulation } from '#libs-server'
import { current_season } from '#constants'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

dayjs.extend(dayOfYear)

const log = debug('simulate-season-forecast')
enable_debug_namespaces('simulate-season-forecast,simulation:*')

// Memory is linear in n_simulations -- fourteen weeks of per-team score vectors
// at 10000 is 11.2 MB, so the ceiling is a footgun guard rather than a limit
// anyone should meet. Refusing is better than an OOM twenty minutes in.
const MAX_SIMULATIONS = 100000

/**
 * Parse this CLI's arguments.
 *
 * Deliberately a function rather than module-scope `.argv`: a module-scope parse
 * runs on IMPORT, so mocha's own argv reaches yargs and an unknown option or a
 * missing `--lid` aborts the whole run before a single test executes.
 *
 * @param {string[]} argv - Arguments after the node binary and script path
 * @returns {object} Parsed arguments
 */
export const parse_arguments = (argv) =>
  yargs(argv)
    .option('lid', {
      alias: 'l',
      description: 'League ID',
      type: 'number',
      demandOption: true
    })
    .option('year', {
      alias: 'y',
      description: 'NFL year',
      type: 'number'
    })
    .option('week', {
      alias: 'w',
      description:
        'Forecast from this week instead of the active fantasy week. Also switches to historical mode: standings come from completed matchups and the week simulations ignore actual results.',
      type: 'number'
    })
    .option('n_simulations', {
      alias: 'n',
      description: 'Number of Monte Carlo iterations',
      type: 'number',
      default: 10000
    })
    .option('seed', {
      alias: 's',
      description: 'Random seed for reproducibility',
      type: 'number'
    })
    .option('force_win_tid', {
      description:
        'Force this team to win its matchup in the first remaining week',
      type: 'number'
    })
    .option('force_loss_tid', {
      description:
        'Force this team to lose its matchup in the first remaining week',
      type: 'number'
    })
    .option('json', {
      description: 'Output raw JSON',
      type: 'boolean',
      default: false
    })
    .option('save', {
      description: 'Write the forecast to league_team_forecast',
      type: 'boolean',
      default: false
    })
    .help()
    .alias('help', 'h')
    .parse()

const format_odds = (value) =>
  value === null || value === undefined ? 'N/A' : value.toFixed(4)

/**
 * Persist a forecast the way the hourly pipeline does, on the same conflict
 * target, so a CLI run and a cron run are interchangeable writers.
 *
 * @param {object} params
 * @param {object} params.forecast - Forecast keyed by team ID
 * @param {number} params.league_id - League ID
 * @param {number} params.year - Season year
 * @param {number} params.week - Week the forecast is made from
 * @returns {Promise<number>} Rows written
 */
export const save_season_forecast = async ({
  forecast,
  league_id,
  year,
  week
}) => {
  const generated_at = Math.round(Date.now() / 1000)
  const inserts = Object.entries(forecast).map(([tid, team_forecast]) => ({
    tid: Number(tid),
    lid: league_id,
    week,
    season_year: year,
    day: dayjs().dayOfYear(),
    playoff_odds: team_forecast.playoff_odds,
    division_odds: team_forecast.division_odds,
    bye_odds: team_forecast.bye_odds,
    championship_odds: team_forecast.championship_odds,
    generated_at
  }))

  if (!inserts.length) {
    return 0
  }

  await db('league_team_forecast')
    .insert(inserts)
    .onConflict(['tid', 'season_year', 'week', 'day'])
    .merge()

  return inserts.length
}

const main = async () => {
  const argv = parse_arguments(hideBin(process.argv))

  const league_id = argv.lid
  const year = argv.year || current_season.year
  const week = argv.week || null
  const n_simulations = argv.n_simulations

  if (!Number.isInteger(n_simulations) || n_simulations < 1) {
    throw new Error(
      `n_simulations must be a positive integer, got ${n_simulations}`
    )
  }

  if (n_simulations > MAX_SIMULATIONS) {
    throw new Error(
      `n_simulations ${n_simulations} exceeds the ${MAX_SIMULATIONS} ceiling; per-week score vectors are held in memory and scale linearly`
    )
  }

  log(
    `Simulating season forecast for league ${league_id}, year ${year}, week ${week ?? 'active'}`
  )

  const forecast = await simulation.simulate_season_forecast({
    league_id,
    year,
    week,
    n_simulations,
    seed: argv.seed,
    force_win_tid: argv.force_win_tid ?? null,
    force_loss_tid: argv.force_loss_tid ?? null
  })

  if (argv.json) {
    console.log(JSON.stringify(forecast, null, 2))
  } else {
    console.log('\n=== SEASON FORECAST ===\n')
    console.log(
      `League ${league_id}, ${year}, from week ${week ?? current_season.active_fantasy_week}`
    )
    console.log(`Simulations: ${n_simulations.toLocaleString()}\n`)
    console.log(
      ['tid', 'playoff', 'bye', 'division', 'championship']
        .map((header) => header.padEnd(14))
        .join('')
    )
    for (const team_forecast of Object.values(forecast)) {
      console.log(
        [
          String(team_forecast.tid),
          format_odds(team_forecast.playoff_odds),
          format_odds(team_forecast.bye_odds),
          format_odds(team_forecast.division_odds),
          format_odds(team_forecast.championship_odds)
        ]
          .map((cell) => cell.padEnd(14))
          .join('')
      )
    }
    console.log('')
  }

  if (argv.save) {
    const saved = await save_season_forecast({
      forecast,
      league_id,
      year,
      week: week ?? current_season.week
    })
    console.log(`Saved ${saved} team forecasts to league_team_forecast`)
  }
}

if (is_main(import.meta.url)) {
  main()
    .then(async () => {
      await db.destroy()
      process.exit(0)
    })
    .catch(async (error) => {
      console.error('season forecast failed:', error.message)
      log(error)
      await db.destroy()
      process.exit(1)
    })
}

export default main
