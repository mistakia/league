import gaussian from 'gaussian'
import { groupBy } from '@common'

const SIMULATIONS = 10000

export function simulate ({
  teams,
  matchups,
  rosters
}) {
  const result = {}

  for (const tid in rosters) {
    result[tid] = {
      tid: rosters[tid].tid,
      wildcards: 0,
      wildcardAppearances: 0,
      byes: 0,
      championships: 0,
      championshipAppearances: 0,
      divisionWins: 0,
      playoffAppearances: 0
    }
  }

  const distributions = {}
  for (const matchup of matchups) {
    const home = rosters[matchup.hid].lineups[matchup.week]
    const away = rosters[matchup.aid].lineups[matchup.week]

    // TODO - use individual player probability curves
    // TODO - calculate team std dev based on history
    const dist = {}
    dist.home = gaussian(home.total, Math.pow(15, 2))
    dist.away = gaussian(away.total, Math.pow(15, 2))
    distributions[matchup.uid] = dist
  }

  for (let i = 0; i < SIMULATIONS; i++) {
    const standings = {}
    for (const tid in rosters) {
      standings[tid] = {
        div: teams[tid].div,
        tid,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0
      }
    }

    for (const matchup of matchups) {
      const dist = distributions[matchup.uid]
      const homeScore = dist.home.random(1)[0]
      const awayScore = dist.away.random(1)[0]

      standings[matchup.hid].pointsFor += homeScore
      standings[matchup.aid].pointsFor += awayScore

      if (homeScore > awayScore) {
        // home team win
        standings[matchup.hid].wins += 1
        standings[matchup.aid].losses += 1
      } else if (awayScore > homeScore) {
        // away team win
        standings[matchup.aid].wins += 1
        standings[matchup.hid].losses += 1
      } else if (awayScore === homeScore) {
        // tie
        standings[matchup.hid].ties += 1
        standings[matchup.aid].ties += 1
      }
    }

    // process standings, combine with current standings
    for (const tid in rosters) {
      const team = teams[tid]
      standings[tid].wins += team.wins
      standings[tid].losses += team.losses
      standings[tid].ties += team.ties
      standings[tid].pointsFor += team.pointsFor
    }

    // determine division winners
    const divisions = groupBy(Object.values(standings), 'div')
    const divisionWinners = []
    for (const teams of Object.values(divisions)) {
      const sorted = teams.sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)
      divisionWinners.push(sorted[0])
    }
    const sortedDivisionWinners = divisionWinners
      .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)
    const byeTeams = sortedDivisionWinners.slice(0, 2)
    const divisionWinnerIds = divisionWinners.map(t => t.tid)

    // determine wildcard winners
    const wildcardRanks = Object.values(standings)
      .filter(t => !divisionWinnerIds.includes(t.tid))
      .sort((a, b) => b.pointsFor - a.pointsFor)
    const wildcardWinners = wildcardRanks.slice(0, 2)

    // determine playoff teams
    const wildcardTeams = wildcardWinners
      .concat(sortedDivisionWinners.slice(2, 4))
    const playoffTeams = byeTeams.concat(wildcardTeams)

    // record results
    divisionWinners.forEach(t => { result[t.tid].divisionWins += 1 })
    wildcardWinners.forEach(t => { result[t.tid].wildcards += 1 })
    playoffTeams.forEach(t => { result[t.tid].playoffAppearances += 1 })
    wildcardTeams.forEach(t => { result[t.tid].wildcardAppearances += 1 })
    byeTeams.forEach(t => { result[t.tid].byes += 1 })

    // TODO simulate playoffs

    // TODO record wildcard winners
    // TODO record championship teams

    // TODO calculate draft order

    // TODO save result
  }

  // process simulation results
  // TODO championship appearance
  // TODO championship win
  // TODO draft order
  for (const [tid, team] of Object.entries(result)) {
    result[tid].playoffOdds = team.playoffAppearances / SIMULATIONS
    result[tid].divisionOdds = team.divisionWins / SIMULATIONS
    result[tid].byeOdds = team.byes / SIMULATIONS
  }

  return result
}
