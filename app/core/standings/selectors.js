import { constants } from '@common'
import { getTeamsForCurrentLeague } from '@core/teams'
import { getStartersByTeamId } from '@core/rosters'
import { getGamelogForPlayer } from '@core/stats'
import { getMatchups } from '@core/matchups'
import { getCurrentLeague } from '@core/leagues'

export function getStandings (state) {
  const result = {}
  const league = getCurrentLeague(state)
  const teams = getTeamsForCurrentLeague(state)
  for (const team of teams.valueSeq()) {
    result[team.uid] = {
      team,
      gamelogs: [],
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

  if (teams.size < league.nteams) return result

  // calculate gamelogs for each starter each week
  for (let week = 1; week < constants.season.week; week++) {
    for (const team of teams.valueSeq()) {
      let total = 0
      const starters = getStartersByTeamId(state, { tid: team.uid, week })
      for (const player of starters) {
        if (!player.player) continue
        const gamelog = getGamelogForPlayer(state, { player, week })
        result[team.uid].gamelogs.push(gamelog)
        total = gamelog.total + total
      }
      result[team.uid].points[week] = total
      result[team.uid].pointsFor += total
    }
  }

  const matchups = getMatchups(state).get('items')
  for (let week = 1; week < constants.season.week; week++) {
    const weekMatchups = matchups.filter(m => m.week === week)
    for (const m of weekMatchups) {
      const homeScore = result[m.hid].points[week]
      const awayScore = result[m.aid].points[week]
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
  }

  return result
}
