import { constants, calculatePoints } from '@common'

export function calculate ({
  league,
  tids,
  starters,
  gamelogs,
  matchups
}) {
  const result = {}
  for (const tid of tids) {
    result[tid] = {
      tid,
      gamelogs: [],
      games: {},
      points: {},

      wins: 0,
      losses: 0,
      ties: 0,

      allPlayWins: 0,
      allPlayLosses: 0,
      allPlayTies: 0,

      pointsFor: 0,
      pointsAgainst: 0,
      potentialPointsFor: 0
    }
  }

  for (let week = 1; week < constants.season.week; week++) {
    for (const tid of tids) {
      const players = starters[week][tid]
      let total = 0
      result[tid].games[week] = {}
      for (const { player, pos } of players) {
        const gamelog = gamelogs.find(g => g.week === week && g.player === player)
        if (!gamelog) {
          console.log(`missing gamelog ${week} ${player}`)
          continue
        }

        result[tid].gamelogs.push(gamelog)
        const points = calculatePoints({ stats: gamelog, position: pos, league })
        result[tid].games[week][player] = points.total
        total = points.total + total
      }

      // TODO - calculate optimal lineup

      result[tid].points[week] = total
      result[tid].pointsFor += total
    }
  }

  for (let week = 1; week < constants.season.week; week++) {
    const weekMatchups = matchups.filter(m => m.week === week)
    for (const m of weekMatchups) {
      const homeScore = result[m.hid].points[week]
      const awayScore = result[m.aid].points[week]

      result[m.hid].pointsAgainst += awayScore
      result[m.aid].pointsAgainst += homeScore

      if (homeScore > awayScore) {
        result[m.hid].wins += 1
        result[m.aid].losses += 1
      } else if (homeScore < awayScore) {
        result[m.hid].losses += 1
        result[m.aid].wins += 1
      } else {
        result[m.hid].ties += 1
        result[m.aid].ties += 1
      }
    }

    // TODO - calculate all play record
  }

  // TODO - calculate draft order

  return result
}
