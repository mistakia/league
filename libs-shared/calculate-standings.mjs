import debug from 'debug'
import * as constants from './constants.mjs'
import calculatePoints from './calculate-points.mjs'
import optimizeStandingsLineup from './optimize-standings-lineup.mjs'

const log = debug('calculate-standings')
debug.enable('calculate-standings')

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
  year = constants.season.year
}) => {
  const finalWeek =
    year === constants.season.year
      ? Math.min(
          Math.max(constants.season.week - 1, 0),
          constants.season.regularSeasonFinalWeek
        )
      : constants.season.regularSeasonFinalWeek
  const teamStats = {}
  for (const { uid: tid, div } of teams) {
    teamStats[tid] = {
      div,
      tid,
      gamelogs: [],
      games: {},
      points: {
        weeks: {}
      },
      stats: constants.createFantasyTeamStats(),
      potentialPoints: {}
    }

    teamStats[tid].stats.pmin = Infinity
  }

  for (let week = 1; week <= finalWeek; week++) {
    let highest_score = -Infinity
    let highest_scoring_teams = []

    for (const { uid: tid } of teams) {
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
          teamStats[tid].stats[`pPos${pos}`] += points.total
          teamStats[tid].stats[`pSlot${starter.slot}`] += points.total
        }
        optimizePlayers.push({
          pid,
          pos,
          points: points.total
        })
      }

      // calculate optimal lineup
      const optimizeResult = optimizeStandingsLineup({
        players: optimizePlayers,
        league
      })
      teamStats[tid].potentialPoints[week] = optimizeResult.total
      teamStats[tid].stats.pp += optimizeResult.total

      if (teamStats[tid].stats.pmax < total) teamStats[tid].stats.pmax = total
      if (teamStats[tid].stats.pmin > total) teamStats[tid].stats.pmin = total

      teamStats[tid].points.weeks[week] = total
      teamStats[tid].stats.pf += total

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

  for (let week = 1; week <= finalWeek; week++) {
    const weekMatchups = matchups.filter((m) => m.week === week)
    for (const m of weekMatchups) {
      const homeScore = teamStats[m.hid].points.weeks[week]
      const awayScore = teamStats[m.aid].points.weeks[week]

      const pHomeScore = teamStats[m.hid].potentialPoints[week]
      const pAwayScore = teamStats[m.aid].potentialPoints[week]

      teamStats[m.hid].stats.pa += awayScore
      teamStats[m.aid].stats.pa += homeScore

      if (homeScore > awayScore) {
        teamStats[m.hid].stats.wins += 1
        teamStats[m.aid].stats.losses += 1

        if (pAwayScore > homeScore) {
          teamStats[m.aid].stats.pw += 1
          teamStats[m.hid].stats.pl += 1
        }
      } else if (homeScore < awayScore) {
        teamStats[m.hid].stats.losses += 1
        teamStats[m.aid].stats.wins += 1

        if (pHomeScore > awayScore) {
          teamStats[m.hid].stats.pw += 1
          teamStats[m.aid].stats.pl += 1
        }
      } else {
        teamStats[m.hid].stats.ties += 1
        teamStats[m.aid].stats.ties += 1
      }
    }

    // calculate all play record

    for (const { uid: tid } of teams) {
      const scores = Object.values(teamStats)
        .filter((p) => p.tid !== tid)
        .map((p) => p.points.weeks[week])
      const score = teamStats[tid].points.weeks[week]
      teamStats[tid].stats.apWins += scores.filter((p) => p < score).length
      teamStats[tid].stats.apLosses += scores.filter((p) => p > score).length
      teamStats[tid].stats.apTies += scores.filter((p) => p === score).length
    }
  }

  // calculate draft order
  const potentialPoints = Object.values(teamStats).map((p) => p.stats.pp)
  const allPlayLosses = Object.values(teamStats).map((p) => p.stats.apLosses)
  const minPP = Math.min(...potentialPoints)
  const maxPP = Math.max(...potentialPoints)
  const minAPL = Math.min(...allPlayLosses)
  const maxAPL = Math.max(...allPlayLosses)
  for (const { uid: tid } of teams) {
    const pp = teamStats[tid].stats.pp
    const apl = teamStats[tid].stats.apLosses
    const normPP = (pp - minPP) / (maxPP - minPP)
    const normAPL = (apl - minAPL) / (maxAPL - minAPL)
    teamStats[tid].stats.doi = 9 * normPP + normAPL || 0

    const points = Object.values(teamStats[tid].points.weeks)
    teamStats[tid].stats.pdev = points.length ? standardDeviation(points) : null
    teamStats[tid].stats.pdiff =
      teamStats[tid].stats.pf - teamStats[tid].stats.pa
    teamStats[tid].stats.pp_pct =
      (teamStats[tid].stats.pf / teamStats[tid].stats.pp) * 100 || null

    if (teamStats[tid].stats.pmin === Infinity) teamStats[tid].stats.pmin = null
  }

  // calculate division finish
  const divisions = {}
  for (const { uid: tid } of teams) {
    const { div } = teams.find((t) => t.uid === tid)
    if (!divisions[div]) divisions[div] = []
    divisions[div].push(tid)
  }
  const divisions_index = {}
  for (const div in divisions) {
    const div_teams = divisions[div]
    const div_teams_sorted = div_teams.sort((team_a_tid, team_b_tid) => {
      const a_wins = teamStats[team_a_tid].stats.wins
      const b_wins = teamStats[team_b_tid].stats.wins
      const a_losses = teamStats[team_a_tid].stats.losses
      const b_losses = teamStats[team_b_tid].stats.losses
      const a_ties = teamStats[team_a_tid].stats.ties
      const b_ties = teamStats[team_b_tid].stats.ties
      const a_points_for = teamStats[team_a_tid].stats.pf
      const b_points_for = teamStats[team_b_tid].stats.pf
      const a_all_play = teamStats[team_a_tid].stats.apWins
      const b_all_play = teamStats[team_b_tid].stats.apWins

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

    divisions_index[div] = div_teams_sorted

    for (let i = 0; i < div_teams_sorted.length; i++) {
      const tid = div_teams_sorted[i]
      teamStats[tid].stats.division_finish = i + 1
    }
  }

  // calculate regular season finish

  const number_of_divisions = Object.keys(divisions).length
  const bye_teams = []
  const division_wildcard_teams = []

  if (number_of_divisions === 4) {
    const all_division_winners = Object.values(teamStats)
      .filter((p) => p.stats.division_finish === 1)
      .sort((a, b) => b.stats.apWins - a.stats.apWins)

    bye_teams.push(all_division_winners[0], all_division_winners[1])
    division_wildcard_teams.push(
      all_division_winners[2],
      all_division_winners[3]
    )
  } else if (number_of_divisions === 2) {
    for (const div in divisions) {
      const sorted_division_leaders = Object.values(teamStats)
        .filter((p) => p.stats.division_finish < 3 && p.div === Number(div))
        .sort((a, b) => b.stats.apWins - a.stats.apWins)

      bye_teams.push(sorted_division_leaders[0])
      division_wildcard_teams.push(sorted_division_leaders[1])
    }
  } else {
    throw new Error(`Unsupported number of divisions: ${number_of_divisions}`)
  }

  const sorted_bye_team_ids = bye_teams
    .sort((a, b) => b.stats.apWins - a.stats.apWins)
    .map((p) => p.tid)

  for (let i = 0; i < sorted_bye_team_ids.length; i++) {
    const tid = sorted_bye_team_ids[i]
    teamStats[tid].stats.regular_season_finish = i + 1
  }

  const sorted_division_wildcard_team_ids = division_wildcard_teams
    .sort((a, b) => b.stats.apWins - a.stats.apWins)
    .map((p) => p.tid)

  for (let i = 0; i < sorted_division_wildcard_team_ids.length; i++) {
    const tid = sorted_division_wildcard_team_ids[i]
    teamStats[tid].stats.regular_season_finish = i + 3
  }

  // remaining teams are sorted by points for
  const division_finish_threshold = number_of_divisions === 4 ? 1 : 2
  const remaining_teams = Object.values(teamStats)
    .filter((p) => p.stats.division_finish > division_finish_threshold)
    .sort((a, b) => b.stats.pf - a.stats.pf)
    .map((p) => p.tid)

  for (let i = 0; i < remaining_teams.length; i++) {
    const tid = remaining_teams[i]
    teamStats[tid].stats.regular_season_finish = i + 5
  }

  return teamStats
}

export default calculateStandings
