/* global AbortController, fetch */

import queryString from 'query-string'
import merge from 'deepmerge'

import { BASE_URL } from '@core/constants'

const POST = (data) => ({
  method: 'POST',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

const PUT = (data) => ({
  method: 'PUT',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

const DELETE = (data) => ({
  method: 'DELETE',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})

export const api = {
  postRegister(data) {
    const url = `${BASE_URL}/auth/register`
    return { url, ...POST(data) }
  },
  postLogin(data) {
    const url = `${BASE_URL}/auth/login`
    return { url, ...POST(data) }
  },
  fetchAuth() {
    const url = `${BASE_URL}/me`
    return { url }
  },
  fetchPlayers(params) {
    const url = `${BASE_URL}/players`
    return { url, ...POST(params) }
  },
  getLeaguePlayers({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/players`
    return { url }
  },
  getTeamPlayers({ teamId, leagueId }) {
    const url = `${BASE_URL}/teams/${teamId}/players?leagueId=${leagueId}`
    return { url }
  },
  getPlayer({ pid }) {
    const url = `${BASE_URL}/players/${pid}`
    return { url }
  },
  putRoster(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/lineups`
    return { url, ...PUT(data) }
  },
  getRosters(params) {
    const url = `${BASE_URL}/leagues/${
      params.leagueId
    }/rosters?${queryString.stringify(params)}`
    return { url }
  },
  postRosters(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/rosters`
    return { url, ...POST(data) }
  },
  deleteRosters(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/rosters`
    return { url, ...DELETE(data) }
  },
  putRosters(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/rosters`
    return { url, ...PUT(data) }
  },
  postAddFreeAgent(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/add`
    return { url, ...POST(data) }
  },
  postRelease(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/release`
    return { url, ...POST(data) }
  },
  postActivate(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/activate`
    return { url, ...POST(data) }
  },
  postDeactivate(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/deactivate`
    return { url, ...POST(data) }
  },
  postProtect(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/protect`
    return { url, ...POST(data) }
  },
  postTag(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/tag`
    return { url, ...POST(data) }
  },
  deleteTag(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/tag`
    return { url, ...DELETE(data) }
  },
  postReserve(data) {
    const url = `${BASE_URL}/teams/${data.teamId}/reserve`
    return { url, ...POST(data) }
  },
  getDraft({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/draft`
    return { url }
  },
  postDraft(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/draft`
    return { url, ...POST(data) }
  },
  getTeams({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/teams`
    return { url }
  },
  getMatchups({ leagueId, ...params }) {
    const url = `${BASE_URL}/leagues/${leagueId}/matchups?${queryString.stringify(
      params
    )}`
    return { url }
  },
  postMatchups({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/matchups`
    return { url, ...POST() }
  },
  getTransactions(params) {
    const url = `${BASE_URL}/leagues/${
      params.leagueId
    }/transactions?${queryString.stringify(params)}`
    return { url }
  },
  getReleaseTransactions(params) {
    const url = `${BASE_URL}/leagues/${params.leagueId}/transactions/release`
    return { url }
  },
  getReserveTransactions({ teamId, leagueId }) {
    const url = `${BASE_URL}/teams/${teamId}/transactions/reserve?leagueId=${leagueId}`
    return { url }
  },
  getTrades(params) {
    const url = `${BASE_URL}/leagues/${
      params.leagueId
    }/trades?${queryString.stringify(params)}`
    return { url }
  },
  postProposeTrade(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/trades`
    return { url, ...POST(data) }
  },
  postCancelTrade(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/cancel`
    return { url, ...POST(data) }
  },
  postAcceptTrade(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/accept`
    return { url, ...POST(data) }
  },
  postRejectTrade(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/reject`
    return { url, ...POST(data) }
  },
  getLeague({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}`
    return { url }
  },
  putLeague(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}`
    return { url, ...PUT(data) }
  },
  putTeam(data) {
    const url = `${BASE_URL}/teams/${data.teamId}`
    return { url, ...PUT(data) }
  },
  postTeams(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/teams`
    return { url, ...POST(data) }
  },
  deleteTeams(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/teams`
    return { url, ...DELETE(data) }
  },
  getSources() {
    const url = `${BASE_URL}/sources`
    return { url }
  },
  putSource(data) {
    const url = `${BASE_URL}/sources/${data.sourceId}`
    return { url, ...PUT(data) }
  },
  getPlayersGamelogs(params) {
    const url = `${BASE_URL}/stats/gamelogs/players?${queryString.stringify(
      params
    )}`
    return { url }
  },
  putProjection(data) {
    const url = `${BASE_URL}/projections/${data.pid}`
    return { url, ...PUT(data) }
  },
  delProjection(data) {
    const url = `${BASE_URL}/projections/${data.pid}`
    return { url, ...DELETE(data) }
  },
  putSetting(data) {
    const url = `${BASE_URL}/me`
    return { url, ...PUT(data) }
  },
  getChartedPlays(params) {
    const url = `${BASE_URL}/plays/charted?${queryString.stringify(params)}`
    return { url }
  },
  getPlays(params) {
    const url = `${BASE_URL}/plays?${queryString.stringify(params)}`
    return { url }
  },
  getPlayStats(params) {
    const url = `${BASE_URL}/plays/stats?${queryString.stringify(params)}`
    return { url }
  },
  getLeagueTeamStats(params) {
    const url = `${BASE_URL}/leagues/${
      params.leagueId
    }/team-stats?${queryString.stringify(params)}`
    return { url }
  },
  postWaiver(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/waivers`
    return { url, ...POST(data) }
  },
  postWaiverOrder(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/waivers/order`
    return { url, ...PUT(data) }
  },
  putWaiver(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/waivers/${data.waiverId}`
    return { url, ...PUT(data) }
  },
  postCancelWaiver(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/waivers/${data.waiverId}/cancel`
    return { url, ...POST(data) }
  },
  getWaivers(params) {
    const url = `${BASE_URL}/leagues/${
      params.leagueId
    }/waivers?${queryString.stringify(params)}`
    return { url }
  },
  getWaiverReport(params) {
    const url = `${BASE_URL}/leagues/${
      params.leagueId
    }/waivers/report?${queryString.stringify(params)}`
    return { url }
  },
  postPoach(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/poaches`
    return { url, ...POST(data) }
  },
  putPoach(data) {
    const url = `${BASE_URL}/leagues/${data.leagueId}/poaches/${data.poachId}`
    return { url, ...PUT(data) }
  },
  postError(data) {
    const url = `${BASE_URL}/errors`
    return { url, ...POST(data) }
  },
  getSchedule() {
    const url = `${BASE_URL}/schedule`
    return { url }
  },
  getStatus() {
    const url = `${BASE_URL}/status`
    return { url }
  },
  getScoreboard(params) {
    const url = `${BASE_URL}/scoreboard?${queryString.stringify(params)}`
    return { url }
  },
  getProps() {
    const url = `${BASE_URL}/odds/props`
    return { url }
  },
  getCutlist({ teamId }) {
    const url = `${BASE_URL}/teams/${teamId}/cutlist`
    return { url }
  },
  postCutlist({ teamId, ...data }) {
    const url = `${BASE_URL}/teams/${teamId}/cutlist`
    return { url, ...POST(data) }
  },
  postTransitionTag({ teamId, ...data }) {
    const url = `${BASE_URL}/teams/${teamId}/tag/transition`
    return { url, ...POST(data) }
  },
  deleteTransitionTag({ teamId, ...data }) {
    const url = `${BASE_URL}/teams/${teamId}/tag/transition`
    return { url, ...DELETE(data) }
  },
  putTransitionTag({ teamId, ...data }) {
    const url = `${BASE_URL}/teams/${teamId}/tag/transition`
    return { url, ...PUT(data) }
  },
  getBaselines({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/baselines`
    return { url }
  },
  getPlayerProjections({ pid }) {
    const url = `${BASE_URL}/projections/${pid}`
    return { url }
  },
  getPlayerGamelogs({ pid, leagueId }) {
    const url = `${BASE_URL}/players/${pid}/gamelogs?leagueId=${leagueId}`
    return { url }
  },
  getPlayerPractices({ pid }) {
    const url = `${BASE_URL}/players/${pid}/practices`
    return { url }
  },
  getDraftPickValue({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/draft-pick-value`
    return { url }
  },
  getPercentiles({ percentile_key }) {
    const url = `${BASE_URL}/percentiles/${percentile_key}`
    return { url }
  },
  getNflTeamSeasonlogs({ leagueId }) {
    const url = leagueId
      ? `${BASE_URL}/seasonlogs/teams?leagueId=${leagueId}`
      : `${BASE_URL}/seasonlogs/teams`
    return { url }
  },
  get_league_team_daily_values({ leagueId }) {
    const url = `${BASE_URL}/leagues/${leagueId}/team-daily-values`
    return { url }
  }
}

export const apiRequest = (apiFunction, opts, token) => {
  const controller = new AbortController()
  const abort = controller.abort.bind(controller)
  const headers = { Authorization: `Bearer ${token}` }
  const defaultOptions = { headers, credentials: 'include' }
  const options = merge(defaultOptions, apiFunction(opts), {
    signal: controller.signal
  })
  const request = dispatchFetch.bind(null, options)
  return { abort, request }
}

export const dispatchFetch = async (options) => {
  const response = await fetch(options.url, options)
  if (response.status >= 200 && response.status < 300) {
    return response.json()
  } else {
    const res = await response.json()
    const error = new Error(res.error || response.statusText)
    error.response = response
    throw error
  }
}
