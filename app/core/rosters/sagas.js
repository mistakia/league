import {
  take,
  call,
  takeLatest,
  fork,
  select,
  put,
  putResolve
} from 'redux-saga/effects'
import { Map } from 'immutable'

import { roster_actions } from './actions'
import { trade_actions } from '@core/trade'
import { notification_actions } from '@core/notifications'
import {
  api_get_rosters,
  api_put_roster,
  api_post_activate,
  api_post_deactivate,
  api_post_protect,
  api_post_rosters,
  api_delete_rosters,
  api_put_rosters,
  api_post_add_free_agent,
  api_post_reserve,
  api_post_release,
  api_post_tag,
  api_delete_tag,
  api_post_restricted_free_agency_tag,
  api_delete_restricted_free_agency_tag,
  api_put_restricted_free_agency_tag,
  api_post_restricted_free_agent_nomination,
  api_delete_restricted_free_agent_nomination
} from '@core/api'
import { app_actions } from '@core/app'
import {
  get_app,
  get_players_state,
  get_player_maps,
  get_current_trade_players,
  get_proposing_team_traded_roster_players,
  get_accepting_team_traded_roster_players,
  getActivePlayersByRosterForCurrentLeague,
  get_rosters_for_current_league,
  get_current_team_roster_record,
  get_current_players_for_league,
  getPoachPlayersForCurrentTeam,
  get_waiver_players_for_current_team,
  get_current_league,
  get_team_by_id_for_current_year
} from '@core/selectors'
import { constants } from '@libs-shared'
import { player_actions } from '@core/players'
import { poach_actions } from '@core/poaches'
import { waiver_actions } from '@core/waivers'
import { csv } from '@core/export'
import { team_actions } from '@core/teams'

export function* initRosters() {
  const { leagueId } = yield select(get_app)
  if (leagueId) yield call(api_get_rosters, { leagueId })
}

export function* load_rosters({ payload }) {
  const { leagueId } = payload
  const state = yield select()
  const isLoading = state.getIn(['app', 'is_loading_rosters'])
  const isLoaded = state.getIn(['app', 'is_loaded_rosters'])

  if (!leagueId) return

  if (isLoading === leagueId || isLoaded === leagueId) {
    return
  }

  yield call(api_get_rosters, { leagueId })
}

export function* load_rosters_ignore_cache() {
  const { leagueId } = yield select(get_app)
  yield call(api_get_rosters, { leagueId })
}

export function* load_rosters_for_year({ payload }) {
  const { year } = payload
  const { leagueId } = yield select(get_app)
  yield call(api_get_rosters, { leagueId, year })
}

export function* updateRosterPlayerSlot({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_put_roster, { teamId, leagueId, ...payload })
}

export function* activate({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_post_activate, { teamId, leagueId, ...payload })
}

export function* deactivate({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_post_deactivate, { teamId, leagueId, ...payload })
}

export function* protect({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_post_protect, { teamId, leagueId, ...payload })
}

export function* setWaiverPlayerLineupContribution({ payload }) {
  yield call(setPlayerLineupContribution, { pid: payload.data.pid })
}

export function* setPoachPlayerLineupContribution({ payload }) {
  yield call(setPlayerLineupContribution, { pid: payload.data.pid })
}

export function* setSelectedPlayerLineupContribution({ payload }) {
  yield call(setPlayerLineupContribution, { pid: payload.pid })
}

export function* setPlayerLineupContribution({ pid }) {
  const currentRoster = yield select(get_current_team_roster_record)
  const week = Math.max(constants.week, 1)
  if (!currentRoster.getIn(['lineups', `${week}`])) {
    yield take(roster_actions.SET_LINEUPS)
  }
  const projectedContribution = {}
  const playerMap = (yield select(get_player_maps)).get(pid)
  const result = yield call(calculatePlayerLineupContribution, { playerMap })
  projectedContribution[pid] = result
  yield put(player_actions.set_projected_contribution(projectedContribution))
}

