import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import moment from 'moment-timezone'

import { getPlaysByMatchupId, getStartersByMatchupId } from '@core/scoreboard'
import {
  getSelectedMatchupHomeTeam,
  getSelectedMatchupAwayTeam
} from '@core/matchups'

import ScoreboardOverTime from './scoreboard-over-time'

const mapStateToProps = createSelector(
  getPlaysByMatchupId,
  getStartersByMatchupId,
  getSelectedMatchupHomeTeam,
  getSelectedMatchupAwayTeam,
  (plays, starters, home, away) => {
    const breaks = []
    const homeProjection = []
    const awayProjection = []
    const week = starters.matchup.week
    let homeProjectedPoints = 0
    let awayProjectedPoints = 0
    let lastTime

    const dates = Object.keys(starters.games)
    const sorted = dates.sort((a, b) =>
      moment.tz(a, 'M/D/YYYY HH:mm', 'America/New_York').unix() - moment.tz(b, 'M/D/YYYY HH:mm', 'America/New_York').unix())
    for (const date of sorted) {
      const players = starters.games[date]
      let hPoints = 0
      let aPoints = 0
      for (const player of players) {
        const isHome = !!starters.home.find(p => p.player === player.player)
        if (isHome) {
          hPoints += player.getIn(['points', `${week}`, 'total'], 0)
        } else {
          aPoints += player.getIn(['points', `${week}`, 'total'], 0)
        }
      }
      const start = moment.tz(date, 'M/D/YYYY HH:mm', 'America/New_York')
      const end = start.clone().add(3, 'hours')//.add('25', 'minutes')

      const isLast = sorted[sorted.length - 1] === date
      if (hPoints || isLast) {
        const last = homeProjection[homeProjection.length - 1]
        if (!last || last[0] < start.valueOf()) {
          homeProjection.push([
            start.valueOf(),
            parseFloat(homeProjectedPoints.toFixed(1))
          ])
        }

        homeProjectedPoints += hPoints
        homeProjection.push([
          end.valueOf(),
          parseFloat(homeProjectedPoints.toFixed(1))
        ])
      }

      if (aPoints || isLast) {
        const last = awayProjection[awayProjection.length - 1]
        if (!last || last[0] < start.valueOf()) {
          awayProjection.push([
            start.valueOf(),
            parseFloat(awayProjectedPoints.toFixed(1))
          ])
        }

        awayProjectedPoints += aPoints
        awayProjection.push([
          end.valueOf(),
          parseFloat(awayProjectedPoints.toFixed(1))
        ])
      }

      if (lastTime && (start.unix() - lastTime > 21600)) {
        breaks.push({
          from: lastTime * 1000,
          to: start.valueOf(),
          breakSize: 1
        })
      }
      lastTime = end.unix()
    }

    const homeData = []
    const awayData = []
    let homePoints = 0
    let awayPoints = 0
    for (const play of plays.reverse()) {
      let hPoints = 0
      let aPoints = 0

      for (const points of Object.values(play.points)) {
        if (points.isHomePlayer) {
          hPoints += points.total
        } else {
          aPoints += points.total
        }
      }

      if (hPoints) {
        homePoints += hPoints
        homeData.push([
          play.time * 1000,
          parseFloat(homePoints.toFixed(1))
        ])
      }

      if (aPoints) {
        awayPoints += aPoints
        awayData.push([
          play.time * 1000,
          parseFloat(awayPoints.toFixed(1))
        ])
      }
    }

    return { homeData, awayData, breaks, home, away, homeProjection, awayProjection }
  }
)

export default connect(
  mapStateToProps
)(ScoreboardOverTime)
