import { call, put, cancelled, select } from 'redux-saga/effects'
import Bugsnag from '@bugsnag/js'

import { api, apiRequest } from '@core/api/service'
import { getDraftPickValueActions } from '@core/draft-pick-value/actions'
import { authActions, loginActions, registerActions } from '@core/app/actions'
import { get_app } from '@core/selectors'
import { getStatusActions } from '@core/status/actions'
import { getScheduleActions } from '@core/schedule/actions'
import { getDraftActions, postDraftActions } from '@core/draft/actions'
import {
  getRostersActions,
  putRosterActions,
  postActivateActions,
  postDeactivateActions,
  postProtectActions,
  postRostersActions,
  putRostersActions,
  deleteRostersActions,
  postAddFreeAgentActions,
  postReserveActions,
  postReleaseActions,
  postTagActions,
  deleteTagActions,
  postTransitionTagActions,
  deleteTransitionTagActions,
  putTransitionTagActions
} from '@core/rosters/actions'
import { getPlayersGamelogsActions } from '@core/gamelogs/actions'
import {
  playersRequestActions,
  allPlayersRequestActions,
  leaguePlayersRequestActions,
  teamPlayersRequestActions,
  playersSearchActions,
  getPlayerActions,
  putProjectionActions,
  delProjectionActions,
  getCutlistActions,
  postCutlistActions,
  getPlayerTransactionsActions,
  getBaselinesActions,
  getPlayerProjectionsActions,
  getPlayerGamelogsActions,
  getPlayerPracticesActions
} from '@core/players/actions'
import { getChartedPlaysActions } from '@core/stats/actions'
import { getPlaysActions, getPlayStatsActions } from '@core/plays/actions'
import {
  getTeamsActions,
  putTeamActions,
  postTeamsActions,
  deleteTeamsActions,
  getLeagueTeamStatsActions
} from '@core/teams/actions'
import {
  getTransactionsActions,
  getReleaseTransactionsActions,
  getReserveTransactionsActions
} from '@core/transactions/actions'
import { getMatchupsActions, postMatchupsActions } from '@core/matchups/actions'
import {
  postTradeProposeActions,
  postTradeAcceptActions,
  postTradeCancelActions,
  postTradeRejectActions,
  getTradesActions
} from '@core/trade/actions'
import { putLeagueActions, getLeagueActions } from '@core/leagues/actions'
import { getSourcesActions, putSourceActions } from '@core/sources/actions'
import { putSettingActions } from '@core/settings/actions'
import { postPoachActions, putPoachActions } from '@core/poaches/actions'
import {
  postWaiverActions,
  putWaiverActions,
  postCancelWaiverActions,
  postWaiverOrderActions,
  getWaiversActions,
  getWaiverReportActions
} from '@core/waivers/actions'
import { notificationActions } from '@core/notifications/actions'
import { getScoreboardActions } from '@core/scoreboard/actions'
import { postErrorActions } from '@core/errors/actions'
import { getPropsActions } from '@core/props/actions'
import { getPercentilesActions } from '@core/percentiles/actions'
import { getNflTeamSeasonlogsActions } from '@core/seasonlogs/actions'
import { get_league_team_daily_values_actions } from '@core/league-team-daily-values/actions'

function* fetchAPI(apiFunction, actions, opts = {}) {
  const { token } = yield select(get_app)
  const { request } = apiRequest(apiFunction, opts, token)
  try {
    yield put(actions.pending(opts))
    const data = yield call(request)
    yield put(actions.fulfilled(opts, data))
  } catch (err) {
    console.log(err)
    if (!opts.ignoreError) {
      yield put(
        notificationActions.show({ severity: 'error', message: err.message })
      )
      Bugsnag.notify(err, (event) => {
        event.addMetadata('options', opts)
      })
    }
    yield put(actions.failed(opts, err.toString()))
  } finally {
    if (yield cancelled()) {
      // TODO re-enable request cancellation
      // console.log('request cancelled')
      // abort()
    }
  }
}

