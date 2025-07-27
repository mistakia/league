import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, getBaselines } from '@core/selectors'
import { constants } from '@libs-shared'

import SelectedPlayerValue from './selected-player-value'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  getBaselines,
  (player_map, baselines) => {
    const baData = []
    const wsData = []
    const position = player_map.get('pos')
    for (const week of constants.fantasyWeeks) {
      if (week < constants.week) continue
      baData.push(
        parseFloat(
          (
            player_map.getIn(['points', `${week}`, 'total'], 0) -
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
            player_map.getIn(['points', `${week}`, 'total'], 0) -
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

export default connect(map_state_to_props)(SelectedPlayerValue)
