import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import { getSelectedPlayer } from '@core/selectors'
import { player_actions } from '@core/players'

import SelectedPlayerPractice from './selected-player-practice'

const map_state_to_props = createSelector(getSelectedPlayer, (playerMap) => {
  const practice = playerMap.get('practice', new List())
  const sorted = practice.sort((a, b) => b.year - a.year || b.week - a.week)

  return {
    playerMap,
    practices: sorted
  }
})

const map_dispatch_to_props = {
  load: player_actions.load_player_practices
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerPractice)
