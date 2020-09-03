import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentTeamRosterRecord } from '@core/rosters'
import render from './lineups'

class LineupsPage extends React.Component {
  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getCurrentTeamRosterRecord,
  (roster) => ({ roster })
)

export default connect(
  mapStateToProps
)(LineupsPage)
