import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import dayjs from 'dayjs'

import {
  get_selected_matchup_teams,
  getPlaysByMatchupId,
  getStartersByMatchupId
} from '@core/selectors'

import ScoreboardOverTime from './scoreboard-over-time'

const map_state_to_props = createSelector(
  getPlaysByMatchupId,
  getStartersByMatchupId,
  get_selected_matchup_teams,
  (plays, starters, teams) => {
    const breaks = []
    const week = starters.matchup.week
    let lastTime

    const data = teams.map((team) => ({
      team,
      starters: starters.teams[team.uid] || [],
      projection: [],
      projectedPoints: team.previousWeekScore || 0,
      points: team.previousWeekScore || 0,
      data: []
    }))

    if (!teams.size) {
      return { data, breaks }
    }

    const dates = Object.keys(starters.games)
    const sorted = dates.sort(
      (a, b) =>
        dayjs.tz(a, 'YYYY/MM/DD HH:mm:SS', 'America/New_York').unix() -
        dayjs.tz(b, 'YYYY/MM/DD HH:mm:SS', 'America/New_York').unix()
    )
    for (const date of sorted) {
      const playerMaps = starters.games[date]
      const teamPoints = {}
      teams.forEach((t) => {
        teamPoints[t.uid] = 0
      })

      for (const playerMap of playerMaps) {
        const pid = playerMap.get('pid')
        const team = data.find((t) =>
          t.starters.find((pMap) => pMap.get('pid') === pid)
        )

        if (team) {
          teamPoints[team.team.uid] += playerMap.getIn(
            ['points', `${week}`, 'total'],
            0
          )
        }
      }
      const start = dayjs.tz(date, 'YYYY/MM/DD HH:mm:SS', 'America/New_York')
      const end = start.add(3, 'hours')

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

      for (const [pid, points] of Object.entries(play.points)) {
        const team = data.find((t) =>
          t.starters.find((pMap) => pMap.get('pid') === pid)
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

    const series = []
    const colors = ['red', 'black', 'green', 'blue']
    data.forEach((team, index) => {
      series.push({
        name: team.team.name,
        data: team.data,
        color: colors[index]
      })

      series.push({
        name: `${team.team.name} Projection`,
        data: team.projection,
        dashStyle: 'DashDot',
        color: colors[index]
      })
    })

    return { breaks, series }
  }
)

export default connect(map_state_to_props)(ScoreboardOverTime)
