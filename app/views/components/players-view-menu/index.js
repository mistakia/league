import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers, playerActions } from '@core/players'

import PlayersViewMenu from './players-view-menu'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  view: players.get('view')
}))

const mapDispatchToProps = {
  update: playerActions.setView
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayersViewMenu)
