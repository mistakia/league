import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getFilteredPlayers, getPlayers, playerActions } from '@core/players'

import PlayersPage from './players'

const mapStateToProps = createSelector(
  getFilteredPlayers,
  getPlayers,
  (players, pState) => ({
    players,
    searchValue: players.get('search'),
    selected: pState.get('selected'),
    order: pState.get('order'),
    orderBy: pState.get('orderBy')
  })
)

const mapDispatchToProps = {
  search: playerActions.search
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayersPage)