export function* calculatePlayerLineupContribution({ playerMap }) {
  const currentRosterPlayers = yield select(get_current_players_for_league)
  const league = yield select(get_current_league)
  const baselines = (yield select(get_players_state)).get('baselines')
  const playerItems = yield select(get_player_maps)
  const currentRoster = yield select(get_current_team_roster_record)

  const playerData = {
    starts: 0,
    sp: 0,
    bp: 0,
    weeks: {}
  }

  // run lineup optimizer without player
  const pid = playerMap.get('pid')
  const isActive = currentRosterPlayers.active.find(
    (pMap) => pMap.get('pid') === pid
  )
  const playerPool = isActive
    ? currentRosterPlayers.active.filter((pMap) => pMap.get('pid') !== pid)
    : currentRosterPlayers.active.push(playerMap)

  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
  const worker = new Worker()
  const result = yield call(worker.workerOptimizeLineup, {
    players: playerPool.toJS(),
    league
  })
  worker.terminate()

  for (const week in result) {
    const weekData = {
      start: 0,
      sp: 0,
      bp: 0
    }

    const projectedPoints = playerMap.getIn(['points', week, 'total'])
    if (!projectedPoints) {
      playerData.weeks[week] = weekData
      continue
    }

    const starter_pids = currentRoster.getIn(
      ['lineups', week, 'starter_pids'],
      []
    )

    const isStarter = isActive
      ? starter_pids.includes(pid)
      : result[week].starter_pids.includes(pid)

    if (isStarter) {
      playerData.starts += 1
      weekData.start = 1
      // starter+ is difference between current lineup and lineup without player
      const current_projected_total = currentRoster.getIn(
        ['lineups', week, 'total'],
        0
      )
      const diff = isActive
        ? current_projected_total - result[week].total
        : result[week].total - current_projected_total
      playerData.sp += diff
      weekData.sp = diff
    } else {
      const baselinePlayerId = baselines.getIn([
        week,
        playerMap.get('pos'),
        'available'
      ])
      const baselinePlayer = playerItems.get(baselinePlayerId, new Map())
      // bench+ is difference between player output and best available
      const diff =
        projectedPoints - baselinePlayer.getIn(['points', week, 'total'])
      if (diff > 0) {
        playerData.bp += diff
        weekData.bp = diff
      }
    }
    playerData.weeks[week] = weekData
  }

  return playerData
}

export function* projectContributions() {
  const currentRosterPlayers = yield select(get_current_players_for_league)

  const projectedContribution = {}
  for (const playerMap of currentRosterPlayers.players) {
    const playerData = yield call(calculatePlayerLineupContribution, {
      playerMap
    })
    projectedContribution[playerMap.get('pid')] = playerData
  }

  yield put(player_actions.set_projected_contribution(projectedContribution))

  const claimContribution = {}
  const poaches = yield select(getPoachPlayersForCurrentTeam)
  for (const { playerMap } of poaches.values()) {
    const playerData = yield call(calculatePlayerLineupContribution, {
      playerMap
    })
    claimContribution[playerMap.get('pid')] = playerData
  }

  const claims = yield select(get_waiver_players_for_current_team)
  const claimTypes = ['active', 'poach', 'practice']
  for (const type of claimTypes) {
    for (const { playerMap } of claims[type].values()) {
      const playerData = yield call(calculatePlayerLineupContribution, {
        playerMap
      })
      claimContribution[playerMap.get('pid')] = playerData
    }
  }

  yield put(player_actions.set_projected_contribution(claimContribution))
}

