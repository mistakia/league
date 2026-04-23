import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import { getSelectedPlayer } from '@core/selectors'
import { player_actions } from '@core/players'

import SelectedPlayerPractice from './selected-player-practice'

const seas_type_order = { PRE: 0, REG: 1, POST: 2 }

const map_state_to_props = createSelector(getSelectedPlayer, (player_map) => {
  const practice = player_map.get('practice', new List())
  const sorted = practice.sort(
    (a, b) =>
      b.year - a.year ||
      (seas_type_order[b.seas_type] ?? 0) -
        (seas_type_order[a.seas_type] ?? 0) ||
      b.week - a.week
  )

  return {
    player_map,
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
