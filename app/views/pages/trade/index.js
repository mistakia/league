import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import {
  tradeActions,
  getCurrentTrade,
  getCurrentTradePlayers,
  getTradeIsValid,
  getCurrentTradeAnalysis,
  getProposingTeamPlayers,
  getAcceptingTeamPlayers,
  getAcceptingTeam,
  getProposingTeam,
  getProposingTeamRoster
} from '@core/trade'

import render from './trade'

class TradePage extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      receivePlayers: []
    }
  }

  handleDropChange = (event, value) => {
    const playerIds = value.map(p => p.id)
    this.props.setDropPlayers(playerIds)
  }

  handleProposeChange = (event, value) => {
    const players = value.filter(p => p.type === 'player')
    const picks = value.filter(p => p.type === 'pick')
    const playerIds = players.map(p => p.id)
    const pickIds = picks.map(p => p.id)
    this.props.setProposingTeamPlayers(playerIds)
    this.props.setProposingTeamPicks(pickIds)
  }

  handleAcceptChange = (event, value) => {
    const players = value.filter(p => p.type === 'player')
    const picks = value.filter(p => p.type === 'pick')
    const playerIds = players.map(p => p.id)
    const pickIds = picks.map(p => p.id)
    this.props.setAcceptingTeamPlayers(playerIds)
    this.props.setAcceptingTeamPicks(pickIds)
  }

  componentDidMount = () => {
    this.props.load()
  }

  handleDropPlayerClick = (player) => this.props.setDropPlayers(player)
  handleProposingTeamPlayerClick = (player) => this.props.setProposingTeamPlayers(player)
  handleAcceptingTeamPlayerClick = (player) => this.props.setAcceptingTeamPlayers(player)
  handleProposingTeamPickClick = (pick) => this.props.setProposingTeamPicks(pick)
  handleAcceptingTeamPickClick = (pick) => this.props.setAcceptingTeamPicks(pick)

  render = () => {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getApp,

  getCurrentTrade,
  getCurrentTradePlayers,
  getTradeIsValid,

  getProposingTeam,
  getProposingTeamPlayers,
  getProposingTeamRoster,

  getAcceptingTeam,
  getAcceptingTeamPlayers,

  getCurrentTradeAnalysis,
  (
    app,

    trade,
    tradePlayers,
    isValid,

    proposingTeam,
    proposingTeamPlayers,
    proposingTeamRoster,

    acceptingTeam,
    acceptingTeamPlayers,

    analysis
  ) => ({
    isValid,
    isProposer: trade.pid === app.teamId,
    trade,
    tradePlayers,

    proposingTeam,
    proposingTeamRoster,
    proposingTeamPlayers,

    acceptingTeam,
    acceptingTeamPlayers,

    analysis
  })
)

const mapDispatchToProps = {
  load: tradeActions.load,
  setDropPlayers: tradeActions.setDropPlayers,
  setProposingTeamPlayers: tradeActions.setProposingTeamPlayers,
  setAcceptingTeamPlayers: tradeActions.setAcceptingTeamPlayers,
  setProposingTeamPicks: tradeActions.setProposingTeamPicks,
  setAcceptingTeamPicks: tradeActions.setAcceptingTeamPicks
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TradePage)
