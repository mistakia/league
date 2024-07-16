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

import { rosterActions } from './actions'
import { tradeActions } from '@core/trade'
import { notificationActions } from '@core/notifications'
import {
  getRosters,
  putRoster,
  postActivate,
  postDeactivate,
  postProtect,
  postRosters,
  deleteRosters,
  putRosters,
  postAddFreeAgent,
  postReserve,
  postRelease,
  postTag,
  deleteTag,
  postTransitionTag,
  deleteTransitionTag,
  putTransitionTag,
  post_restricted_free_agent_nomination,
  delete_restricted_free_agent_nomination
} from '@core/api'
import { appActions } from '@core/app'
import {
  get_app,
  getPlayers,
  get_player_maps,
  getCurrentTradePlayers,
  getProposingTeamTradedRosterPlayers,
  getAcceptingTeamTradedRosterPlayers,
  getActivePlayersByRosterForCurrentLeague,
  getRostersForCurrentLeague,
  getCurrentTeamRosterRecord,
  getCurrentPlayers,
  getPoachPlayersForCurrentTeam,
  getWaiverPlayersForCurrentTeam,
  getCurrentLeague,
  getTeamById
} from '@core/selectors'
import { constants } from '@libs-shared'
import { playerActions } from '@core/players'
import { poachActions } from '@core/poaches'
import { waiverActions } from '@core/waivers'
import { csv } from '@core/export'
import { teamActions } from '@core/teams'

export function* initRosters() {
  const { leagueId } = yield select(get_app)
  if (leagueId) yield call(getRosters, { leagueId })
}

export function* loadRosters({ payload }) {
  const { leagueId } = payload
  const state = yield select()
  const isLoading = state.getIn(['app', 'isLoadingRosters'])
  const isLoaded = state.getIn(['app', 'isLoadedRosters'])

  if (!leagueId) return

  if (isLoading === leagueId || isLoaded === leagueId) {
    return
  }

  yield call(getRosters, { leagueId })
}

export function* load_rosters_ignore_cache() {
  const { leagueId } = yield select(get_app)
  yield call(getRosters, { leagueId })
}

export function* load_rosters_for_year() {
  const { leagueId, year } = yield select(get_app)
  yield call(getRosters, { leagueId, year })
}

