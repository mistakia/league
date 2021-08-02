import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants } from '@common'
import {
  draftActions,
  getSelectedDraftPlayer,
  getDraft,
  getNextPick
} from '@core/draft'
import { getCurrentLeague } from '@core/leagues'
import { getRookiePlayers } from '@core/players'
import { getApp } from '@core/app'
import { confirmationActions } from '@core/confirmations'

import render from './draft'

class DraftPage extends React.Component {
  componentDidMount() {
    this.props.loadDraft()
  }

  handleDraft = () => {
    const player = this.props.selectedPlayer
    const { nextPick, draftPlayer } = this.props
    this.props.showConfirmation({
      title: 'Draft Selection',
      description: `Select ${player.fname} ${player.lname} (${player.pos}) with the #${nextPick.pick} pick in the ${constants.season.year} draft.`,
      onConfirm: draftPlayer
    })
  }

  render() {
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
  draftPlayer: draftActions.draftPlayer,
  showConfirmation: confirmationActions.show
}

DraftPage.propTypes = {
  loadDraft: PropTypes.func,
  draftPlayer: PropTypes.func,
  showConfirmation: PropTypes.func,
  selectedPlayer: ImmutablePropTypes.record,
  nextPick: PropTypes.object
}

export default connect(mapStateToProps, mapDispatchToProps)(DraftPage)