export function* project_lineups() {
  yield put(
    notification_actions.show({
      message: 'Projecting Lineups'
    })
  )

  const league = yield select(get_current_league)
  const rosters = yield select(getActivePlayersByRosterForCurrentLeague)
  const lineups = {}

  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
  const worker = new Worker()
  for (const [teamId, players] of rosters.entrySeq()) {
    lineups[teamId] = {}
    lineups[teamId] = yield call(worker.workerOptimizeLineup, {
      players: players.toJS(),
      league,
      use_baseline_when_missing: true
    })
  }
  worker.terminate()

  yield putResolve(roster_actions.set_lineup_projections(lineups))
  yield call(projectContributions)
}

export function* projectTrade() {
  // TODO - make sure player values and projections have been calculated
  const league = yield select(get_current_league)
  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
  const worker = new Worker()
  const proposingTeamTradedPlayers = yield select(
    get_proposing_team_traded_roster_players
  )
  const proposingTeamLineups = yield call(worker.workerOptimizeLineup, {
    players: proposingTeamTradedPlayers.map((p) => p.toJS()),
    league,
    use_baseline_when_missing: true
  })

  const acceptingTeamTradedPlayers = yield select(
    get_accepting_team_traded_roster_players
  )
  const acceptingTeamLineups = yield call(worker.workerOptimizeLineup, {
    players: acceptingTeamTradedPlayers.map((p) => p.toJS()),
    league,
    use_baseline_when_missing: true
  })
  worker.terminate()
  yield put(
    trade_actions.set_projected_lineups({
      proposingTeamLineups,
      acceptingTeamLineups
    })
  )

  const projectedContribution = {}
  const tradePlayers = yield select(get_current_trade_players)
  const playerMaps = tradePlayers.acceptingTeamPlayers
    .concat(tradePlayers.proposingTeamPlayers)
    .concat(tradePlayers.acceptingTeamReleasePlayers)
    .concat(tradePlayers.proposingTeamReleasePlayers)
  for (const playerMap of playerMaps) {
    const playerData = yield call(calculatePlayerLineupContribution, {
      playerMap
    })
    projectedContribution[playerMap.get('pid')] = playerData
  }
  yield put(player_actions.set_projected_contribution(projectedContribution))
}

export function* add_tag({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_post_tag, { teamId, leagueId, ...payload })
}

export function* removeTag({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_delete_tag, { teamId, leagueId, ...payload })
}

export function* addPlayer({ payload }) {
  const { leagueId } = yield select(get_app)
  yield call(api_post_rosters, { leagueId, ...payload })
}

export function* removePlayer({ payload }) {
  const { leagueId } = yield select(get_app)
  yield call(api_delete_rosters, { leagueId, ...payload })
}

export function* updatePlayer({ payload }) {
  const { leagueId } = yield select(get_app)
  yield call(api_put_rosters, { leagueId, ...payload })
}

export function* add_free_agent({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_post_add_free_agent, { leagueId, teamId, ...payload })
}

export function* reserve({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_post_reserve, { leagueId, teamId, ...payload })
}

export function* release({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_post_release, { leagueId, teamId, ...payload })
}

export function* releaseNotification() {
  yield put(
    notification_actions.show({
      message: 'Player released',
      severity: 'success'
    })
  )
}

export function* protectNotification() {
  yield put(
    notification_actions.show({
      message: 'Player designated',
      severity: 'success'
    })
  )
}

export function* tagNotification() {
  yield put(
    notification_actions.show({
      message: 'Player tagged',
      severity: 'success'
    })
  )
}

export function* restrictedFreeAgencyPlacedNotification() {
  yield put(
    notification_actions.show({
      message: 'Restricted Free Agency Tag Placed',
      severity: 'success'
    })
  )
}

export function* restrictedFreeAgencyRemovedNotification() {
  yield put(
    notification_actions.show({
      message: 'Restricted Free Agency Bid Cancelled',
      severity: 'success'
    })
  )
}

export function* post_restricted_free_agent_nomination_notification() {
  yield put(
    notification_actions.show({
      message: 'Restricted Free Agent Nomination Designated',
      severity: 'success'
    })
  )
}

