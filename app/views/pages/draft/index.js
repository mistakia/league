import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { draftActions, getSelectedDraftPlayer, getDraftPicks, getCurrentPick } from '@core/draft'
import { getCurrentLeague } from '@core/leagues'
import { teamActions } from '@core/teams'
import { getRookiePlayers } from '@core/players'
import { getApp } from '@core/app'

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
  getSelectedDraftPlayer,
  getCurrentPick,
  getDraftPicks,
  getCurrentLeague,
  getApp,
  (players, selectedPlayer, currentPick, picks, league, app) => ({
    players,
    selectedPlayer,
    currentPick,
    picks,
    league,
    isDrafting: currentPick.tid === app.teamId
  })
)

const mapDispatchToProps = {
  loadDraft: draftActions.loadDraft,
  loadTeams: teamActions.loadTeams
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DraftPage)
