import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job, simulation } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#constants'

const argv = yargs(hideBin(process.argv))
  .option('lid', {
    alias: 'l',
    description: 'League ID',
    type: 'number',
    demandOption: true
  })
  .option('week', {
    alias: 'w',
    description: 'NFL week',
    type: 'number'
  })
  .option('year', {
    alias: 'y',
    description: 'NFL year',
    type: 'number'
  })
  .option('n_simulations', {
    alias: 'n',
    description: 'Number of simulations',
    type: 'number',
    default: 10000
  })
  .option('seed', {
    alias: 's',
    description: 'Random seed for reproducibility',
    type: 'number'
  })
  .option('save', {
    description: 'Save probabilities to matchups table',
    type: 'boolean',
    default: false
  })
  .option('json', {
    description: 'Output raw JSON',
    type: 'boolean',
    default: false
  })
  .option('dry', {
    description: 'Dry run (do not save)',
    type: 'boolean',
    default: false
  })
  .help()
  .alias('help', 'h').argv

const log = debug('simulate-league-matchups')
debug.enable('simulate-league-matchups,simulation:*')

const format_percentage = (value) => {
  if (value === null || value === undefined) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

const main = async () => {
  let error
  try {
    const league_id = argv.lid
    const week = argv.week || current_season.week
    const year = argv.year || current_season.year
    const n_simulations = argv.n_simulations
    const seed = argv.seed

    log(`Simulating league ${league_id}, week ${week}, year ${year}`)

    const results = await simulation.simulate_league_week({
      league_id,
      week,
      year,
      n_simulations,
      seed,
      use_actual_results: true
    })

    if (argv.json) {
      console.log(JSON.stringify(results, null, 2))
    } else {
      console.log('\n=== LEAGUE-WIDE SIMULATION RESULTS ===\n')
      console.log(`League ${league_id}, Week ${week}, ${year}`)
      console.log(`Simulations: ${results.n_simulations.toLocaleString()}`)
      console.log(`Elapsed: ${results.elapsed_ms}ms`)
      console.log(`Teams: ${results.team_count}`)
      console.log(`Players: ${results.player_count}`)
      console.log(`NFL Games: ${results.nfl_games_simulated}`)
      console.log(`Completed Games: ${results.locked_games}`)
      console.log(`Bye Players: ${results.bye_players}`)
      console.log('\n' + '-'.repeat(60) + '\n')

      // Get team names
      const team_ids = [
        ...new Set(
          results.matchups.flatMap((m) => [m.home_team_id, m.away_team_id])
        )
      ]
      const teams = await db('teams')
        .whereIn('uid', team_ids)
        .select('uid', 'name')
      const team_names = new Map(teams.map((t) => [t.uid, t.name]))

      console.log('MATCHUP RESULTS:\n')
      for (const matchup of results.matchups) {
        const home_name =
          team_names.get(matchup.home_team_id) || `Team ${matchup.home_team_id}`
        const away_name =
          team_names.get(matchup.away_team_id) || `Team ${matchup.away_team_id}`

        console.log(`${away_name} @ ${home_name}`)
        console.log(
          `  ${away_name}: ${format_percentage(matchup.away_win_probability)} win, ${matchup.away_expected_score.toFixed(1)} +/- ${matchup.away_score_std.toFixed(1)} pts`
        )
        console.log(
          `  ${home_name}: ${format_percentage(matchup.home_win_probability)} win, ${matchup.home_expected_score.toFixed(1)} +/- ${matchup.home_score_std.toFixed(1)} pts`
        )
        if (matchup.tie_probability > 0.001) {
          console.log(`  Tie: ${format_percentage(matchup.tie_probability)}`)
        }
        console.log('')
      }

      console.log('='.repeat(60) + '\n')
    }

    // Save results if requested
    if (argv.save && !argv.dry) {
      const updated = await simulation.save_matchup_probabilities(
        results.matchups
      )
      log(`Saved probabilities for ${updated} matchups`)
      if (!argv.json) {
        console.log(`Saved probabilities for ${updated} matchups`)
      }
    }
  } catch (err) {
    error = err
    console.error('Error running simulation:', err.message)
    log(err)
  }

  await report_job({
    job_type: job_types.SIMULATE_LEAGUE_MATCHUPS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default main