export function* delete_restricted_free_agent_nomination_notification() {
  yield put(
    notification_actions.show({
      message: 'Restricted Free Agent Nomination Cancelled',
      severity: 'success'
    })
  )
}

export function* add_restricted_free_agency_tag({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_post_restricted_free_agency_tag, {
    leagueId,
    teamId,
    ...payload
  })
}

export function* remove_restricted_free_agency_tag({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_delete_restricted_free_agency_tag, {
    leagueId,
    teamId,
    ...payload
  })
}

export function* update_restricted_free_agency_tag({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(api_put_restricted_free_agency_tag, {
    leagueId,
    teamId,
    ...payload
  })
}

export function* export_rosters() {
  const league = yield select(get_current_league)
  const rosters = yield select(get_rosters_for_current_league)
  const playerMaps = yield select(get_player_maps)
  const projectionType = constants.isRegularSeason ? 'ros' : '0'

  const data = []
  for (const [tid, roster] of rosters.entrySeq()) {
    const team = yield select(get_team_by_id_for_current_year, { tid })
    for (const rosterPlayer of roster.players) {
      const playerMap = playerMaps.get(rosterPlayer.pid)
      data.push({
        tid,
        team: team.name,
        salary: rosterPlayer.value,
        market_salary: (
          playerMap.getIn(['market_salary', projectionType]) || 0
        ).toFixed(0),
        player: playerMap.get('pname'),
        playerid: playerMap.get('pid'),
        pos: playerMap.get('pos'),
        last_transaction_timestamp: rosterPlayer.timestamp,
        last_transaction_type: constants.transactionsDetail[rosterPlayer.type],
        slot: constants.slotName[rosterPlayer.slot],
        draft_year: playerMap.get('nfl_draft_year'),
        player_team: playerMap.get('team')
      })
    }
  }

  csv({
    headers: {
      tid: 'Team Id',
      team: 'Team Name',
      salary: 'Salary',
      market_salary: 'Market Salary',
      player: 'Player Name',
      playerid: 'Player Id',
      pos: 'Position',
      last_transaction_timestamp: 'Last Transaction Timestamp',
      last_transaction_type: 'Last Transaction',
      slot: 'Roster Slot',
      draft_year: 'Player Draft Year',
      player_team: 'NFL Team'
    },
    data,
    fileName: `${league.name}-LeagueRosters-${constants.year}-Week${constants.week}`
  })
}

export function* nominate_restricted_free_agent({ payload }) {
  const { pid } = payload
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_post_restricted_free_agent_nomination, {
    teamId,
    leagueId,
    pid
  })
}

export function* unnominate_restricted_free_agent({ payload }) {
  const { pid } = payload
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_delete_restricted_free_agent_nomination, {
    teamId,
    leagueId,
    pid
  })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchUpdateRosterPlayerSlot() {
  yield takeLatest(
    roster_actions.UPDATE_ROSTER_PLAYER_SLOT,
    updateRosterPlayerSlot
  )
}

export function* watchActivatePlayer() {
  yield takeLatest(roster_actions.ACTIVATE_PLAYER, activate)
}

export function* watchDeactivatePlayer() {
  yield takeLatest(roster_actions.DEACTIVATE_PLAYER, deactivate)
}

export function* watchProtectPlayer() {
  yield takeLatest(roster_actions.PROTECT_PLAYER, protect)
}

export function* watchAuthFulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, initRosters)
}

export function* watchProjectLineups() {
  yield takeLatest(roster_actions.PROJECT_LINEUPS, project_lineups)
}

export function* watchRosterTransaction() {
  yield takeLatest(roster_actions.ROSTER_TRANSACTION, project_lineups)
}

export function* watchRosterTransactions() {
  yield takeLatest(roster_actions.ROSTER_TRANSACTIONS, project_lineups)
}

export function* watchAddPlayerRoster() {
  yield takeLatest(roster_actions.ADD_PLAYER_ROSTER, addPlayer)
}

