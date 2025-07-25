import { connect } from 'react-redux'

import { matchups_actions } from '@core/matchups'

import GenerateSchedule from './generate-schedule'

const map_dispatch_to_props = {
  generate: matchups_actions.generate
}

export default connect(null, map_dispatch_to_props)(GenerateSchedule)
