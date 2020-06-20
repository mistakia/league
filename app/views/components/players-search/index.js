import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers, playerActions } from '@core/players'

import PlayersSearch from './players-search'

const mapStateToProps = createSelector(
  getPlayers,
  (players) => ({ value: players.get('search') })
)

const mapDispatchToProps = {
  search: playerActions.search
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayersSearch)
