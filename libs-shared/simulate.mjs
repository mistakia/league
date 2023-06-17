import gaussian from 'gaussian'

import groupBy from './group-by.mjs'

const SIMULATIONS = 10000

export default function simulate({ teams, matchups, rosters }) {
  const result = {}

  for (const tid in rosters) {
    result[tid] = {
      tid: rosters[tid].tid,
      wildcards: 0,
      wildcard_round_wins: 0,
      wildcard_round_appearances: 0,
      byes: 0,
      championship_round_wins: 0,
      championship_round_appearances: 0,
      division_wins: 0,
      playoff_appearances: 0
    }
  }

  // TODO randomize injuries
  // TODO call optimizeLineup and randomize injuries and length of absense

  const distributions = {}
  for (const matchup of matchups) {
    const home = rosters[matchup.hid].lineups[matchup.week]
    const away = rosters[matchup.aid].lineups[matchup.week]

    // TODO - use individual player probability curves
    // TODO - calculate team std dev based on history
    const dist = {}
    dist.home = gaussian(home.baseline_total, Math.pow(20, 2))
    dist.away = gaussian(away.baseline_total, Math.pow(20, 2))
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
        pf: 0,
        apWins: 0,
        apLosses: 0,
        apTies: 0,
        points: {}
      }
    }

    for (const matchup of matchups) {
      const dist = distributions[matchup.uid]
      const homeScore = dist.home.random(1)[0]
      const awayScore = dist.away.random(1)[0]

      standings[matchup.hid].points[matchup.week] = homeScore
      standings[matchup.hid].pf += homeScore

      standings[matchup.aid].points[matchup.week] = awayScore
      standings[matchup.aid].pf += awayScore

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

    const weeks = [...new Set(matchups.map((p) => p.week))]
    for (let week = Math.min(...weeks); week <= Math.max(...weeks); week++) {
      for (const tid in teams) {
        const scores = Object.values(standings)
          .filter((p) => p.tid !== tid)
          .map((p) => p.points[week])

        const score = standings[tid].points[week]

        standings[tid].apWins += scores.filter((p) => p < score).length
        standings[tid].apLosses += scores.filter((p) => p > score).length
        standings[tid].apTies += scores.filter((p) => p === score).length
      }
    }

    // process standings, combine with current standings
    for (const tid in rosters) {
      const team = teams[tid]
      standings[tid].wins += team.stats.wins
      standings[tid].losses += team.stats.losses
      standings[tid].ties += team.stats.ties

      standings[tid].apWins += team.stats.apWins
      standings[tid].apLosses += team.stats.apLosses
      standings[tid].apTies += team.stats.apTies

      standings[tid].pf += team.stats.pf
    }

    // determine division winners
    const divisions = groupBy(Object.values(standings), 'div')
    const divisionWinners = []
    for (const teams of Object.values(divisions)) {
      const sorted = teams.sort(
        (a, b) => b.wins - a.wins || b.ties - a.ties || b.pf - a.pf
      )
      divisionWinners.push(sorted[0])
    }
    const sortedDivisionWinners = divisionWinners.sort(
      (a, b) => b.apWins - a.apWins || b.apTies - a.apTies || b.pf - a.pf
    )
    const byeTeams = sortedDivisionWinners.slice(0, 2)
    const divisionWinnerIds = divisionWinners.map((t) => t.tid)

    // determine wildcard winners
    const wildcardRanks = Object.values(standings)
      .filter((t) => !divisionWinnerIds.includes(t.tid))
      .sort((a, b) => b.pf - a.pf)
    const wildcardWinners = wildcardRanks.slice(0, 2)

    // determine playoff teams
    const wildcardTeams = wildcardWinners.concat(
      sortedDivisionWinners.slice(2, 4)
    )
    const playoffTeams = byeTeams.concat(wildcardTeams)

    // record results
    divisionWinners.forEach((t) => {
      result[t.tid].division_wins += 1
    })
    wildcardWinners.forEach((t) => {
      result[t.tid].wildcards += 1
    })
    playoffTeams.forEach((t) => {
      result[t.tid].playoff_appearances += 1
    })
    byeTeams.forEach((t) => {
      result[t.tid].byes += 1
    })

    // simulate wildcard round

    const wildcardRoundScores = []
    const wildcardWeek = 15
    const wildcardDivisionWinners = sortedDivisionWinners.slice(2)
    const wildcardRoundTeams = wildcardWinners.concat(wildcardDivisionWinners)
    for (const team of wildcardRoundTeams) {
      const lineup = rosters[team.tid].lineups[wildcardWeek]
      const distribution = gaussian(lineup.baseline_total, Math.pow(20, 2))
      const score = distribution.random(1)[0]
      wildcardRoundScores.push({
        tid: team.tid,
        score
      })
    }

    const sortedWildcardRoundScores = wildcardRoundScores.sort(
      (a, b) => b.score - a.score
    )
    const wildcardRoundWinnerIds = sortedWildcardRoundScores
      .slice(0, 2)
      .map((p) => p.tid)
    const wildcardRoundWinners = wildcardRoundTeams.filter((p) =>
      wildcardRoundWinnerIds.includes(p.tid)
    )

    wildcardRoundTeams.forEach((t) => {
      result[t.tid].wildcard_round_appearances += 1
    })
    wildcardRoundWinners.forEach((t) => {
      result[t.tid].wildcard_round_wins += 1
    })

    // simulate championship round

    const championshipRoundWeek1 = 16
    const championshipRoundWeek2 = 17
    const championshipRoundScores = []
    const championshipRoundTeams = wildcardRoundWinners.concat(byeTeams)

    for (const team of championshipRoundTeams) {
      const lineup1 = rosters[team.tid].lineups[championshipRoundWeek1]
      const lineup2 = rosters[team.tid].lineups[championshipRoundWeek2]
      const distribution1 = gaussian(lineup1.baseline_total, Math.pow(20, 2))
      const distribution2 = gaussian(lineup2.baseline_total, Math.pow(20, 2))
      const score1 = distribution1.random(1)[0]
      const score2 = distribution2.random(1)[0]
      championshipRoundScores.push({
        tid: team.tid,
        score: score1 + score2
      })
    }

    const sortedChampionshipRoundScores = championshipRoundScores.sort(
      (a, b) => b.score - a.score
    )
    const championshipWinner = sortedChampionshipRoundScores[0]

    result[championshipWinner.tid].championship_round_wins += 1

    championshipRoundTeams.forEach((t) => {
      result[t.tid].championship_round_appearances += 1
    })

    // TODO calculate draft order
  }

  // process simulation results
  // TODO draft order

  for (const [tid, team] of Object.entries(result)) {
    result[tid].playoff_odds = team.playoff_appearances / SIMULATIONS
    result[tid].division_odds = team.division_wins / SIMULATIONS
    result[tid].bye_odds = team.byes / SIMULATIONS
    result[tid].championship_odds = team.championship_round_wins / SIMULATIONS
  }

  return result
}
