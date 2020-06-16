import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { draftActions, getSelectedDraftPlayer, getDraft, getCurrentPick } from '@core/draft'
import { getCurrentLeague } from '@core/leagues'
import { getRookiePlayers } from '@core/players'
import { getApp } from '@core/app'

import render from './draft'

class DraftPage extends React.Component {
  componentDidMount () {
    this.props.loadDraft()
  }

  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getRookiePlayers,
  getSelectedDraftPlayer,
  getCurrentPick,
  getDraft,
  getCurrentLeague,
  getApp,
  (players, selectedPlayer, currentPick, draft, league, app) => ({
    players,
    selectedPlayer,
    currentPick,
    picks: draft.picks,
    drafted: draft.drafted,
    league,
    isDrafting: currentPick.tid === app.teamId
  })
)

const mapDispatchToProps = {
  loadDraft: draftActions.loadDraft,
  draftPlayer: draftActions.draftPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DraftPage)