function* fetch(...args) {
  yield call(fetchAPI.bind(null, ...args))
}

export const postRegister = fetch.bind(null, api.postRegister, registerActions)
export const postLogin = fetch.bind(null, api.postLogin, loginActions)
export const fetchAuth = fetch.bind(null, api.fetchAuth, authActions)

export const fetchPlayers = fetch.bind(
  null,
  api.fetchPlayers,
  playersRequestActions
)
export const fetchAllPlayers = fetch.bind(
  null,
  api.fetchPlayers,
  allPlayersRequestActions
)
export const getTeamPlayers = fetch.bind(
  null,
  api.getTeamPlayers,
  teamPlayersRequestActions
)
export const getLeaguePlayers = fetch.bind(
  null,
  api.getLeaguePlayers,
  leaguePlayersRequestActions
)
export const searchPlayers = fetch.bind(
  null,
  api.fetchPlayers,
  playersSearchActions
)
export const getPlayer = fetch.bind(null, api.getPlayer, getPlayerActions)

export const getChartedPlays = fetch.bind(
  null,
  api.getChartedPlays,
  getChartedPlaysActions
)
export const getPlays = fetch.bind(null, api.getPlays, getPlaysActions)
export const getPlayStats = fetch.bind(
  null,
  api.getPlayStats,
  getPlayStatsActions
)

export const getRosters = fetch.bind(null, api.getRosters, getRostersActions)
export const putRoster = fetch.bind(null, api.putRoster, putRosterActions)

export const postRosters = fetch.bind(null, api.postRosters, postRostersActions)
export const putRosters = fetch.bind(null, api.putRosters, putRostersActions)
export const deleteRosters = fetch.bind(
  null,
  api.deleteRosters,
  deleteRostersActions
)

export const postAddFreeAgent = fetch.bind(
  null,
  api.postAddFreeAgent,
  postAddFreeAgentActions
)
export const postRelease = fetch.bind(null, api.postRelease, postReleaseActions)

export const postActivate = fetch.bind(
  null,
  api.postActivate,
  postActivateActions
)
export const postDeactivate = fetch.bind(
  null,
  api.postDeactivate,
  postDeactivateActions
)
export const postProtect = fetch.bind(null, api.postProtect, postProtectActions)
export const postReserve = fetch.bind(null, api.postReserve, postReserveActions)
export const postTag = fetch.bind(null, api.postTag, postTagActions)
export const deleteTag = fetch.bind(null, api.deleteTag, deleteTagActions)

export const fetchDraft = fetch.bind(null, api.getDraft, getDraftActions)
export const postDraft = fetch.bind(null, api.postDraft, postDraftActions)

export const getTeams = fetch.bind(null, api.getTeams, getTeamsActions)
export const fetchTransactions = fetch.bind(
  null,
  api.getTransactions,
  getTransactionsActions
)
export const getReleaseTransactions = fetch.bind(
  null,
  api.getReleaseTransactions,
  getReleaseTransactionsActions
)
export const getReserveTransactions = fetch.bind(
  null,
  api.getReserveTransactions,
  getReserveTransactionsActions
)

export const fetchMatchups = fetch.bind(
  null,
  api.getMatchups,
  getMatchupsActions
)
export const postMatchups = fetch.bind(
  null,
  api.postMatchups,
  postMatchupsActions
)

export const postProposeTrade = fetch.bind(
  null,
  api.postProposeTrade,
  postTradeProposeActions
)
export const getTrades = fetch.bind(null, api.getTrades, getTradesActions)

export const postCancelTrade = fetch.bind(
  null,
  api.postCancelTrade,
  postTradeCancelActions
)
export const postAcceptTrade = fetch.bind(
  null,
  api.postAcceptTrade,
  postTradeAcceptActions
)
export const postRejectTrade = fetch.bind(
  null,
  api.postRejectTrade,
  postTradeRejectActions
)

