import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getLeagueById, leagueActions } from '@core/leagues'

import EditableLeague from './editable-league'

const mapStateToProps = createSelector(
  getLeagueById,
  getApp,
  (league, app) => ({ league, userId: app.userId })
)

const mapDispatchToProps = {
  update: leagueActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(EditableLeague)
