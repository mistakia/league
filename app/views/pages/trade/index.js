import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  get_current_trade,
  get_current_trade_players,
  get_trade_is_valid,
  get_current_trade_analysis,
  get_proposing_team_players,
  get_accepting_team_players,
  get_accepting_team,
  get_proposing_team,
  get_proposing_team_roster
} from '@core/selectors'
import { trade_actions } from '@core/trade'
import { player_actions } from '@core/players'

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
    this.props.set_release_players(playerIds)
  }

  handleProposeChange = (event, value) => {
    const players = value.filter((p) => p.type === 'player')
    const picks = value.filter((p) => p.type === 'pick')
    const playerIds = players.map((p) => p.id)
    const pickIds = picks.map((p) => p.id)
    this.props.set_proposing_team_players(playerIds)
    this.props.set_proposing_team_picks(pickIds)
  }

  handleAcceptChange = (event, value) => {
    const players = value.filter((p) => p.type === 'player')
    const picks = value.filter((p) => p.type === 'pick')
    const playerIds = players.map((p) => p.id)
    const pickIds = picks.map((p) => p.id)
    this.props.set_accepting_team_players(playerIds)
    this.props.set_accepting_team_picks(pickIds)
  }

  componentDidMount = () => {
    this.props.load()
    this.props.load_league_players()
  }

  handleReleasePlayerClick = (pid) => this.props.set_release_players(pid)

  handleProposingTeamPlayerClick = (pid) =>
    this.props.set_proposing_team_players(pid)

  handleAcceptingTeamPlayerClick = (pid) =>
    this.props.set_accepting_team_players(pid)

  handleProposingTeamPickClick = (pick) =>
    this.props.set_proposing_team_picks(pick)

  handleAcceptingTeamPickClick = (pick) =>
    this.props.set_accepting_team_picks(pick)

  render = () => {
    return render.call(this)
  }
}

TradePage.propTypes = {
  set_release_players: PropTypes.func,
  set_proposing_team_players: PropTypes.func,
  set_proposing_team_picks: PropTypes.func,
  set_accepting_team_players: PropTypes.func,
  set_accepting_team_picks: PropTypes.func,
  load: PropTypes.func,
  load_league_players: PropTypes.func
}

const map_state_to_props = createSelector(
  get_app,

  get_current_trade,
  get_current_trade_players,
  get_trade_is_valid,

  get_proposing_team,
  get_proposing_team_players,
  get_proposing_team_roster,

  get_accepting_team,
  get_accepting_team_players,

  get_current_trade_analysis,
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

const map_dispatch_to_props = {
  load: trade_actions.load,
  set_release_players: trade_actions.set_release_players,
  set_proposing_team_players: trade_actions.set_proposing_team_players,
  set_accepting_team_players: trade_actions.set_accepting_team_players,
  set_proposing_team_picks: trade_actions.set_proposing_team_picks,
  set_accepting_team_picks: trade_actions.set_accepting_team_picks,
  load_league_players: player_actions.load_league_players
}

export default connect(map_state_to_props, map_dispatch_to_props)(TradePage)
