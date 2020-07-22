import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions, getCurrentTeamRoster } from '@core/rosters'
import { getApp } from '@core/app'
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
  handleSendPlayerClick = (player) => this.props.toggleSendPlayer(player)
  handleReceivePlayerClick = (player) => this.props.toggleReceivePlayer(player)
  handleSendPickClick = (pick) => this.props.toggleSendPick(pick)
  handleReceivePickClick = (pick) => this.props.toggleReceivePick(pick)
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
  (tradeState, app, trade, sendRoster, sendTeam, receiveRoster, receiveTeam, valid) => ({
    valid,
    isProposer: trade.pid === app.teamId,
    trade,
    dropPlayers: tradeState.dropPlayers,
    sendRoster,
    receiveRoster,
    sendTeam,
    receiveTeam
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
  toggleSendPlayer: tradeActions.toggleSendPlayer,
  toggleReceivePlayer: tradeActions.toggleReceivePlayer,
  toggleSendPick: tradeActions.toggleSendPick,
  toggleReceivePick: tradeActions.toggleReceivePick
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TradePage)