export function* watchUpdatePlayerRoster() {
  yield takeLatest(roster_actions.UPDATE_PLAYER_ROSTER, updatePlayer)
}

export function* watchRemovePlayerRoster() {
  yield takeLatest(roster_actions.REMOVE_PLAYER_ROSTER, removePlayer)
}

export function* watchAddFreeAgent() {
  yield takeLatest(roster_actions.ADD_FREE_AGENT, add_free_agent)
}

export function* watchSetRosterReserve() {
  yield takeLatest(roster_actions.SET_ROSTER_RESERVE, reserve)
}

export function* watchPlayersSelectPlayer() {
  yield takeLatest(
    player_actions.PLAYERS_SELECT_PLAYER,
    setSelectedPlayerLineupContribution
  )
}

export function* watchPostWaiverFulfilled() {
  yield takeLatest(
    waiver_actions.POST_WAIVER_FULFILLED,
    setWaiverPlayerLineupContribution
  )
}

export function* watchPostPoachFulfilled() {
  yield takeLatest(
    poach_actions.POST_POACH_FULFILLED,
    setPoachPlayerLineupContribution
  )
}

export function* watchReleasePlayer() {
  yield takeLatest(roster_actions.RELEASE_PLAYER, release)
}

export function* watchPostReleaseFulfilled() {
  yield takeLatest(roster_actions.POST_RELEASE_FULFILLED, releaseNotification)
}

export function* watchPostProtectFulfilled() {
  yield takeLatest(roster_actions.POST_PROTECT_FULFILLED, protectNotification)
}

export function* watchPostTagFulfilled() {
  yield takeLatest(roster_actions.POST_TAG_FULFILLED, tagNotification)
}

export function* watchTradeSetProposingTeamPlayers() {
  yield takeLatest(trade_actions.TRADE_SET_PROPOSING_TEAM_PLAYERS, projectTrade)
}

export function* watchTradeSetAcceptingTeamPlayers() {
  yield takeLatest(trade_actions.TRADE_SET_ACCEPTING_TEAM_PLAYERS, projectTrade)
}

export function* watchTradeSelectTeam() {
  yield takeLatest(trade_actions.TRADE_SELECT_TEAM, projectTrade)
}

export function* watchSelectTrade() {
  yield takeLatest(trade_actions.SELECT_TRADE, projectTrade)
}

export function* watchAddTag() {
  yield takeLatest(roster_actions.ADD_TAG, add_tag)
}

export function* watchRemoveTag() {
  yield takeLatest(roster_actions.REMOVE_TAG, removeTag)
}

export function* watchAddRestrictedFreeAgencyTag() {
  yield takeLatest(
    roster_actions.ADD_RESTRICTED_FREE_AGENCY_TAG,
    add_restricted_free_agency_tag
  )
}

export function* watchRemoveRestrictedFreeAgencyTag() {
  yield takeLatest(
    roster_actions.REMOVE_RESTRICTED_FREE_AGENCY_TAG,
    remove_restricted_free_agency_tag
  )
}

export function* watchPostRestrictedFreeAgencyTagFulfilled() {
  yield takeLatest(
    roster_actions.POST_RESTRICTED_FREE_AGENCY_TAG_FULFILLED,
    restrictedFreeAgencyPlacedNotification
  )
}

export function* watchDeleteRestrictedFreeAgencyTagFulfilled() {
  yield takeLatest(
    roster_actions.DELETE_RESTRICTED_FREE_AGENCY_TAG_FULFILLED,
    restrictedFreeAgencyRemovedNotification
  )
}

export function* watchUpdateRestrictedFreeAgencyTag() {
  yield takeLatest(
    roster_actions.UPDATE_RESTRICTED_FREE_AGENCY_TAG,
    update_restricted_free_agency_tag
  )
}

export function* watchPutRestrictedFreeAgencyTagFulfilled() {
  yield takeLatest(
    roster_actions.PUT_RESTRICTED_FREE_AGENCY_TAG_FULFILLED,
    restrictedFreeAgencyPlacedNotification
  )
}

