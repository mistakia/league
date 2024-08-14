import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_team_by_id_for_current_year, getPlayerById } from '@core/selectors'

import DraftPick from './draft-pick'

const mapStateToProps = createSelector(
  getPlayerById,
  get_team_by_id_for_current_year,
  (playerMap, team) => ({ playerMap, team })
)

export default connect(mapStateToProps)(DraftPick)