export const getLeague = fetch.bind(null, api.getLeague, getLeagueActions)
export const putLeague = fetch.bind(null, api.putLeague, putLeagueActions)

export const putTeam = fetch.bind(null, api.putTeam, putTeamActions)
export const postTeams = fetch.bind(null, api.postTeams, postTeamsActions)
export const deleteTeams = fetch.bind(null, api.deleteTeams, deleteTeamsActions)

export const getSources = fetch.bind(null, api.getSources, getSourcesActions)
export const putSource = fetch.bind(null, api.putSource, putSourceActions)

export const getPlayersGamelogs = fetch.bind(
  null,
  api.getPlayersGamelogs,
  getPlayersGamelogsActions
)

export const putProjection = fetch.bind(
  null,
  api.putProjection,
  putProjectionActions
)
export const delProjection = fetch.bind(
  null,
  api.delProjection,
  delProjectionActions
)

export const putSetting = fetch.bind(null, api.putSetting, putSettingActions)

export const postWaiver = fetch.bind(null, api.postWaiver, postWaiverActions)
export const putWaiver = fetch.bind(null, api.putWaiver, putWaiverActions)
export const postWaiverOrder = fetch.bind(
  null,
  api.postWaiverOrder,
  postWaiverOrderActions
)
export const postCancelWaiver = fetch.bind(
  null,
  api.postCancelWaiver,
  postCancelWaiverActions
)
export const postPoach = fetch.bind(null, api.postPoach, postPoachActions)
export const putPoach = fetch.bind(null, api.putPoach, putPoachActions)
export const fetchWaivers = fetch.bind(null, api.getWaivers, getWaiversActions)
export const getWaiverReport = fetch.bind(
  null,
  api.getWaiverReport,
  getWaiverReportActions
)

export const getSchedule = fetch.bind(null, api.getSchedule, getScheduleActions)

export const fetchScoreboard = fetch.bind(
  null,
  api.getScoreboard,
  getScoreboardActions
)

export const postError = fetch.bind(null, api.postError, postErrorActions)
export const getStatus = fetch.bind(null, api.getStatus, getStatusActions)

export const fetchProps = fetch.bind(null, api.getProps, getPropsActions)

export const getCutlist = fetch.bind(null, api.getCutlist, getCutlistActions)
export const postCutlist = fetch.bind(null, api.postCutlist, postCutlistActions)

export const postTransitionTag = fetch.bind(
  null,
  api.postTransitionTag,
  postTransitionTagActions
)
export const deleteTransitionTag = fetch.bind(
  null,
  api.deleteTransitionTag,
  deleteTransitionTagActions
)
export const putTransitionTag = fetch.bind(
  null,
  api.putTransitionTag,
  putTransitionTagActions
)

export const getPlayerTransactions = fetch.bind(
  null,
  api.getTransactions,
  getPlayerTransactionsActions
)

export const getBaselines = fetch.bind(
  null,
  api.getBaselines,
  getBaselinesActions
)

export const getPlayerProjections = fetch.bind(
  null,
  api.getPlayerProjections,
  getPlayerProjectionsActions
)

export const getLeagueTeamStats = fetch.bind(
  null,
  api.getLeagueTeamStats,
  getLeagueTeamStatsActions
)

export const getPlayerGamelogs = fetch.bind(
  null,
  api.getPlayerGamelogs,
  getPlayerGamelogsActions
)

export const getPlayerPractices = fetch.bind(
  null,
  api.getPlayerPractices,
  getPlayerPracticesActions
)

export const getDraftPickValue = fetch.bind(
  null,
  api.getDraftPickValue,
  getDraftPickValueActions
)

export const getPercentiles = fetch.bind(
  null,
  api.getPercentiles,
  getPercentilesActions
)

export const getNflTeamSeasonlogs = fetch.bind(
  null,
  api.getNflTeamSeasonlogs,
  getNflTeamSeasonlogsActions
)

export const get_league_team_daily_values = fetch.bind(
  null,
  api.get_league_team_daily_values,
  get_league_team_daily_values_actions
)
