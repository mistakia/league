import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants, getDraftWindow } from '@common'
import {
  draftActions,
  getSelectedDraftPlayer,
  getDraft,
  getPicks,
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
    const playerMap = this.props.selectedPlayerMap
    const { nextPick, draftPlayer } = this.props
    this.props.showConfirmation({
      title: 'Draft Selection',
      description: `Select ${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get('pos')}) with the #${nextPick.pick} pick in the ${
        constants.season.year
      } draft.`,
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
  getPicks,
  getCurrentLeague,
  getApp,
  (players, selectedPlayerMap, nextPick, draft, picks, league, app) => {
    const windowEnd = nextPick
      ? getDraftWindow({
          start: league.draft_start,
          type: league.draft_type,
          min: league.draft_hour_min,
          max: league.draft_hour_max,
          pickNum: nextPick.pick + 1
        })
      : null

    const isWindowOpen =
      nextPick && constants.season.now.isAfter(nextPick.draftWindow)

    return {
      windowEnd,
      isDraftWindowOpen: isWindowOpen,
      players,
      nextPick,
      selectedPlayerMap,
      teamId: app.teamId,
      picks,
      drafted: draft.drafted,
      league
    }
  }
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
  selectedPlayerMap: ImmutablePropTypes.map,
  nextPick: PropTypes.object
}

export default connect(mapStateToProps, mapDispatchToProps)(DraftPage)
