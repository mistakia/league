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

// ============================================================================
// Formatting Utilities
// ============================================================================

const format_percentage = (value) => {
  if (value === null || value === undefined) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

const format_delta = (value) => {
  if (value === null || value === undefined) return 'N/A'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(2)}%`
}

// ============================================================================
// Data Loading Functions
// ============================================================================

/**
 * Load team names and create a mapping from team ID to name
 */
const load_team_names = async ({ team_ids }) => {
  const teams = await db('teams').whereIn('uid', team_ids).select('uid', 'name')

  const team_name_map = new Map()
  for (const team of teams) {
    team_name_map.set(team.uid, team.name)
  }
  return team_name_map
}

/**
 * Get formatted player name from player ID
 */
const get_player_name = async ({ pid }) => {
  const player = await db('player')
    .where('pid', pid)
    .first('fname', 'lname', 'pos')
  if (player) {
    return `${player.fname} ${player.lname} (${player.pos})`
  }
  return pid
}

/**
 * Build a cache of player names to avoid repeated database queries
 */
const create_player_name_cache = () => {
  const cache = new Map()
  return {
    get: async ({ pid }) => {
      if (cache.has(pid)) {
        return cache.get(pid)
      }
      const name = await get_player_name({ pid })
      cache.set(pid, name)
      return name
    }
  }
}

/**
 * Load scoring format hash for a league and year
 */
const load_scoring_format = async ({ league_id, year }) => {
  const season = await db('seasons')
    .where({ lid: league_id, year })
    .first('scoring_format_hash')
  return season?.scoring_format_hash
}

/**
 * Build per-week expected points lookup from championship results
 */
const build_week_expected_points = ({ championship_results }) => {
  const week_expected_points = new Map() // Map<week, Map<team_id, mean>>
  for (const wr of championship_results.week_results) {
    const team_points = new Map()
    for (const [team_id_str, dist] of Object.entries(wr.score_distributions)) {
      team_points.set(parseInt(team_id_str, 10), dist.mean)
    }
    week_expected_points.set(wr.week, team_points)
  }
  return week_expected_points
}

/**
 * Load actual scores for all teams across specified weeks
 */
const load_week_actual_scores = async ({
  league_id,
  team_ids,
  weeks,
  year,
  scoring_format_hash
}) => {
  const week_actual_scores = new Map() // Map<week, Map<team_id, actual_points>>

  for (const week of weeks) {
    const rosters = await simulation.load_simulation_rosters({
      league_id,
      team_ids,
      week,
      year
    })

    // Load actual points for all starters
    const all_pids = rosters.flatMap((r) => r.player_ids)
    const actual_points_result = await db('scoring_format_player_gamelogs')
      .join(
        'nfl_games',
        'scoring_format_player_gamelogs.esbid',
        'nfl_games.esbid'
      )
      .where({
        'scoring_format_player_gamelogs.scoring_format_hash':
          scoring_format_hash,
        'nfl_games.week': week,
        'nfl_games.year': year
      })
      .whereIn('scoring_format_player_gamelogs.pid', all_pids)
      .select(
        'scoring_format_player_gamelogs.pid',
        'scoring_format_player_gamelogs.points'
      )

    const actual_by_pid = new Map()
    for (const row of actual_points_result) {
      actual_by_pid.set(row.pid, row.points)
    }

    const team_actual_map = new Map()
    for (const roster of rosters) {
      let total_actual = 0
      for (const pid of roster.player_ids) {
        const pts = actual_by_pid.get(pid)
        if (pts !== undefined && pts !== null) {
          total_actual += pts
        }
      }
      team_actual_map.set(roster.team_id, total_actual)
    }
    week_actual_scores.set(week, team_actual_map)
  }

  return week_actual_scores
}

/**
 * Load bench player IDs for a team in a given week
 */
const load_bench_player_ids = async ({
  league_id,
  team_id,
  week,
  year,
  starter_pids
}) => {
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
          db.raw('scoring_format_player_projection_points.year = ?', [year])
        )
    })
    .where({
      'rosters_players.lid': league_id,
      'rosters_players.tid': team_id,
      'rosters_players.week': week,
      'rosters_players.year': year
    })
    .whereNotIn('rosters_players.pid', starter_pids)
    .whereIn('rosters_players.slot', active_roster_slots)
    .whereNotNull('scoring_format_player_projection_points.total')
    .where('scoring_format_player_projection_points.total', '>', 0)
    .select('rosters_players.pid')

  return bench_result.map((r) => r.pid)
}

// ============================================================================
// Output Formatting Functions
// ============================================================================

/**
 * Format championship odds output
 */
const format_championship_odds = ({
  championship_results,
  team_name_map,
  team_id,
  weeks,
  year,
  week_expected_points,
  week_actual_scores
}) => {
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
      team_name_map.get(team_result.team_id) || `Team ${team_result.team_id}`
    const is_my_team = team_result.team_id === team_id
    const marker = is_my_team ? ' <-- YOUR TEAM' : ''
    const odds_pct = format_percentage(team_result.championship_odds)

    // Build per-week breakdown
    const week_parts = weeks.map((w) => {
      const expected =
        week_expected_points.get(w)?.get(team_result.team_id) || 0
      return `Wk${w}: ${expected.toFixed(1)}`
    })

    console.log(
      `  ${team_name}: ${odds_pct} (${team_result.total_expected_points.toFixed(1)} pts expected)${marker}`
    )
    console.log(`    ${week_parts.join(' | ')}`)

    // Show actual vs remaining for each week
    const breakdown_parts = weeks.map((w) => {
      const actual = week_actual_scores.get(w)?.get(team_result.team_id) || 0
      const expected =
        week_expected_points.get(w)?.get(team_result.team_id) || 0
      const remaining = Math.max(0, expected - actual)
      if (actual > 0) {
        return `Wk${w}: ${actual.toFixed(1)} actual + ${remaining.toFixed(1)} proj`
      }
      return `Wk${w}: ${expected.toFixed(1)} proj`
    })
    console.log(`    ${breakdown_parts.join(' | ')}`)
    console.log('')
  }
}

/**
 * Format lineup analysis output for a single week
 */
const format_lineup_analysis = async ({
  analysis,
  week,
  player_name_cache
}) => {
  console.log(`\n--- Week ${week} ---\n`)

  console.log(
    `Base Win Probability: ${format_percentage(analysis.base_win_probability)}`
  )
  console.log(`\nCurrent Starters:`)

  for (const pid of analysis.current_starters) {
    const name = await player_name_cache.get({ pid })
    console.log(`  - ${name}`)
  }

  if (analysis.recommendations && analysis.recommendations.length > 0) {
    console.log(`\nPotential Lineup Changes:`)
    console.log('-'.repeat(50))

    for (const rec of analysis.recommendations.slice(0, 10)) {
      const starter_name = await player_name_cache.get({ pid: rec.starter_pid })
      const bench_name = await player_name_cache.get({ pid: rec.bench_pid })
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

/**
 * Format same-team correlation output
 */
const format_same_team_correlations = async ({
  same_team_corrs,
  week,
  player_name_cache
}) => {
  console.log(`\n--- Week ${week} Same-Team Stacks (Your Lineup) ---`)

  if (same_team_corrs.length > 0) {
    for (const corr of same_team_corrs.slice(0, 5)) {
      const player_a_name = await player_name_cache.get({ pid: corr.player_a })
      const player_b_name = await player_name_cache.get({ pid: corr.player_b })
      const sign = corr.correlation > 0 ? '+' : ''
      console.log(
        `  ${player_a_name} <-> ${player_b_name}: ${sign}${corr.correlation.toFixed(2)} (${corr.games_together} games)`
      )
    }
  } else {
    console.log(`  No significant same-team correlations found.`)
  }
}

/**
 * Format cross-team correlation output
 */
const format_cross_team_correlations = async ({
  insights,
  week,
  player_name_cache
}) => {
  console.log(`\n--- Week ${week} Cross-Team Correlations (vs Opponents) ---`)

  if (insights.positive_correlations.length > 0) {
    console.log(`\nPositive (both score high/low together):`)
    for (const corr of insights.positive_correlations.slice(0, 5)) {
      const my_name = await player_name_cache.get({ pid: corr.my_player })
      const opp_name = await player_name_cache.get({
        pid: corr.opponent_player
      })
      console.log(
        `  ${my_name} <-> ${opp_name}: +${corr.correlation.toFixed(2)} (${corr.games_together} games)`
      )
    }
  }

  if (insights.negative_correlations.length > 0) {
    console.log(`\nNegative (inverse relationship):`)
    for (const corr of insights.negative_correlations.slice(0, 5)) {
      const my_name = await player_name_cache.get({ pid: corr.my_player })
      const opp_name = await player_name_cache.get({
        pid: corr.opponent_player
      })
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
}

/**
 * Format bench correlation opportunities output
 */
const format_bench_correlation_opportunities = async ({
  opportunities,
  player_name_cache
}) => {
  if (opportunities.length > 0) {
    console.log(`\n--- Bench Correlation Opportunities ---`)
    console.log(`(Bench players that correlate with opponent starters)`)
    for (const opp of opportunities.slice(0, 5)) {
      const bench_name = await player_name_cache.get({ pid: opp.bench_player })
      const opp_name = await player_name_cache.get({ pid: opp.opponent_player })
      const sign = opp.correlation > 0 ? '+' : ''
      console.log(
        `  ${bench_name} <-> ${opp_name}: ${sign}${opp.correlation.toFixed(2)} (${opp.games_together} games)`
      )
    }
  }
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Run championship simulation and return results
 */
const run_championship_simulation = async ({
  league_id,
  team_ids,
  weeks,
  year,
  n_simulations
}) => {
  console.log('\n=== CHAMPIONSHIP SIMULATION ===\n')

  const championship_results = await simulation.simulate_championship({
    league_id,
    team_ids,
    weeks,
    year,
    n_simulations
  })

  return championship_results
}

/**
 * Analyze lineup decisions for all weeks
 */
const analyze_lineup_decisions = async ({
  league_id,
  team_id,
  opponent_team_ids,
  weeks,
  year,
  n_simulations
}) => {
  const base_week = weeks[0]
  const analyses = []

  for (const week of weeks) {
    const analysis = await simulation.analyze_lineup_decisions({
      league_id,
      team_id,
      opponent_team_ids,
      week,
      year,
      n_simulations,
      fallback_week: week !== base_week ? base_week : undefined
    })
    analyses.push({ week, analysis })
  }

  return analyses
}

/**
 * Analyze correlation insights for all weeks
 */
const analyze_correlation_insights = async ({
  league_id,
  team_id,
  team_ids,
  weeks,
  year
}) => {
  const insights_by_week = []

  for (const week of weeks) {
    // Load rosters to get player IDs
    const rosters = await simulation.load_simulation_rosters({
      league_id,
      team_ids,
      week,
      year
    })

    const my_roster = rosters.find((r) => r.team_id === team_id)
    const opponent_player_ids = rosters
      .filter((r) => r.team_id !== team_id)
      .flatMap((r) => r.player_ids)

    if (!my_roster) {
      continue
    }

    // Get same-team correlations (stacks within your lineup)
    const same_team_corrs = await simulation.get_same_team_correlations({
      player_ids: my_roster.player_ids,
      year
    })

    // Get cross-team correlations (your starters vs opponent starters)
    const cross_team_insights = await simulation.get_correlation_insights({
      player_ids: my_roster.player_ids,
      opponent_player_ids,
      year
    })

    // Get bench correlation opportunities
    const bench_pids = await load_bench_player_ids({
      league_id,
      team_id,
      week,
      year,
      starter_pids: my_roster.player_ids
    })

    let bench_opportunities = []
    if (bench_pids.length > 0) {
      bench_opportunities = await simulation.get_correlation_opportunities({
        bench_pids,
        opponent_player_ids,
        year
      })
    }

    insights_by_week.push({
      week,
      my_roster,
      same_team_corrs,
      cross_team_insights,
      bench_opportunities
    })
  }

  return insights_by_week
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Generate JSON output
 */
const generate_json_output = async ({
  league_id,
  team_id,
  opponent_team_ids,
  weeks,
  year,
  n_simulations,
  championship_results
}) => {
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
}

/**
 * Generate formatted text output
 */
const generate_formatted_output = async ({
  league_id,
  team_id,
  opponent_team_ids,
  weeks,
  year,
  n_simulations,
  championship_results,
  team_name_map,
  week_expected_points,
  week_actual_scores
}) => {
  const player_name_cache = create_player_name_cache()

  // Format championship odds
  format_championship_odds({
    championship_results,
    team_name_map,
    team_id,
    weeks,
    year,
    week_expected_points,
    week_actual_scores
  })

  // Format lineup analysis
  console.log('\n' + '='.repeat(60))
  console.log('=== LINEUP ANALYSIS BY WEEK ===')
  console.log('='.repeat(60))

  const lineup_analyses = await analyze_lineup_decisions({
    league_id,
    team_id,
    opponent_team_ids,
    weeks,
    year,
    n_simulations
  })

  for (const { week, analysis } of lineup_analyses) {
    await format_lineup_analysis({
      analysis,
      week,
      player_name_cache
    })
  }

  // Format correlation insights
  console.log('='.repeat(60))
  console.log('=== CORRELATION INSIGHTS ===')
  console.log('='.repeat(60))

  const all_team_ids = [team_id, ...opponent_team_ids]
  const correlation_insights = await analyze_correlation_insights({
    league_id,
    team_id,
    team_ids: all_team_ids,
    weeks,
    year
  })

  for (const insight of correlation_insights) {
    await format_same_team_correlations({
      same_team_corrs: insight.same_team_corrs,
      week: insight.week,
      player_name_cache
    })

    await format_cross_team_correlations({
      insights: insight.cross_team_insights,
      week: insight.week,
      player_name_cache
    })

    await format_bench_correlation_opportunities({
      opportunities: insight.bench_opportunities,
      player_name_cache
    })
  }

  console.log('\n' + '='.repeat(60) + '\n')
}

/**
 * Main function
 */
const main = async () => {
  try {
    // Parse and validate arguments
    const league_id = argv.lid
    const team_id = argv.team_id
    const opponent_team_ids = argv.opponent_team_ids
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
    const weeks = argv.weeks.split(',').map((w) => parseInt(w.trim(), 10))
    const year = argv.year || new Date().getFullYear()
    const n_simulations = argv.n_simulations
    const all_team_ids = [team_id, ...opponent_team_ids]

    log(`Analyzing championship lineups:`)
    log(`  League: ${league_id}`)
    log(`  Team: ${team_id}`)
    log(`  Opponents: ${opponent_team_ids.join(', ')}`)
    log(`  Weeks: ${weeks.join(', ')}`)
    log(`  Year: ${year}`)

    // Load data
    const team_name_map = await load_team_names({ team_ids: all_team_ids })
    const scoring_format_hash = await load_scoring_format({ league_id, year })

    // Run championship simulation
    const championship_results = await run_championship_simulation({
      league_id,
      team_ids: all_team_ids,
      weeks,
      year,
      n_simulations
    })

    // Build data structures for output
    const week_expected_points = build_week_expected_points({
      championship_results
    })
    const week_actual_scores = await load_week_actual_scores({
      league_id,
      team_ids: all_team_ids,
      weeks,
      year,
      scoring_format_hash
    })

    // Generate output
    if (argv.json) {
      await generate_json_output({
        league_id,
        team_id,
        opponent_team_ids,
        weeks,
        year,
        n_simulations,
        championship_results
      })
    } else {
      await generate_formatted_output({
        league_id,
        team_id,
        opponent_team_ids,
        weeks,
        year,
        n_simulations,
        championship_results,
        team_name_map,
        week_expected_points,
        week_actual_scores
      })
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
