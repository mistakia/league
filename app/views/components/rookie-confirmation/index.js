import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague, getCurrentPlayers } from '@core/selectors'
import { roster_actions } from '@core/rosters'

import RookieConfirmation from './rookie-confirmation'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentPlayers,
  (league, team) => ({
    league,
    team
  })
)

const mapDispatchToProps = {
  add: roster_actions.add_tag
}

export default connect(mapStateToProps, mapDispatchToProps)(RookieConfirmation)
