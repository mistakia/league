import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { isBeforeExtensionDeadline, get_app } from '@core/selectors'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  isBeforeExtensionDeadline,
  get_app,
  (isBeforeExtensionDeadline, app) => ({
    isBeforeExtensionDeadline,
    is_manager_in_league: app.get('leagueIds').includes(app.get('leagueId'))
  })
)

export default connect(mapStateToProps)(PlayerRoster)
