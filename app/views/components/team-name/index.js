import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById } from '@core/selectors'

import TeamName from './team-name'

const mapStateToProps = createSelector(getTeamById, (team) => ({ team }))

export default connect(mapStateToProps)(TeamName)
