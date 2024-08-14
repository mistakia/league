import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_team_by_id_for_year } from '@core/selectors'

import TeamImage from './team-image'

const mapStateToProps = createSelector(get_team_by_id_for_year, (team) => ({
  team
}))

export default connect(mapStateToProps)(TeamImage)
