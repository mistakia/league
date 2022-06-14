import React from 'react'
import PropTypes from 'prop-types'
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
  constructor(props) {
    super(props)

    this.state = {
      receivePlayers: []
    }
  }

  handleReleaseChange = (event, value) => {
    const playerIds = value.map((p) => p.id)
    this.props.setReleasePlayers(playerIds)
  }

  handleProposeChange = (event, value) => {
    const players = value.filter((p) => p.type === 'player')
    const picks = value.filter((p) => p.type === 'pick')
    const playerIds = players.map((p) => p.id)
    const pickIds = picks.map((p) => p.id)
    this.props.setProposingTeamPlayers(playerIds)
    this.props.setProposingTeamPicks(pickIds)
  }

  handleAcceptChange = (event, value) => {
    const players = value.filter((p) => p.type === 'player')
    const picks = value.filter((p) => p.type === 'pick')
    const playerIds = players.map((p) => p.id)
    const pickIds = picks.map((p) => p.id)
    this.props.setAcceptingTeamPlayers(playerIds)
    this.props.setAcceptingTeamPicks(pickIds)
  }

  componentDidMount = () => {
    this.props.load()
  }

  handleReleasePlayerClick = (pid) => this.props.setReleasePlayers(pid)

  handleProposingTeamPlayerClick = (pid) =>
    this.props.setProposingTeamPlayers(pid)

  handleAcceptingTeamPlayerClick = (pid) =>
    this.props.setAcceptingTeamPlayers(pid)

  handleProposingTeamPickClick = (pick) =>
    this.props.setProposingTeamPicks(pick)

  handleAcceptingTeamPickClick = (pick) =>
    this.props.setAcceptingTeamPicks(pick)

  render = () => {
    return render.call(this)
  }
}

TradePage.propTypes = {
  setReleasePlayers: PropTypes.func,
  setProposingTeamPlayers: PropTypes.func,
  setProposingTeamPicks: PropTypes.func,
  setAcceptingTeamPlayers: PropTypes.func,
  setAcceptingTeamPicks: PropTypes.func,
  load: PropTypes.func
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
    isProposer: trade.propose_tid === app.teamId,
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
  setReleasePlayers: tradeActions.setReleasePlayers,
  setProposingTeamPlayers: tradeActions.setProposingTeamPlayers,
  setAcceptingTeamPlayers: tradeActions.setAcceptingTeamPlayers,
  setProposingTeamPicks: tradeActions.setProposingTeamPicks,
  setAcceptingTeamPicks: tradeActions.setAcceptingTeamPicks
}

export default connect(mapStateToProps, mapDispatchToProps)(TradePage)
