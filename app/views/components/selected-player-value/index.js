import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, getBaselines } from '@core/selectors'
import { constants } from '@libs-shared'

import SelectedPlayerValue from './selected-player-value'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getBaselines,
  (playerMap, baselines) => {
    const baData = []
    const wsData = []
    const position = playerMap.get('pos')
    for (const week of constants.fantasyWeeks) {
      if (week < constants.week) continue
      baData.push(
        parseFloat(
          (
            playerMap.getIn(['points', `${week}`, 'total'], 0) -
            baselines.getIn([
              `${week}`,
              position,
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
            playerMap.getIn(['points', `${week}`, 'total'], 0) -
            baselines.getIn([
              `${week}`,
              position,
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
      baData,
      wsData
    }
  }
)

export default connect(mapStateToProps)(SelectedPlayerValue)
