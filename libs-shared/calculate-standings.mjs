import debug from 'debug'
import { current_season, create_empty_fantasy_team_stats } from '#constants'
import calculatePoints from './calculate-points.mjs'
import optimizeStandingsLineup from './optimize-standings-lineup.mjs'
import get_playoff_seeding from './get-playoff-seeding.mjs'
import compare_playoff_seed from './compare-playoff-seed.mjs'
import { enable_debug_namespaces } from './enable-debug-namespaces.mjs'

const log = debug('calculate-standings')

enable_debug_namespaces('calculate-standings')

const average = (data) => data.reduce((sum, value) => sum + value) / data.length
const standardDeviation = (values) =>
  Math.sqrt(average(values.map((value) => (value - average(values)) ** 2)))

const calculateStandings = ({
  starters,
  active,
  league,
  teams,
  gamelogs,
  matchups,
  year = current_season.year
}) => {
  const final_week =
    year === current_season.year
      ? Math.min(
          Math.max(current_season.week - 1, 0),
          current_season.regular_season_final_week
        )
      : current_season.regular_season_final_week
  const teamStats = {}
  for (const { team_id: tid, division } of teams) {
    teamStats[tid] = {
      division,
      tid,
      gamelogs: [],
      games: {},
      points: {
        weeks: {}
      },
      stats: create_empty_fantasy_team_stats(),
      potential_points_weekly: {},
      incomplete_optimal_lineup_weeks: new Set()
    }

    teamStats[tid].stats.lowest_weekly_score = Infinity
  }

  const required_starter_count =
    league.starter_slots_quarterback +
    league.starter_slots_running_back +
    league.starter_slots_wide_receiver +
    league.starter_slots_tight_end +
    league.starter_slots_running_back_wide_receiver_flex +
    league.starter_slots_running_back_wide_receiver_tight_end_flex +
    league.starter_slots_superflex +
    league.starter_slots_wide_receiver_tight_end_flex +
    league.starter_slots_defense_special_teams +
    league.starter_slots_kicker

  for (let week = 1; week <= final_week; week++) {
    let highest_score = -Infinity
    let highest_scoring_teams = []

    for (const { team_id: tid } of teams) {
      const startingPlayers = starters[week][tid]
      const starter_pids = startingPlayers.map((p) => p.pid)
      let total = 0
      teamStats[tid].games[week] = {}
      const optimizePlayers = []
      for (const { pid, pos } of active[week][tid]) {
        const gamelog = gamelogs.find((g) => g.week === week && g.pid === pid)
        if (!gamelog) {
          log(`No gamelog found for pid ${pid} in week ${week}`)
          continue
        }

        teamStats[tid].gamelogs.push(gamelog)
        const points = calculatePoints({
          stats: gamelog,
          position: pos,
          league
        })
        teamStats[tid].games[week][pid] = points.total
        if (starter_pids.includes(pid)) {
          const starter = startingPlayers.find((p) => p.pid === pid)
          total = points.total + total
          teamStats[tid].stats[`starter_points_${pos.toLowerCase()}`] +=
            points.total
          teamStats[tid].stats[`starter_slot_${starter.slot}_points`] +=
            points.total
        }
        optimizePlayers.push({
          pid,
          pos,
          points: points.total
        })
      }

      // calculate optimal lineup
      const optimize_result = optimizeStandingsLineup({
        players: optimizePlayers,
        league
      })
      teamStats[tid].potential_points_weekly[week] = optimize_result.total
      teamStats[tid].stats.potential_points += optimize_result.total

      if (optimize_result.starters.length < required_starter_count) {
        teamStats[tid].incomplete_optimal_lineup_weeks.add(week)
      }

      if (teamStats[tid].stats.highest_weekly_score < total)
        teamStats[tid].stats.highest_weekly_score = total
      if (teamStats[tid].stats.lowest_weekly_score > total)
        teamStats[tid].stats.lowest_weekly_score = total

      teamStats[tid].points.weeks[week] = total
      teamStats[tid].stats.points_for += total

      // Update highest score tracking
      if (total > highest_score) {
        highest_score = total
        highest_scoring_teams = [tid]
      } else if (total === highest_score) {
        highest_scoring_teams.push(tid)
      }
    }

    // Increment weekly_high_scores for the highest scoring team(s)
    for (const tid of highest_scoring_teams) {
      teamStats[tid].stats.weekly_high_scores += 1
    }
  }

  for (let week = 1; week <= final_week; week++) {
    const weekMatchups = matchups.filter((m) => m.week === week)
    for (const m of weekMatchups) {
      const homeScore = teamStats[m.home_team_id].points.weeks[week]
      const awayScore = teamStats[m.away_team_id].points.weeks[week]

      const pHomeScore = teamStats[m.home_team_id].potential_points_weekly[week]
      const pAwayScore = teamStats[m.away_team_id].potential_points_weekly[week]

      teamStats[m.home_team_id].stats.points_against += awayScore
      teamStats[m.away_team_id].stats.points_against += homeScore

      if (homeScore > awayScore) {
        teamStats[m.home_team_id].stats.regular_season_wins += 1
        teamStats[m.away_team_id].stats.regular_season_losses += 1

        if (pAwayScore > homeScore) {
          teamStats[m.away_team_id].stats.potential_wins += 1
          teamStats[m.home_team_id].stats.potential_losses += 1
        }
      } else if (homeScore < awayScore) {
        teamStats[m.home_team_id].stats.regular_season_losses += 1
        teamStats[m.away_team_id].stats.regular_season_wins += 1

        if (pHomeScore > awayScore) {
          teamStats[m.home_team_id].stats.potential_wins += 1
          teamStats[m.away_team_id].stats.potential_losses += 1
        }
      } else {
        teamStats[m.home_team_id].stats.regular_season_ties += 1
        teamStats[m.away_team_id].stats.regular_season_ties += 1
      }
    }

    // calculate all play record

    for (const { team_id: tid } of teams) {
      const scores = Object.values(teamStats)
        .filter((p) => p.tid !== tid)
        .map((p) => p.points.weeks[week])
      const score = teamStats[tid].points.weeks[week]
      teamStats[tid].stats.all_play_wins += scores.filter(
        (p) => p < score
      ).length
      teamStats[tid].stats.all_play_losses += scores.filter(
        (p) => p > score
      ).length
      teamStats[tid].stats.all_play_ties += scores.filter(
        (p) => p === score
      ).length
    }
  }

  // calculate draft order index from (potential_points + potential_points_penalty);
  // potential_points_penalty defaults to 0 here -- the script layer applies the
  // pick-ownership gate, sets the penalty per team, and recomputes this in place.
  const potential_points_per_team = Object.values(teamStats).map(
    (p) => p.stats.potential_points + p.stats.potential_points_penalty
  )
  const all_play_losses_per_team = Object.values(teamStats).map(
    (p) => p.stats.all_play_losses
  )
  const min_potential_points = Math.min(...potential_points_per_team)
  const max_potential_points = Math.max(...potential_points_per_team)
  const min_all_play_losses = Math.min(...all_play_losses_per_team)
  const max_all_play_losses = Math.max(...all_play_losses_per_team)
  for (const { team_id: tid } of teams) {
    const potential_points =
      teamStats[tid].stats.potential_points +
      teamStats[tid].stats.potential_points_penalty
    const all_play_losses = teamStats[tid].stats.all_play_losses
    const normalized_potential_points =
      (potential_points - min_potential_points) /
      (max_potential_points - min_potential_points)
    const normalized_all_play_losses =
      (all_play_losses - min_all_play_losses) /
      (max_all_play_losses - min_all_play_losses)
    teamStats[tid].stats.draft_order_index =
      9 * normalized_potential_points + normalized_all_play_losses || 0

    const points = Object.values(teamStats[tid].points.weeks)
    teamStats[tid].stats.weekly_score_deviation = points.length
      ? standardDeviation(points)
      : null
    teamStats[tid].stats.point_differential =
      teamStats[tid].stats.points_for - teamStats[tid].stats.points_against
    teamStats[tid].stats.potential_points_percentage =
      (teamStats[tid].stats.points_for /
        teamStats[tid].stats.potential_points) *
        100 || null

    if (teamStats[tid].stats.lowest_weekly_score === Infinity)
      teamStats[tid].stats.lowest_weekly_score = null
  }

  // calculate division finish
  const divisions = {}
  for (const { team_id: tid } of teams) {
    const { division } = teams.find((t) => t.team_id === tid)
    if (!divisions[division]) divisions[division] = []
    divisions[division].push(tid)
  }
  const divisions_index = {}
  for (const division in divisions) {
    const div_teams = divisions[division]
    const div_teams_sorted = div_teams.sort((team_a_tid, team_b_tid) => {
      const a_wins = teamStats[team_a_tid].stats.regular_season_wins
      const b_wins = teamStats[team_b_tid].stats.regular_season_wins
      const a_losses = teamStats[team_a_tid].stats.regular_season_losses
      const b_losses = teamStats[team_b_tid].stats.regular_season_losses
      const a_ties = teamStats[team_a_tid].stats.regular_season_ties
      const b_ties = teamStats[team_b_tid].stats.regular_season_ties
      const a_points_for = teamStats[team_a_tid].stats.points_for
      const b_points_for = teamStats[team_b_tid].stats.points_for
      const a_all_play = teamStats[team_a_tid].stats.all_play_wins
      const b_all_play = teamStats[team_b_tid].stats.all_play_wins

      if (a_wins > b_wins) return -1
      if (a_wins < b_wins) return 1
      if (a_losses < b_losses) return -1
      if (a_losses > b_losses) return 1
      if (a_ties > b_ties) return -1
      if (a_ties < b_ties) return 1
      if (a_points_for > b_points_for) return -1
      if (a_points_for < b_points_for) return 1
      if (a_all_play > b_all_play) return -1
      if (a_all_play < b_all_play) return 1

      return 0
    })

    divisions_index[division] = div_teams_sorted

    for (let i = 0; i < div_teams_sorted.length; i++) {
      const tid = div_teams_sorted[i]
      teamStats[tid].stats.division_finish = i + 1
    }
  }

  // calculate regular season finish
  //
  // The playoff format comes from the league's season settings, not from this
  // module. division_finish above remains a reported standing either way.
  const flat_teams = Object.values(teamStats).map((p) => ({
    tid: p.tid,
    division: p.division,
    ...p.stats
  }))

  // A league/year with no `seasons` row yields nulls here, because getLeague
  // LEFT JOINs seasons -- and get_playoff_seeding throws on a null field size.
  // Standings must still compute: this function needed no league config at all
  // before the format became configurable, and throwing would abort
  // process-matchups for a year whose season row has not been created yet.
  // league 1 already has `teams` rows for 2027 and no 2027 `seasons` row.
  //
  // Ordering on compare_playoff_seed alone is exactly what the configured
  // defaults produce, so the fallback is the default format rather than an
  // invented one.
  const has_playoff_format = Number.isInteger(league.playoff_team_count)

  const seeded_tids = has_playoff_format
    ? get_playoff_seeding({
        teams: flat_teams,
        playoff_team_count: league.playoff_team_count,
        bye_count: league.bye_count,
        bye_candidate_pool: league.bye_candidate_pool,
        bye_selection_method: league.bye_selection_method,
        at_large_selection_method: league.at_large_selection_method,
        has_division_winner_berths: league.has_division_winner_berths,
        head_to_head_berth_count: league.head_to_head_berth_count
      }).seeded_tids
    : [...flat_teams].sort(compare_playoff_seed).map((team) => team.tid)

  for (let i = 0; i < seeded_tids.length; i++) {
    teamStats[seeded_tids[i]].stats.regular_season_finish = i + 1
  }

  return teamStats
}

export default calculateStandings
