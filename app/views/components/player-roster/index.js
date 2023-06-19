import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  isBeforeExtensionDeadline,
  isBeforeTransitionEnd,
  get_app
} from '@core/selectors'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  isBeforeExtensionDeadline,
  isBeforeTransitionEnd,
  get_app,
  (isBeforeExtensionDeadline, isBeforeTransitionEnd, app) => ({
    isBeforeExtensionDeadline,
    isBeforeTransitionEnd,
    is_manager_in_league: app.get('leagueIds').includes(app.get('leagueId'))
  })
)

export default connect(mapStateToProps)(PlayerRoster)