export function* updateRosterPlayerSlot({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(putRoster, { teamId, leagueId, ...payload })
}

export function* activate({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(postActivate, { teamId, leagueId, ...payload })
}

export function* deactivate({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(postDeactivate, { teamId, leagueId, ...payload })
}

export function* protect({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(postProtect, { teamId, leagueId, ...payload })
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
  const currentRoster = yield select(getCurrentTeamRosterRecord)
  const week = Math.max(constants.week, 1)
  if (!currentRoster.getIn(['lineups', `${week}`])) {
    yield take(rosterActions.SET_LINEUPS)
  }
  const projectedContribution = {}
  const playerMap = (yield select(get_player_maps)).get(pid)
  const result = yield call(calculatePlayerLineupContribution, { playerMap })
  projectedContribution[pid] = result
  yield put(playerActions.setProjectedContribution(projectedContribution))
}

export function* calculatePlayerLineupContribution({ playerMap }) {
  const currentRosterPlayers = yield select(getCurrentPlayers)
  const league = yield select(getCurrentLeague)
  const baselines = (yield select(getPlayers)).get('baselines')
  const playerItems = yield select(get_player_maps)
  const currentRoster = yield select(getCurrentTeamRosterRecord)

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
  const currentRosterPlayers = yield select(getCurrentPlayers)

  const projectedContribution = {}
  for (const playerMap of currentRosterPlayers.players) {
    const playerData = yield call(calculatePlayerLineupContribution, {
      playerMap
    })
    projectedContribution[playerMap.get('pid')] = playerData
  }

  yield put(playerActions.setProjectedContribution(projectedContribution))

  const claimContribution = {}
  const poaches = yield select(getPoachPlayersForCurrentTeam)
  for (const { playerMap } of poaches.values()) {
    const playerData = yield call(calculatePlayerLineupContribution, {
      playerMap
    })
    claimContribution[playerMap.get('pid')] = playerData
  }

  const claims = yield select(getWaiverPlayersForCurrentTeam)
  const claimTypes = ['active', 'poach', 'practice']
  for (const type of claimTypes) {
    for (const { playerMap } of claims[type].values()) {
      const playerData = yield call(calculatePlayerLineupContribution, {
        playerMap
      })
      claimContribution[playerMap.get('pid')] = playerData
    }
  }

  yield put(playerActions.setProjectedContribution(claimContribution))
}

export function* projectLineups() {
  yield put(
    notificationActions.show({
      message: 'Projecting Lineups'
    })
  )

  const league = yield select(getCurrentLeague)
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

  yield putResolve(rosterActions.setLineupProjections(lineups))
  yield call(projectContributions)
}

export function* projectTrade() {
  // TODO - make sure player values and projections have been calculated
  const league = yield select(getCurrentLeague)
  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
  const worker = new Worker()
  const proposingTeamTradedPlayers = yield select(
    getProposingTeamTradedRosterPlayers
  )
  const proposingTeamLineups = yield call(worker.workerOptimizeLineup, {
    players: proposingTeamTradedPlayers.map((p) => p.toJS()),
    league,
    use_baseline_when_missing: true
  })

  const acceptingTeamTradedPlayers = yield select(
    getAcceptingTeamTradedRosterPlayers
  )
  const acceptingTeamLineups = yield call(worker.workerOptimizeLineup, {
    players: acceptingTeamTradedPlayers.map((p) => p.toJS()),
    league,
    use_baseline_when_missing: true
  })
  worker.terminate()
  yield put(
    tradeActions.setProjectedLineups({
      proposingTeamLineups,
      acceptingTeamLineups
    })
  )

  const projectedContribution = {}
  const tradePlayers = yield select(getCurrentTradePlayers)
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
  yield put(playerActions.setProjectedContribution(projectedContribution))
}

export function* addTag({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(postTag, { teamId, leagueId, ...payload })
}

export function* removeTag({ payload }) {
  const { teamId, leagueId } = yield select(get_app)
  yield call(deleteTag, { teamId, leagueId, ...payload })
}

export function* addPlayer({ payload }) {
  const { leagueId } = yield select(get_app)
  yield call(postRosters, { leagueId, ...payload })
}

export function* removePlayer({ payload }) {
  const { leagueId } = yield select(get_app)
  yield call(deleteRosters, { leagueId, ...payload })
}

export function* updatePlayer({ payload }) {
  const { leagueId } = yield select(get_app)
  yield call(putRosters, { leagueId, ...payload })
}

export function* addFreeAgent({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(postAddFreeAgent, { leagueId, teamId, ...payload })
}

export function* reserve({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(postReserve, { leagueId, teamId, ...payload })
}

export function* release({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(postRelease, { leagueId, teamId, ...payload })
}

export function* releaseNotification() {
  yield put(
    notificationActions.show({
      message: 'Player released',
      severity: 'success'
    })
  )
}

export function* protectNotification() {
  yield put(
    notificationActions.show({
      message: 'Player designated',
      severity: 'success'
    })
  )
}

export function* tagNotification() {
  yield put(
    notificationActions.show({
      message: 'Player tagged',
      severity: 'success'
    })
  )
}

export function* transitionPlacedNotification() {
  yield put(
    notificationActions.show({
      message: 'Transition Bid Placed',
      severity: 'success'
    })
  )
}

export function* transitionRemovedNotification() {
  yield put(
    notificationActions.show({
      message: 'Transition Bid Cancelled',
      severity: 'success'
    })
  )
}

export function* post_restricted_free_agent_nomination_notification() {
  yield put(
    notificationActions.show({
      message: 'Restricted Free Agent Nomination Designated',
      severity: 'success'
    })
  )
}

export function* delete_restricted_free_agent_nomination_notification() {
  yield put(
    notificationActions.show({
      message: 'Restricted Free Agent Nomination Cancelled',
      severity: 'success'
    })
  )
}

export function* addTransitionTag({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(postTransitionTag, { leagueId, teamId, ...payload })
}

export function* removeTransitionTag({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(deleteTransitionTag, { leagueId, teamId, ...payload })
}

export function* updateTransitionTag({ payload }) {
  const { leagueId, teamId } = yield select(get_app)
  yield call(putTransitionTag, { leagueId, teamId, ...payload })
}

export function* exportRosters() {
  const league = yield select(getCurrentLeague)
  const rosters = yield select(getRostersForCurrentLeague)
  const playerMaps = yield select(get_player_maps)
  const projectionType = constants.isRegularSeason ? 'ros' : '0'

  const data = []
  for (const [tid, roster] of rosters.entrySeq()) {
    const team = yield select(getTeamById, { tid })
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
        draft_year: playerMap.get('start'),
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
  yield call(post_restricted_free_agent_nomination, { teamId, leagueId, pid })
}

export function* unnominate_restricted_free_agent({ payload }) {
  const { pid } = payload
  const { teamId, leagueId } = yield select(get_app)
  yield call(delete_restricted_free_agent_nomination, { teamId, leagueId, pid })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchUpdateRosterPlayerSlot() {
  yield takeLatest(
    rosterActions.UPDATE_ROSTER_PLAYER_SLOT,
    updateRosterPlayerSlot
  )
}

export function* watchActivatePlayer() {
  yield takeLatest(rosterActions.ACTIVATE_PLAYER, activate)
}

export function* watchDeactivatePlayer() {
  yield takeLatest(rosterActions.DEACTIVATE_PLAYER, deactivate)
}

export function* watchProtectPlayer() {
  yield takeLatest(rosterActions.PROTECT_PLAYER, protect)
}

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, initRosters)
}

export function* watchProjectLineups() {
  yield takeLatest(rosterActions.PROJECT_LINEUPS, projectLineups)
}

export function* watchRosterTransaction() {
  yield takeLatest(rosterActions.ROSTER_TRANSACTION, projectLineups)
}

export function* watchRosterTransactions() {
  yield takeLatest(rosterActions.ROSTER_TRANSACTIONS, projectLineups)
}

export function* watchAddPlayerRoster() {
  yield takeLatest(rosterActions.ADD_PLAYER_ROSTER, addPlayer)
}

export function* watchUpdatePlayerRoster() {
  yield takeLatest(rosterActions.UPDATE_PLAYER_ROSTER, updatePlayer)
}

export function* watchRemovePlayerRoster() {
  yield takeLatest(rosterActions.REMOVE_PLAYER_ROSTER, removePlayer)
}

export function* watchAddFreeAgent() {
  yield takeLatest(rosterActions.ADD_FREE_AGENT, addFreeAgent)
}

export function* watchSetRosterReserve() {
  yield takeLatest(rosterActions.SET_ROSTER_RESERVE, reserve)
}

export function* watchPlayersSelectPlayer() {
  yield takeLatest(
    playerActions.PLAYERS_SELECT_PLAYER,
    setSelectedPlayerLineupContribution
  )
}

export function* watchPostWaiverFulfilled() {
  yield takeLatest(
    waiverActions.POST_WAIVER_FULFILLED,
    setWaiverPlayerLineupContribution
  )
}

export function* watchPostPoachFulfilled() {
  yield takeLatest(
    poachActions.POST_POACH_FULFILLED,
    setPoachPlayerLineupContribution
  )
}

export function* watchReleasePlayer() {
  yield takeLatest(rosterActions.RELEASE_PLAYER, release)
}

export function* watchPostReleaseFulfilled() {
  yield takeLatest(rosterActions.POST_RELEASE_FULFILLED, releaseNotification)
}

export function* watchPostProtectFulfilled() {
  yield takeLatest(rosterActions.POST_PROTECT_FULFILLED, protectNotification)
}

export function* watchPostTagFulfilled() {
  yield takeLatest(rosterActions.POST_TAG_FULFILLED, tagNotification)
}

export function* watchTradeSetProposingTeamPlayers() {
  yield takeLatest(tradeActions.TRADE_SET_PROPOSING_TEAM_PLAYERS, projectTrade)
}

export function* watchTradeSetAcceptingTeamPlayers() {
  yield takeLatest(tradeActions.TRADE_SET_ACCEPTING_TEAM_PLAYERS, projectTrade)
}

export function* watchTradeSelectTeam() {
  yield takeLatest(tradeActions.TRADE_SELECT_TEAM, projectTrade)
}

export function* watchSelectTrade() {
  yield takeLatest(tradeActions.SELECT_TRADE, projectTrade)
}

export function* watchAddTag() {
  yield takeLatest(rosterActions.ADD_TAG, addTag)
}

export function* watchRemoveTag() {
  yield takeLatest(rosterActions.REMOVE_TAG, removeTag)
}

export function* watchAddTransitionTag() {
  yield takeLatest(rosterActions.ADD_TRANSITION_TAG, addTransitionTag)
}

export function* watchRemoveTransitionTag() {
  yield takeLatest(rosterActions.REMOVE_TRANSITION_TAG, removeTransitionTag)
}

export function* watchPostTransitionTagFulfilled() {
  yield takeLatest(
    rosterActions.POST_TRANSITION_TAG_FULFILLED,
    transitionPlacedNotification
  )
}

export function* watchDeleteTransiionTagFulfilled() {
  yield takeLatest(
    rosterActions.DELETE_TRANSITION_TAG_FULFILLED,
    transitionRemovedNotification
  )
}

export function* watchUpdateTransitionTag() {
  yield takeLatest(rosterActions.UPDATE_TRANSITION_TAG, updateTransitionTag)
}

export function* watchPutTransitionTagFulfilled() {
  yield takeLatest(
    rosterActions.PUT_TRANSITION_TAG_FULFILLED,
    transitionPlacedNotification
  )
}

export function* watchExportRosters() {
  yield takeLatest(rosterActions.EXPORT_ROSTERS, exportRosters)
}

export function* watchLoadRosters() {
  yield takeLatest(rosterActions.LOAD_ROSTERS, loadRosters)
}

export function* watchLoadTeams() {
  yield takeLatest(teamActions.LOAD_TEAMS, loadRosters)
}

export function* watchSelectYear() {
  yield takeLatest(appActions.SELECT_YEAR, load_rosters_for_year)
}

export function* watchPostProcessPoachFulfilled() {
  yield takeLatest(
    poachActions.POST_PROCESS_POACH_FULFILLED,
    load_rosters_ignore_cache
  )
}

export function* watch_nominate_restricted_free_agent() {
  yield takeLatest(
    rosterActions.NOMINATE_RESTRICTED_FREE_AGENT,
    nominate_restricted_free_agent
  )
}

export function* watch_unnominate_restricted_free_agent() {
  yield takeLatest(
    rosterActions.UNNOMINATE_RESTRICTED_FREE_AGENT,
    unnominate_restricted_free_agent
  )
}

export function* watch_post_restricted_free_agent_nomination_fulfilled() {
  yield takeLatest(
    rosterActions.POST_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED,
    post_restricted_free_agent_nomination_notification
  )
}

export function* watch_delete_restricted_free_agent_nomination_fulfilled() {
  yield takeLatest(
    rosterActions.DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED,
    delete_restricted_free_agent_nomination_notification
  )
}
//= ====================================
//  ROOT
// -------------------------------------

export const rosterSagas = [
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

  fork(watchAddTransitionTag),
  fork(watchRemoveTransitionTag),
  fork(watchUpdateTransitionTag),

  fork(watchPostTransitionTagFulfilled),
  fork(watchPutTransitionTagFulfilled),
  fork(watchDeleteTransiionTagFulfilled),

  fork(watchExportRosters),

  fork(watchLoadRosters),
  fork(watchLoadTeams),

  fork(watchSelectYear),

  fork(watchPostProcessPoachFulfilled),

  fork(watch_nominate_restricted_free_agent),
  fork(watch_unnominate_restricted_free_agent),

  fork(watch_post_restricted_free_agent_nomination_fulfilled),
  fork(watch_delete_restricted_free_agent_nomination_fulfilled)
]
