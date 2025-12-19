import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, simulation } from '#libs-server'
import { current_season } from '#constants'

const argv = yargs(hideBin(process.argv))
  .option('lid', {
    alias: 'l',
    description: 'League ID',
    type: 'number',
    demandOption: true
  })
  .option('team_ids', {
    alias: 't',
    description: 'Comma-separated fantasy team IDs',
    type: 'string',
    demandOption: true
  })
  .option('week', {
    alias: 'w',
    description: 'NFL week number',
    type: 'number',
    demandOption: true
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
  .option('json', {
    description: 'Output raw JSON',
    type: 'boolean',
    default: false
  })
  .help()
  .alias('help', 'h').argv

const log = debug('simulate-matchup')
debug.enable('simulate-matchup')

const format_percentage = (value) => {
  return `${(value * 100).toFixed(1)}%`
}

const format_score_distribution = (dist) => {
  return {
    mean: dist.mean.toFixed(1),
    std: dist.std.toFixed(1),
    min: dist.min.toFixed(1),
    max: dist.max.toFixed(1),
    median: dist.median.toFixed(1),
    percentile_25: dist.percentile_25.toFixed(1),
    percentile_75: dist.percentile_75.toFixed(1)
  }
}

const main = async () => {
  try {
    const league_id = argv.lid
    const team_ids = argv.team_ids
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
    const week = argv.week
    const year = argv.year || current_season.year
    const n_simulations = argv.n_simulations
    const seed = argv.seed

    log(`Simulating matchup:`)
    log(`  League: ${league_id}`)
    log(`  Teams: ${team_ids.join(', ')}`)
    log(`  Week: ${week}`)
    log(`  Year: ${year}`)
    log(`  Simulations: ${n_simulations}`)
    if (seed) log(`  Seed: ${seed}`)

    // Get team names for display
    const teams = await db('teams')
      .whereIn('uid', team_ids)
      .select('uid', 'name')

    const team_name_map = new Map()
    for (const team of teams) {
      team_name_map.set(team.uid, team.name)
    }

    // Run simulation
    const results = await simulation.simulate_matchup({
      league_id,
      team_ids,
      week,
      year,
      n_simulations,
      seed
    })

    if (argv.json) {
      console.log(JSON.stringify(results, null, 2))
    } else {
      console.log('\n=== SIMULATION RESULTS ===\n')
      console.log(`League ${league_id}, Week ${week}, ${year}`)
      console.log(`Simulations: ${results.n_simulations.toLocaleString()}`)
      console.log(`Elapsed: ${results.elapsed_ms}ms\n`)

      console.log('Team Results:')
      console.log('-'.repeat(60))

      for (const team_result of results.teams) {
        const team_name =
          team_name_map.get(team_result.team_id) ||
          `Team ${team_result.team_id}`
        const win_pct = format_percentage(team_result.win_probability)
        const dist = format_score_distribution(team_result.score_distribution)

        console.log(`\n${team_name} (ID: ${team_result.team_id})`)
        console.log(`  Win Probability: ${win_pct}`)
        console.log(`  Expected Score: ${dist.mean} (+/- ${dist.std})`)
        console.log(`  Score Range: ${dist.min} - ${dist.max}`)
        console.log(
          `  Median: ${dist.median}, IQR: ${dist.percentile_25} - ${dist.percentile_75}`
        )
      }

      console.log('\n' + '='.repeat(60) + '\n')
    }
  } catch (err) {
    console.error('Error running simulation:', err.message)
    log(err)
    process.exit(1)
  }

  process.exit(0)
}

if (is_main(import.meta.url)) {
  main()
}

export default main
