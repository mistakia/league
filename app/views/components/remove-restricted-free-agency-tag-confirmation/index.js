import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague, getCurrentPlayers } from '@core/selectors'
import { roster_actions } from '@core/rosters'

import RemoveRestrictedFreeAgencyTagConfirmation from './remove-restricted-free-agency-tag-confirmation'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentPlayers,
  (league, team) => ({
    league,
    team
  })
)

const mapDispatchToProps = {
  remove: roster_actions.remove_restricted_free_agency_tag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoveRestrictedFreeAgencyTagConfirmation)
