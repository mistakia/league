import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  isBeforeExtensionDeadline,
  isRestrictedFreeAgencyPeriod,
  get_app
} from '@core/selectors'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  isRestrictedFreeAgencyPeriod,
  isBeforeExtensionDeadline,
  get_app,
  (isRestrictedFreeAgencyPeriod, isBeforeExtensionDeadline, app) => ({
    isRestrictedFreeAgencyPeriod,
    isBeforeExtensionDeadline,
    is_manager_in_league: app.get('leagueIds').includes(app.get('leagueId'))
  })
)

export default connect(mapStateToProps)(PlayerRoster)
