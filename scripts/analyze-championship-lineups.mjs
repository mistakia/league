import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, simulation } from '#libs-server'
import { active_roster_slots } from '#constants'

const argv = yargs(hideBin(process.argv))
  .option('lid', {
    alias: 'l',
    description: 'League ID',
    type: 'number',
    demandOption: true
  })
  .option('team_id', {
    alias: 't',
    description: 'Fantasy team ID to analyze',
    type: 'number',
    demandOption: true
  })
  .option('opponent_team_ids', {
    alias: 'o',
    description: 'Comma-separated opponent team IDs',
    type: 'string',
    demandOption: true
  })
  .option('weeks', {
    alias: 'w',
    description: 'Comma-separated NFL weeks (e.g., 16,17)',
    type: 'string',
    demandOption: true
  })
  .option('year', {
    alias: 'y',
    description: 'NFL year',
    type: 'number'
  })
  .option('n_simulations', {
    alias: 'n',
    description: 'Number of simulations per evaluation',
    type: 'number',
    default: 5000
  })
  .option('json', {
    description: 'Output raw JSON',
    type: 'boolean',
    default: false
  })
  .help()
  .alias('help', 'h').argv

const log = debug('analyze-championship-lineups')
debug.enable('analyze-championship-lineups')

const format_percentage = (value) => {
  if (value === null || value === undefined) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

const format_delta = (value) => {
  if (value === null || value === undefined) return 'N/A'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(2)}%`
}

const main = async () => {
  try {
    const league_id = argv.lid
    const team_id = argv.team_id
    const opponent_team_ids = argv.opponent_team_ids
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
    const weeks = argv.weeks.split(',').map((w) => parseInt(w.trim(), 10))
    const year = argv.year || new Date().getFullYear()
    const n_simulations = argv.n_simulations

    log(`Analyzing championship lineups:`)
    log(`  League: ${league_id}`)
    log(`  Team: ${team_id}`)
    log(`  Opponents: ${opponent_team_ids.join(', ')}`)
    log(`  Weeks: ${weeks.join(', ')}`)
    log(`  Year: ${year}`)

    // Get team names
    const all_team_ids = [team_id, ...opponent_team_ids]
    const teams = await db('teams')
      .whereIn('uid', all_team_ids)
      .select('uid', 'name')

    const team_name_map = new Map()
    for (const team of teams) {
      team_name_map.set(team.uid, team.name)
    }

    // Get player names for display
    const get_player_name = async (pid) => {
      const player = await db('player')
        .where('pid', pid)
        .first('fname', 'lname', 'pos')
      if (player) {
        return `${player.fname} ${player.lname} (${player.pos})`
      }
      return pid
    }

    // Run championship simulation first
    console.log('\n=== CHAMPIONSHIP SIMULATION ===\n')

    const championship_results = await simulation.simulate_championship({
      league_id,
      team_ids: all_team_ids,
      weeks,
      year,
      n_simulations
    })

    if (argv.json) {
      const lineup_results = []

      for (const week of weeks) {
        const analysis = await simulation.analyze_lineup_decisions({
          league_id,
          team_id,
          opponent_team_ids,
          week,
          year,
          n_simulations
        })
        lineup_results.push(analysis)
      }

      console.log(
        JSON.stringify(
          {
            championship: championship_results,
            lineup_analysis: lineup_results
          },
          null,
          2
        )
      )
    } else {
      console.log(`Weeks: ${weeks.join(', ')}, ${year}`)
      console.log(
        `Simulations: ${championship_results.n_simulations.toLocaleString()}\n`
      )

      console.log('Championship Odds:')
      console.log('-'.repeat(60))

      // Sort teams by championship odds (highest first)
      const sorted_teams = [...championship_results.teams].sort(
        (a, b) => b.championship_odds - a.championship_odds
      )

      for (const team_result of sorted_teams) {
        const team_name =
          team_name_map.get(team_result.team_id) ||
          `Team ${team_result.team_id}`
        const is_my_team = team_result.team_id === team_id
        const marker = is_my_team ? ' <-- YOUR TEAM' : ''
        const odds_pct = format_percentage(team_result.championship_odds)
        console.log(
          `  ${team_name}: ${odds_pct} (${team_result.total_expected_points.toFixed(1)} pts expected)${marker}`
        )
      }

      // Run lineup analysis for each week
      console.log('\n' + '='.repeat(60))
      console.log('=== LINEUP ANALYSIS BY WEEK ===')
      console.log('='.repeat(60))

      const base_week = weeks[0]

      for (const week of weeks) {
        console.log(`\n--- Week ${week} ---\n`)

        const analysis = await simulation.analyze_lineup_decisions({
          league_id,
          team_id,
          opponent_team_ids,
          week,
          year,
          n_simulations,
          fallback_week: week !== base_week ? base_week : undefined
        })

        console.log(
          `Base Win Probability: ${format_percentage(analysis.base_win_probability)}`
        )
        console.log(`\nCurrent Starters:`)

        for (const pid of analysis.current_starters) {
          const name = await get_player_name(pid)
          console.log(`  - ${name}`)
        }

        if (analysis.recommendations && analysis.recommendations.length > 0) {
          console.log(`\nPotential Lineup Changes:`)
          console.log('-'.repeat(50))

          for (const rec of analysis.recommendations.slice(0, 10)) {
            const starter_name = await get_player_name(rec.starter_pid)
            const bench_name = await get_player_name(rec.bench_pid)
            const delta = format_delta(rec.estimated_win_probability_delta)
            const slot_display = rec.slot_name || 'Unknown'

            console.log(`\n  Slot: ${slot_display}`)
            console.log(`  Bench: ${starter_name}`)
            console.log(`  Start: ${bench_name}`)
            console.log(`  Impact: ${delta}`)
          }
        } else {
          console.log(`\nNo significant lineup changes recommended.`)
        }

        console.log('')
      }

      // Get correlation insights for the matchup
      console.log('='.repeat(60))
      console.log('=== CORRELATION INSIGHTS ===')
      console.log('='.repeat(60))

      for (const week of weeks) {
        // Load rosters to get player IDs
        const rosters = await simulation.load_simulation_rosters({
          league_id,
          team_ids: all_team_ids,
          week,
          year
        })

        const my_roster = rosters.find((r) => r.team_id === team_id)
        const opponent_player_ids = rosters
          .filter((r) => r.team_id !== team_id)
          .flatMap((r) => r.player_ids)

        if (my_roster) {
          // Get same-team correlations (stacks within your lineup)
          const same_team_corrs = await simulation.get_same_team_correlations({
            player_ids: my_roster.player_ids,
            year
          })

          console.log(`\n--- Week ${week} Same-Team Stacks (Your Lineup) ---`)

          if (same_team_corrs.length > 0) {
            for (const corr of same_team_corrs.slice(0, 5)) {
              const player_a_name = await get_player_name(corr.player_a)
              const player_b_name = await get_player_name(corr.player_b)
              const sign = corr.correlation > 0 ? '+' : ''
              console.log(
                `  ${player_a_name} <-> ${player_b_name}: ${sign}${corr.correlation.toFixed(2)} (${corr.games_together} games)`
              )
            }
          } else {
            console.log(`  No significant same-team correlations found.`)
          }

          // Get cross-team correlations (your starters vs opponent starters)
          const insights = await simulation.get_correlation_insights({
            player_ids: my_roster.player_ids,
            opponent_player_ids,
            year // Use current year, will fallback to prior year if needed
          })

          console.log(
            `\n--- Week ${week} Cross-Team Correlations (vs Opponents) ---`
          )

          if (insights.positive_correlations.length > 0) {
            console.log(`\nPositive (both score high/low together):`)
            for (const corr of insights.positive_correlations.slice(0, 5)) {
              const my_name = await get_player_name(corr.my_player)
              const opp_name = await get_player_name(corr.opponent_player)
              console.log(
                `  ${my_name} <-> ${opp_name}: +${corr.correlation.toFixed(2)} (${corr.games_together} games)`
              )
            }
          }

          if (insights.negative_correlations.length > 0) {
            console.log(`\nNegative (inverse relationship):`)
            for (const corr of insights.negative_correlations.slice(0, 5)) {
              const my_name = await get_player_name(corr.my_player)
              const opp_name = await get_player_name(corr.opponent_player)
              console.log(
                `  ${my_name} <-> ${opp_name}: ${corr.correlation.toFixed(2)} (${corr.games_together} games)`
              )
            }
          }

          if (
            insights.positive_correlations.length === 0 &&
            insights.negative_correlations.length === 0
          ) {
            console.log(`\n  No significant cross-team correlations found.`)
          }

          // Get bench players directly (without running full analysis)
          // Only include active roster slots (starting lineup + bench)
          const bench_result = await db('rosters_players')
            .leftJoin('scoring_format_player_projection_points', function () {
              this.on(
                'rosters_players.pid',
                'scoring_format_player_projection_points.pid'
              )
                .andOn(
                  db.raw('scoring_format_player_projection_points.week = ?', [
                    String(week)
                  ])
                )
                .andOn(
                  db.raw('scoring_format_player_projection_points.year = ?', [
                    year
                  ])
                )
            })
            .where({
              'rosters_players.lid': league_id,
              'rosters_players.tid': team_id,
              'rosters_players.week': week,
              'rosters_players.year': year
            })
            .whereNotIn('rosters_players.pid', my_roster.player_ids)
            .whereIn('rosters_players.slot', active_roster_slots)
            .whereNotNull('scoring_format_player_projection_points.total')
            .where('scoring_format_player_projection_points.total', '>', 0)
            .select('rosters_players.pid')

          const bench_pids = bench_result.map((r) => r.pid)

          if (bench_pids.length > 0) {
            const opportunities =
              await simulation.get_correlation_opportunities({
                bench_pids,
                opponent_player_ids,
                year
              })

            if (opportunities.length > 0) {
              console.log(`\n--- Bench Correlation Opportunities ---`)
              console.log(
                `(Bench players that correlate with opponent starters)`
              )
              for (const opp of opportunities.slice(0, 5)) {
                const bench_name = await get_player_name(opp.bench_player)
                const opp_name = await get_player_name(opp.opponent_player)
                const sign = opp.correlation > 0 ? '+' : ''
                console.log(
                  `  ${bench_name} <-> ${opp_name}: ${sign}${opp.correlation.toFixed(2)} (${opp.games_together} games)`
                )
              }
            }
          }
        }
      }

      console.log('\n' + '='.repeat(60) + '\n')
    }
  } catch (err) {
    console.error('Error running analysis:', err.message)
    log(err)
    process.exit(1)
  }

  process.exit(0)
}

if (is_main(import.meta.url)) {
  main()
}

export default main
