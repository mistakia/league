import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { draftActions, getDraftPicks } from '@core/draft'
import { teamActions } from '@core/teams'
import { getRookiePlayers } from '@core/players'

import render from './draft'

class DraftPage extends React.Component {
  componentDidMount () {
    this.props.loadDraft()
    this.props.loadTeams()
  }

  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getRookiePlayers,
  getDraftPicks,
  (players, picks) => ({ players, picks })
)

const mapDispatchToProps = {
  loadDraft: draftActions.loadDraft,
  loadTeams: teamActions.loadTeams
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DraftPage)
