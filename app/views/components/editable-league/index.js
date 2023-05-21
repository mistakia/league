import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getLeagueById } from '@core/selectors'
import { leagueActions } from '@core/leagues'

import EditableLeague from './editable-league'

const mapStateToProps = createSelector(
  getLeagueById,
  get_app,
  (league, app) => ({ league, userId: app.userId })
)

const mapDispatchToProps = {
  update: leagueActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(EditableLeague)
