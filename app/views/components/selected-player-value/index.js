import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, getBaselines } from '@core/players'
import { constants } from '@common'

import SelectedPlayerValue from './selected-player-value'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getBaselines,
  (player, baselines) => {
    const baData = []
    const wsData = []
    for (const week of constants.fantasyWeeks) {
      if (week < constants.season.week) continue
      baData.push(
        parseFloat(
          (
            player.getIn(['points', `${week}`, 'total'], 0) -
            baselines.getIn([
              `${week}`,
              player.pos,
              'available',
              'points',
              `${week}`,
              'total'
            ])
          ).toFixed(1)
        )
      )
      wsData.push(
        parseFloat(
          (
            player.getIn(['points', `${week}`, 'total'], 0) -
            baselines.getIn([
              `${week}`,
              player.pos,
              'starter',
              'points',
              `${week}`,
              'total'
            ])
          ).toFixed(1)
        )
      )
    }

    return {
      player,
      baData,
      wsData
    }
  }
)

export default connect(mapStateToProps)(SelectedPlayerValue)
