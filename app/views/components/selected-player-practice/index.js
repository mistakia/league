import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import { getSelectedPlayer } from '@core/selectors'
import { player_actions } from '@core/players'

import SelectedPlayerPractice from './selected-player-practice'

const mapStateToProps = createSelector(getSelectedPlayer, (playerMap) => {
  const practice = playerMap.get('practice', new List())
  const sorted = practice.sort((a, b) => b.year - a.year || b.week - a.week)

  return {
    playerMap,
    practices: sorted
  }
})

const mapDispatchToProps = {
  load: player_actions.load_player_practices
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerPractice)
