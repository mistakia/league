import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  getCurrentPlayers,
  getCutlistTotalSalary,
  getPlayers
} from '@core/selectors'

import RestrictedFreeAgencyConfirmation from './restricted-free-agency-confirmation'

const mapStateToProps = createSelector(
  getCurrentPlayers,
  getCutlistTotalSalary,
  getPlayers,
  (team, cutlistTotalSalary, players) => ({
    team,
    cutlistTotalSalary,
    cutlist: players.get('cutlist')
  })
)

const mapDispatchToProps = {
  add_restricted_free_agency_tag: roster_actions.add_restricted_free_agency_tag,
  update_restricted_free_agency_tag:
    roster_actions.update_restricted_free_agency_tag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RestrictedFreeAgencyConfirmation)
