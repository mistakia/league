import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_current_team_roster_record } from '@core/selectors'
import render from './lineups'

class LineupsPage extends React.Component {
  render() {
    return render.call(this)
  }
}

const map_state_to_props = createSelector(
  get_current_team_roster_record,
  (roster) => ({ roster })
)

export default connect(map_state_to_props)(LineupsPage)
