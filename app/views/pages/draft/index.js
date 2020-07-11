import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { draftActions, getSelectedDraftPlayer, getDraft, getNextPick } from '@core/draft'
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
  getNextPick,
  getDraft,
  getCurrentLeague,
  getApp,
  (players, selectedPlayer, nextPick, draft, league, app) => ({
    players,
    nextPick,
    selectedPlayer,
    vbaseline: app.vbaseline,
    picks: draft.picks,
    drafted: draft.drafted,
    league
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
