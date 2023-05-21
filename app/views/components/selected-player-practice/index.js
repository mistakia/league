import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import { getSelectedPlayer } from '@core/selectors'
import { playerActions } from '@core/players'

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
  load: playerActions.loadPlayerPractices
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerPractice)
