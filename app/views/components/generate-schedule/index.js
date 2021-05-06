import { connect } from 'react-redux'

import { matchupsActions } from '@core/matchups'

import GenerateSchedule from './generate-schedule'

const mapDispatchToProps = {
  generate: matchupsActions.generate
}

export default connect(null, mapDispatchToProps)(GenerateSchedule)