export function* watchExportRosters() {
  yield takeLatest(roster_actions.EXPORT_ROSTERS, export_rosters)
}

export function* watchLoadRosters() {
  yield takeLatest(roster_actions.LOAD_ROSTERS, load_rosters)
}

export function* watchLoadTeams() {
  yield takeLatest(team_actions.LOAD_TEAMS, load_rosters)
}

export function* watchSelectYear() {
  yield takeLatest(app_actions.SELECT_YEAR, load_rosters_for_year)
}

export function* watch_load_rosters_for_year() {
  yield takeLatest(roster_actions.LOAD_ROSTERS_FOR_YEAR, load_rosters_for_year)
}

export function* watchPostProcessPoachFulfilled() {
  yield takeLatest(
    poach_actions.POST_PROCESS_POACH_FULFILLED,
    load_rosters_ignore_cache
  )
}

export function* watch_nominate_restricted_free_agent() {
  yield takeLatest(
    roster_actions.NOMINATE_RESTRICTED_FREE_AGENT,
    nominate_restricted_free_agent
  )
}

export function* watch_unnominate_restricted_free_agent() {
  yield takeLatest(
    roster_actions.UNNOMINATE_RESTRICTED_FREE_AGENT,
    unnominate_restricted_free_agent
  )
}

export function* watch_post_restricted_free_agent_nomination_fulfilled() {
  yield takeLatest(
    roster_actions.POST_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED,
    post_restricted_free_agent_nomination_notification
  )
}

export function* watch_delete_restricted_free_agent_nomination_fulfilled() {
  yield takeLatest(
    roster_actions.DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED,
    delete_restricted_free_agent_nomination_notification
  )
}
//= ====================================
//  ROOT
// -------------------------------------

export const roster_sagas = [
  fork(watchUpdateRosterPlayerSlot),
  fork(watchActivatePlayer),
  fork(watchDeactivatePlayer),
  fork(watchProtectPlayer),
  fork(watchAuthFulfilled),
  fork(watchPostWaiverFulfilled),
  fork(watchPostPoachFulfilled),
  fork(watchPlayersSelectPlayer),

  fork(watchProjectLineups),
  fork(watchRosterTransaction),
  fork(watchRosterTransactions),
  fork(watchSetRosterReserve),

  fork(watchAddFreeAgent),
  fork(watchReleasePlayer),

  fork(watchAddTag),
  fork(watchRemoveTag),

  fork(watchPostReleaseFulfilled),
  fork(watchPostProtectFulfilled),
  fork(watchPostTagFulfilled),

  fork(watchAddPlayerRoster),
  fork(watchRemovePlayerRoster),
  fork(watchUpdatePlayerRoster),

  fork(watchTradeSetProposingTeamPlayers),
  fork(watchTradeSetAcceptingTeamPlayers),
  fork(watchTradeSelectTeam),
  fork(watchSelectTrade),

  fork(watchAddRestrictedFreeAgencyTag),
  fork(watchRemoveRestrictedFreeAgencyTag),
  fork(watchUpdateRestrictedFreeAgencyTag),

  fork(watchPostRestrictedFreeAgencyTagFulfilled),
  fork(watchPutRestrictedFreeAgencyTagFulfilled),
  fork(watchDeleteRestrictedFreeAgencyTagFulfilled),

  fork(watchExportRosters),

  fork(watchLoadRosters),
  fork(watchLoadTeams),

  fork(watchSelectYear),

  fork(watchPostProcessPoachFulfilled),

  fork(watch_nominate_restricted_free_agent),
  fork(watch_unnominate_restricted_free_agent),

  fork(watch_post_restricted_free_agent_nomination_fulfilled),
  fork(watch_delete_restricted_free_agent_nomination_fulfilled),

  fork(watch_load_rosters_for_year)
]
