import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { calculatePoints, groupBy } from '@libs-shared'
import { player_actions } from '@core/players'
import {
  getGamelogsForSelectedPlayer,
  getSelectedPlayer,
  get_current_league
} from '@core/selectors'

import SelectedPlayerGamelogs from './selected-player-gamelogs'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  getGamelogsForSelectedPlayer,
  get_current_league,
  (player_map, gamelogs, league) => {
    const position = player_map.get('pos')
    gamelogs = gamelogs.map((gamelog) => {
      let points
      if (!gamelog.points) {
        points = calculatePoints({ stats: gamelog, position, league })
      }

      return {
        ...gamelog,
        points: gamelog.points || points.total
      }
    })

    const years = groupBy(gamelogs, 'year')

    return { player_map, years }
  }
)

const map_dispatch_to_props = {
  load: player_actions.load_player_gamelogs
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerGamelogs)
