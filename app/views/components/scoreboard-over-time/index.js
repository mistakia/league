import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlaysByMatchupId } from '@core/scoreboard'
import {
  getSelectedMatchupHomeTeam,
  getSelectedMatchupAwayTeam
} from '@core/matchups'

import ScoreboardOverTime from './scoreboard-over-time'

const mapStateToProps = createSelector(
  getPlaysByMatchupId,
  getSelectedMatchupHomeTeam,
  getSelectedMatchupAwayTeam,
  (plays, home, away) => {
    const homeData = []
    const awayData = []
    let homePoints = 0
    let awayPoints = 0
    const breaks = []
    let lastPlayTime
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

      if (lastPlayTime && (play.time - lastPlayTime > 1800)) {
        breaks.push({
          from: lastPlayTime * 1000,
          to: play.time * 1000,
          breakSize: 1
        })
      }
      lastPlayTime = play.time
    }

    return { homeData, awayData, breaks, home, away }
  }
)

export default connect(
  mapStateToProps
)(ScoreboardOverTime)
