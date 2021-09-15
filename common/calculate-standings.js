import * as constants from './constants'
import calculatePoints from './calculate-points'
import optimizeStandingsLineup from './optimize-standings-lineup'

const average = (data) => data.reduce((sum, value) => sum + value) / data.length
const standardDeviation = (values) =>
  Math.sqrt(average(values.map((value) => (value - average(values)) ** 2)))

const calculateStandings = ({
  starters,
  active,
  league,
  tids,
  gamelogs,
  matchups,
  year = constants.season.year
}) => {
  const finalWeek =
    year === constants.season.year
      ? constants.season.week
      : constants.season.finalWeek
  const teamStats = {}
  for (const tid of tids) {
    teamStats[tid] = {
      tid,
      gamelogs: [],
      games: {},
      points: {
        weeks: {}
      },
      stats: constants.createFantasyTeamStats(),
      potentialPoints: {},
      potentialPointsPenalty: {}
    }

    teamStats[tid].stats.pmin = 99999
  }

  const minStarters =
    league.sqb +
    league.srb +
    league.swr +
    league.ste +
    league.srbwr +
    league.srbwrte +
    league.sqbrbwrte +
    league.swrte +
    league.sdst +
    league.sk

  for (let week = 1; week <= finalWeek; week++) {
    for (const tid of tids) {
      const startingPlayers = starters[week][tid]
      const starterIds = startingPlayers.map((p) => p.player)
      let total = 0
      teamStats[tid].games[week] = {}
      const optimizePlayers = []
      for (const { player, pos } of active[week][tid]) {
        const gamelog = gamelogs.find(
          (g) => g.week === week && g.player === player
        )
        if (!gamelog) {
          continue
        }

        teamStats[tid].gamelogs.push(gamelog)
        const points = calculatePoints({
          stats: gamelog,
          position: pos,
          league
        })
        teamStats[tid].games[week][player] = points.total
        if (starterIds.includes(player)) {
          const starter = startingPlayers.find((p) => p.player === player)
          total = points.total + total
          teamStats[tid].stats[`pPos${pos}`] += points.total
          teamStats[tid].stats[`pSlot${starter.slot}`] += points.total
        }
        optimizePlayers.push({
          player,
          pos,
          points: points.total
        })
      }

      // calculate optimal lineup
      const optimizeResult = optimizeStandingsLineup({
        players: optimizePlayers,
        league
      })
      // TODO - determine regular season end based on league settings
      if (optimizeResult.starters.length < minStarters && week < 14) {
        teamStats[tid].potentialPointsPenalty[week] = true
      }
      teamStats[tid].potentialPoints[week] = optimizeResult.total
      teamStats[tid].stats.pp += optimizeResult.total

      if (teamStats[tid].stats.pmax < total) teamStats[tid].stats.pmax = total
      if (teamStats[tid].stats.pmin > total) teamStats[tid].stats.pmin = total

      teamStats[tid].points.weeks[week] = total
      teamStats[tid].stats.pf += total
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

    for (const tid of tids) {
      const scores = Object.values(teamStats)
        .filter((p) => p.tid !== tid)
        .map((p) => p.points.weeks[week])
      const score = teamStats[tid].points.weeks[week]
      teamStats[tid].stats.apWins += scores.filter((p) => p < score).length
      teamStats[tid].stats.apLosses += scores.filter((p) => p > score).length
      teamStats[tid].stats.apTies += scores.filter((p) => p === score).length

      if (teamStats[tid].potentialPointsPenalty[week]) {
        const pps = Object.values(teamStats).map((p) => p.potentialPoints[week])
        const max = Math.max(...pps)
        teamStats[tid].stats.ppp += max - teamStats[tid].potentialPoints[week]
      }
    }
  }

  // calculate draft order
  const potentialPoints = Object.values(teamStats).map(
    (p) => p.stats.pp + p.stats.ppp
  )
  const allPlayLosses = Object.values(teamStats).map((p) => p.stats.apLosses)
  const minPP = Math.min(...potentialPoints)
  const maxPP = Math.max(...potentialPoints)
  const minAPL = Math.min(...allPlayLosses)
  const maxAPL = Math.max(...allPlayLosses)
  for (const tid of tids) {
    const pp = teamStats[tid].stats.pp + teamStats[tid].stats.ppp
    const apl = teamStats[tid].stats.apLosses
    const normPP = (pp - minPP) / (maxPP - minPP)
    const normAPL = (apl - minAPL) / (maxAPL - minAPL)
    teamStats[tid].stats.doi = 9 * normPP + normAPL || 0

    const points = Object.values(teamStats[tid].points.weeks)
    teamStats[tid].stats.pdev = points.length ? standardDeviation(points) : null
    teamStats[tid].stats.pdiff =
      teamStats[tid].stats.pf - teamStats[tid].stats.pa
    teamStats[tid].stats.pp_pct =
      (teamStats[tid].stats.pf / teamStats[tid].stats.pp) * 100
  }

  return teamStats
}

export default calculateStandings
