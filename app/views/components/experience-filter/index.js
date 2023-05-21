import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'

import ExperienceFilter from './experience-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  experience: players.get('experience')
}))

export default connect(mapStateToProps)(ExperienceFilter)
