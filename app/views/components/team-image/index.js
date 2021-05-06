import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById } from '@core/teams'

import TeamImage from './team-image'

const mapStateToProps = createSelector(getTeamById, (team) => ({ team }))

export default connect(mapStateToProps)(TeamImage)
