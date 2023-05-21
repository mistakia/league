import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants, getDraftWindow } from '@common'
import { draftActions } from '@core/draft'
import {
  get_app,
  getCurrentLeague,
  getSelectedDraftPlayer,
  getDraft,
  getPicks,
  getNextPick,
  getRookiePlayers
} from '@core/selectors'
import { playerActions } from '@core/players'
import { confirmationActions } from '@core/confirmations'

import render from './draft'

class DraftPage extends React.Component {
  componentDidUpdate() {
    const element = document.querySelector(
      '.draft__side-main .draft__pick.active'
    )
    if (element)
      element.scrollIntoView({ behavior: 'smooth', inline: 'center' })
  }

  componentDidMount() {
    this.props.loadDraft()
    this.props.loadAllPlayers()
  }

  handleDraft = () => {
    const playerMap = this.props.selectedPlayerMap
    const { nextPick, draftPlayer } = this.props
    this.props.showConfirmation({
      title: 'Draft Selection',
      description: `Select ${playerMap.get('fname')} ${playerMap.get(
        'lname'
      )} (${playerMap.get('pos')}) with the #${nextPick.pick} pick in the ${
        constants.year
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
  get_app,
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
  showConfirmation: confirmationActions.show,
  loadAllPlayers: playerActions.loadAllPlayers
}

DraftPage.propTypes = {
  loadDraft: PropTypes.func,
  draftPlayer: PropTypes.func,
  showConfirmation: PropTypes.func,
  selectedPlayerMap: ImmutablePropTypes.map,
  nextPick: PropTypes.object,
  loadAllPlayers: PropTypes.func
}

export default connect(mapStateToProps, mapDispatchToProps)(DraftPage)
