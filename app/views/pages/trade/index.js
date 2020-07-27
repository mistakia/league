import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions, getCurrentTeamRoster } from '@core/rosters'
import { getApp } from '@core/app'
import { getCurrentLeague } from '@core/leagues'
import {
  getTrade,
  getTradeSelectedTeamRoster,
  getTradeSelectedTeam,
  tradeActions,
  getCurrentTrade,
  getTradeIsValid
} from '@core/trade'
import { getCurrentTeam } from '@core/teams'

import render from './trade'

class TradePage extends React.Component {
  componentDidMount = () => {
    this.props.load()
    this.props.loadRosters()
  }

  handleDropPlayerClick = (player) => this.props.toggleDropPlayer(player)
  handleProposingTeamPlayerClick = (player) => this.props.toggleProposingTeamPlayer(player)
  handleAcceptingTeamPlayerClick = (player) => this.props.toggleAcceptingTeamPlayer(player)
  handleProposingTeamPickClick = (pick) => this.props.toggleProposingTeamPick(pick)
  handleAcceptingTeamPickClick = (pick) => this.props.toggleAcceptingTeamPick(pick)
  handleProposeClick = () => this.props.propose()
  handleAcceptClick = () => this.props.accept()
  handleRejectClick = () => this.props.reject()
  handleCancelClick = () => this.props.cancel()

  render = () => {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getTrade,
  getApp,
  getCurrentTrade,
  getCurrentTeamRoster,
  getCurrentTeam,
  getTradeSelectedTeamRoster,
  getTradeSelectedTeam,
  getTradeIsValid,
  getCurrentLeague,
  (tradeState, app, trade, proposingTeamRoster, proposingTeam, acceptingTeamRoster, acceptingTeam, valid, league) => ({
    valid,
    isProposer: trade.pid === app.teamId,
    trade,
    dropPlayers: tradeState.dropPlayers,
    proposingTeamRoster,
    acceptingTeamRoster,
    proposingTeam,
    acceptingTeam,
    league
  })
)

const mapDispatchToProps = {
  propose: tradeActions.propose,
  loadRosters: rosterActions.loadRosters,
  load: tradeActions.load,
  accept: tradeActions.accept,
  reject: tradeActions.reject,
  cancel: tradeActions.cancel,
  toggleDropPlayer: tradeActions.toggleDropPlayer,
  toggleProposingTeamPlayer: tradeActions.toggleProposingTeamPlayer,
  toggleAcceptingTeamPlayer: tradeActions.toggleAcceptingTeamPlayer,
  toggleProposingTeamPick: tradeActions.toggleProposingTeamPick,
  toggleAcceptingTeamPick: tradeActions.toggleAcceptingTeamPick
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TradePage)
