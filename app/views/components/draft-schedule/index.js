import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getPicks } from '@core/draft'

import DraftSchedule from './draft-schedule'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getPicks,
  (league, picks) => ({ league, picks })
)

export default connect(
  mapStateToProps
)(DraftSchedule)
