import { call, takeLatest, fork, select } from 'redux-saga/effects'

import {
  get_app,
  get_trade,
  get_trade_selected_team_id,
  get_player_maps,
  get_proposing_team_roster,
  get_accepting_team_roster,
  get_current_league
} from '@core/selectors'
import { trade_actions } from './actions'
import {
  api_post_propose_trade,
  api_post_accept_trade,
  api_post_cancel_trade,
  api_post_reject_trade,
  api_get_trades
} from '@core/api'
import { get_default_trade_slot, constants, Roster } from '@libs-shared'

/**
 * Ensure all players have slot assignments by calculating defaults for any missing slots
 *
 * @param {Object} params
 * @param {Array} params.player_ids - Array of player IDs being traded
 * @param {Map} params.current_slots - Current slot assignments map
 * @param {Map} params.player_maps - Player data from state
 * @param {Object} params.roster_record - Roster record for the receiving team
 * @param {Object} params.league - League object
 * @returns {Object} Complete slot assignments object
 */
function ensure_complete_slot_assignments({
  player_ids,
  current_slots,
  player_maps,
  roster_record,
  league
}) {
  const complete_slots = { ...current_slots }
  const roster = new Roster({ roster: roster_record.toJS(), league })

  for (const pid of player_ids) {
    // Skip if slot already assigned
    if (complete_slots[pid] !== undefined) {
      continue
    }

    // Get player data
    const player_map = player_maps.get(pid)
    if (!player_map) {
      // Player data not loaded, default to BENCH
      complete_slots[pid] = constants.slots.BENCH
      continue
    }

    // Calculate default slot
    const player = {
      pid: player_map.get('pid'),
      pos: player_map.get('pos'),
      nfl_status: player_map.get('nfl_status'),
      injury_status: player_map.get('injury_status'),
      practice: player_map.get('practice'),
      game_day: player_map.get('game_day'),
      prior_week_inactive: player_map.get('prior_week_inactive'),
      prior_week_ruled_out: player_map.get('prior_week_ruled_out'),
      value: player_map.get('value')
    }

    const default_slot = get_default_trade_slot({
      player,
      current_slot: player_map.get('slot'),
      roster,
      week: constants.season.week,
      is_regular_season: constants.season.isRegularSeason
    })

    complete_slots[pid] = default_slot
  }

  return complete_slots
}

export function* propose() {
  const { teamId, leagueId } = yield select(get_app)
  const accept_tid = yield select(get_trade_selected_team_id)
  const trade = yield select(get_trade)
  const player_maps = yield select(get_player_maps)
  const proposing_team_roster = yield select(get_proposing_team_roster)
  const accepting_team_roster = yield select(get_accepting_team_roster)
  const league = yield select(get_current_league)

  // Ensure all players have slot assignments
  const proposing_team_slots = ensure_complete_slot_assignments({
    player_ids: trade.acceptingTeamPlayers.toJS(),
    current_slots: trade.proposingTeamSlots.toJS(),
    player_maps,
    roster_record: proposing_team_roster,
    league
  })

  const accepting_team_slots = ensure_complete_slot_assignments({
    player_ids: trade.proposingTeamPlayers.toJS(),
    current_slots: trade.acceptingTeamSlots.toJS(),
    player_maps,
    roster_record: accepting_team_roster,
    league
  })

  const params = {
    proposingTeamPlayers: trade.proposingTeamPlayers.toJS(),
    acceptingTeamPlayers: trade.acceptingTeamPlayers.toJS(),
    proposingTeamPicks: trade.proposingTeamPicks.toJS(),
    acceptingTeamPicks: trade.acceptingTeamPicks.toJS(),
    releasePlayers: trade.releasePlayers.toJS(),
    proposing_team_slots,
    accepting_team_slots,
    propose_tid: teamId,
    accept_tid,
    leagueId
  }
  yield call(api_post_propose_trade, params)
}

export function* load() {
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_get_trades, { leagueId, teamId })
}

export function* cancel() {
  const { selectedTradeId } = yield select(get_trade)
  const { leagueId } = yield select(get_app)
  yield call(api_post_cancel_trade, { leagueId, tradeId: selectedTradeId })
}

export function* reject() {
  const { selectedTradeId } = yield select(get_trade)
  const { leagueId } = yield select(get_app)
  yield call(api_post_reject_trade, { leagueId, tradeId: selectedTradeId })
}

export function* accept() {
  const { teamId, leagueId } = yield select(get_app)
  const { selectedTradeId } = yield select(get_trade)
  const trade = yield select(get_trade)
  const player_maps = yield select(get_player_maps)
  const accepting_team_roster = yield select(get_accepting_team_roster)
  const league = yield select(get_current_league)

  // Ensure all accepting team players have slot assignments
  const accepting_team_slots = ensure_complete_slot_assignments({
    player_ids: trade.proposingTeamPlayers.toJS(),
    current_slots: trade.acceptingTeamSlots.toJS(),
    player_maps,
    roster_record: accepting_team_roster,
    league
  })

  const releasePlayers = trade.releasePlayers.toJS()

  yield call(api_post_accept_trade, {
    teamId,
    leagueId,
    releasePlayers,
    accepting_team_slots,
    tradeId: selectedTradeId
  })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchProposeTrade() {
  yield takeLatest(trade_actions.PROPOSE_TRADE, propose)
}

export function* watchLoadTrades() {
  yield takeLatest(trade_actions.LOAD_TRADES, load)
}

export function* watchCancelTrade() {
  yield takeLatest(trade_actions.CANCEL_TRADE, cancel)
}

export function* watchAcceptTrade() {
  yield takeLatest(trade_actions.ACCEPT_TRADE, accept)
}

export function* watchRejectTrade() {
  yield takeLatest(trade_actions.REJECT_TRADE, reject)
}

//= ====================================
//  ROOT
// -------------------------------------

export const trade_sagas = [
  fork(watchProposeTrade),
  fork(watchLoadTrades),
  fork(watchCancelTrade),
  fork(watchAcceptTrade),
  fork(watchRejectTrade)
]
