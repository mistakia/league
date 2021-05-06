import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import moment from 'moment-timezone'

import { getPlaysByMatchupId, getStartersByMatchupId } from '@core/scoreboard'
import { getSelectedMatchupTeams } from '@core/matchups'

import ScoreboardOverTime from './scoreboard-over-time'

const mapStateToProps = createSelector(
  getPlaysByMatchupId,
  getStartersByMatchupId,
  getSelectedMatchupTeams,
  (plays, starters, teams) => {
    const breaks = []
    const week = starters.matchup.week
    let lastTime
    const data = teams.map((team) => ({
      team,
      starters: starters.teams[team.uid] || [],
      projection: [],
      projectedPoints: 0,
      points: 0,
      data: []
    }))

    if (!teams.length) {
      return { data, breaks }
    }

    const dates = Object.keys(starters.games)
    const sorted = dates.sort(
      (a, b) =>
        moment.tz(a, 'M/D/YYYY HH:mm', 'America/New_York').unix() -
        moment.tz(b, 'M/D/YYYY HH:mm', 'America/New_York').unix()
    )
    for (const date of sorted) {
      const players = starters.games[date]
      const teamPoints = {}
      teams.forEach((t) => {
        teamPoints[t.uid] = 0
      })

      for (const player of players) {
        const team = data.find((t) =>
          t.starters.find((p) => p.player === player.player)
        )
        if (team)
          teamPoints[team.team.uid] += player.getIn(
            ['points', `${week}`, 'total'],
            0
          )
      }
      const start = moment.tz(date, 'M/D/YYYY HH:mm', 'America/New_York')
      const end = start.clone().add(3, 'hours')

      const isLast = sorted[sorted.length - 1] === date

      for (const [tid, points] of Object.entries(teamPoints)) {
        if (points || isLast) {
          const team = data.find((t) => t.team.uid === parseInt(tid, 10))
          if (!team) continue
          const last = team.projection[team.projection.length - 1]
          if (!last || last[0] < start.valueOf()) {
            team.projection.push([
              start.valueOf(),
              parseFloat(team.projectedPoints.toFixed(1))
            ])
          }

          team.projectedPoints += points
          team.projection.push([
            end.valueOf(),
            parseFloat(team.projectedPoints.toFixed(1))
          ])
        }
      }

      if (lastTime && start.unix() - lastTime > 21600) {
        breaks.push({
          from: lastTime * 1000,
          to: start.valueOf(),
          breakSize: 1
        })
      }
      lastTime = end.unix()
    }

    for (const play of plays.reverse()) {
      const teamPoints = {}
      teams.forEach((t) => {
        teamPoints[t.uid] = 0
      })

      for (const [player, points] of Object.entries(play.points)) {
        const team = data.find((t) =>
          t.starters.find((p) => p.player === player)
        )
        if (team) teamPoints[team.team.uid] += points.total
      }

      for (const [tid, points] of Object.entries(teamPoints)) {
        if (points) {
          const team = data.find((t) => t.team.uid === parseInt(tid, 10))
          if (!team) continue

          team.points += points
          team.data.push([play.time * 1000, parseFloat(team.points.toFixed(1))])
        }
      }
    }

    return { data, breaks }
  }
)

export default connect(mapStateToProps)(ScoreboardOverTime)
