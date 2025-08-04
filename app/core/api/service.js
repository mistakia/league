/* global AbortController, fetch */

import queryString from 'query-string'
import merge from 'deepmerge'

import { API_URL } from '@core/constants'

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
  post_register(data) {
    const url = `${API_URL}/auth/register`
    return { url, ...POST(data) }
  },
  post_login(data) {
    const url = `${API_URL}/auth/login`
    return { url, ...POST(data) }
  },
  get_auth() {
    const url = `${API_URL}/me`
    return { url }
  },
  get_players(params) {
    const url = `${API_URL}/players`
    return { url, ...POST(params) }
  },
  get_league_players({ leagueId }) {
    const url = `${API_URL}/leagues/${leagueId}/players`
    return { url }
  },
  get_team_players({ teamId, leagueId }) {
    const url = `${API_URL}/teams/${teamId}/players?leagueId=${leagueId}`
    return { url }
  },
  get_player({ pid }) {
    const url = `${API_URL}/players/${pid}`
    return { url }
  },
  put_roster(data) {
    const url = `${API_URL}/teams/${data.teamId}/lineups`
    return { url, ...PUT(data) }
  },
  get_rosters(params) {
    const url = `${API_URL}/leagues/${
      params.leagueId
    }/rosters?${queryString.stringify(params)}`
    return { url }
  },
  post_rosters(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/rosters`
    return { url, ...POST(data) }
  },
  delete_rosters(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/rosters`
    return { url, ...DELETE(data) }
  },
  put_rosters(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/rosters`
    return { url, ...PUT(data) }
  },
  post_add_free_agent(data) {
    const url = `${API_URL}/teams/${data.teamId}/add`
    return { url, ...POST(data) }
  },
  post_release(data) {
    const url = `${API_URL}/teams/${data.teamId}/release`
    return { url, ...POST(data) }
  },
  post_activate(data) {
    const url = `${API_URL}/teams/${data.teamId}/activate`
    return { url, ...POST(data) }
  },
  post_deactivate(data) {
    const url = `${API_URL}/teams/${data.teamId}/deactivate`
    return { url, ...POST(data) }
  },
  post_protect(data) {
    const url = `${API_URL}/teams/${data.teamId}/protect`
    return { url, ...POST(data) }
  },
  post_tag(data) {
    const url = `${API_URL}/teams/${data.teamId}/tag`
    return { url, ...POST(data) }
  },
  delete_tag(data) {
    const url = `${API_URL}/teams/${data.teamId}/tag`
    return { url, ...DELETE(data) }
  },
  post_reserve(data) {
    const url = `${API_URL}/teams/${data.teamId}/reserve`
    return { url, ...POST(data) }
  },
  get_draft({ leagueId }) {
    const url = `${API_URL}/leagues/${leagueId}/draft`
    return { url }
  },
  post_draft(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/draft`
    return { url, ...POST(data) }
  },
  get_draft_pick_details({ leagueId, pickId }) {
    const url = `${API_URL}/leagues/${leagueId}/draft/picks/${pickId}`
    return { url }
  },
  get_teams({ leagueId, ...params }) {
    const url = `${API_URL}/leagues/${leagueId}/teams?${queryString.stringify(
      params
    )}`
    return { url }
  },
  get_matchups({ leagueId, ...params }) {
    const url = `${API_URL}/leagues/${leagueId}/matchups?${queryString.stringify(
      params
    )}`
    return { url }
  },
  post_matchups({ leagueId }) {
    const url = `${API_URL}/leagues/${leagueId}/matchups`
    return { url, ...POST() }
  },
  get_transactions(params) {
    const url = `${API_URL}/leagues/${
      params.leagueId
    }/transactions?${queryString.stringify(params)}`
    return { url }
  },
  get_release_transactions(params) {
    const url = `${API_URL}/leagues/${params.leagueId}/transactions/release`
    return { url }
  },
  get_reserve_transactions({ teamId, leagueId }) {
    const url = `${API_URL}/teams/${teamId}/transactions/reserve?leagueId=${leagueId}`
    return { url }
  },
  get_trades(params) {
    const url = `${API_URL}/leagues/${
      params.leagueId
    }/trades?${queryString.stringify(params)}`
    return { url }
  },
  post_propose_trade(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/trades`
    return { url, ...POST(data) }
  },
  post_cancel_trade(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/cancel`
    return { url, ...POST(data) }
  },
  post_accept_trade(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/accept`
    return { url, ...POST(data) }
  },
  post_reject_trade(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/trades/${data.tradeId}/reject`
    return { url, ...POST(data) }
  },
  get_league({ leagueId }) {
    const url = `${API_URL}/leagues/${leagueId}`
    return { url }
  },
  put_league(data) {
    const url = `${API_URL}/leagues/${data.leagueId}`
    return { url, ...PUT(data) }
  },
  put_team(data) {
    const url = `${API_URL}/teams/${data.teamId}`
    return { url, ...PUT(data) }
  },
  post_teams(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/teams`
    return { url, ...POST(data) }
  },
  delete_teams(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/teams`
    return { url, ...DELETE(data) }
  },
  get_sources() {
    const url = `${API_URL}/sources`
    return { url }
  },
  put_source(data) {
    const url = `${API_URL}/sources/${data.sourceId}`
    return { url, ...PUT(data) }
  },
  get_players_gamelogs(params) {
    const url = `${API_URL}/stats/gamelogs/players?${queryString.stringify(
      params
    )}`
    return { url }
  },
  put_projection(data) {
    const url = `${API_URL}/projections/${data.pid}`
    return { url, ...PUT(data) }
  },
  del_projection(data) {
    const url = `${API_URL}/projections/${data.pid}`
    return { url, ...DELETE(data) }
  },
  put_setting(data) {
    const url = `${API_URL}/me`
    return { url, ...PUT(data) }
  },
  get_charted_plays(params) {
    const url = `${API_URL}/plays/charted?${queryString.stringify(params)}`
    return { url }
  },
  get_plays(params) {
    const url = `${API_URL}/plays?${queryString.stringify(params)}`
    return { url }
  },
  get_play_stats(params) {
    const url = `${API_URL}/plays/stats?${queryString.stringify(params)}`
    return { url }
  },
  get_league_team_stats(params) {
    const url = `${API_URL}/leagues/${
      params.leagueId
    }/team-stats?${queryString.stringify(params)}`
    return { url }
  },
  post_waiver(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/waivers`
    return { url, ...POST(data) }
  },
  post_waiver_order(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/waivers/order`
    return { url, ...PUT(data) }
  },
  put_waiver(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/waivers/${data.waiverId}`
    return { url, ...PUT(data) }
  },
  post_cancel_waiver(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/waivers/${data.waiverId}/cancel`
    return { url, ...POST(data) }
  },
  get_waivers(params) {
    const url = `${API_URL}/leagues/${
      params.leagueId
    }/waivers?${queryString.stringify(params)}`
    return { url }
  },
  get_waiver_report(params) {
    const url = `${API_URL}/leagues/${
      params.leagueId
    }/waivers/report?${queryString.stringify(params)}`
    return { url }
  },
  post_poach(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/poaches`
    return { url, ...POST(data) }
  },
  put_poach(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/poaches/${data.poachId}`
    return { url, ...PUT(data) }
  },
  post_process_poach(data) {
    const url = `${API_URL}/leagues/${data.leagueId}/poaches/${data.poachId}/process`
    return { url, ...POST(data) }
  },
  post_error(data) {
    const url = `${API_URL}/errors`
    return { url, ...POST(data) }
  },
  get_schedule() {
    const url = `${API_URL}/schedule`
    return { url }
  },
  get_status() {
    const url = `${API_URL}/status`
    return { url }
  },
  get_scoreboard(params) {
    const url = `${API_URL}/scoreboard?${queryString.stringify(params)}`
    return { url }
  },
  get_cutlist({ teamId }) {
    const url = `${API_URL}/teams/${teamId}/cutlist`
    return { url }
  },
  post_cutlist({ teamId, ...data }) {
    const url = `${API_URL}/teams/${teamId}/cutlist`
    return { url, ...POST(data) }
  },
  post_restricted_free_agency_tag({ teamId, ...data }) {
    const url = `${API_URL}/teams/${teamId}/tag/restricted-free-agency`
    return { url, ...POST(data) }
  },
  delete_restricted_free_agency_tag({ teamId, ...data }) {
    const url = `${API_URL}/teams/${teamId}/tag/restricted-free-agency`
    return { url, ...DELETE(data) }
  },
  put_restricted_free_agency_tag({ teamId, ...data }) {
    const url = `${API_URL}/teams/${teamId}/tag/restricted-free-agency`
    return { url, ...PUT(data) }
  },
  get_baselines({ leagueId }) {
    const url = `${API_URL}/leagues/${leagueId}/baselines`
    return { url }
  },
  get_player_projections({ pid }) {
    const url = `${API_URL}/projections/${pid}`
    return { url }
  },
  get_player_gamelogs({ pid, params }) {
    const url = `${API_URL}/players/${pid}/gamelogs?${queryString.stringify(
      params
    )}`
    return { url }
  },
  get_player_practices({ pid }) {
    const url = `${API_URL}/players/${pid}/practices`
    return { url }
  },
  get_player_betting_markets({ pid }) {
    const url = `${API_URL}/players/${pid}/markets`
    return { url }
  },
  get_draft_pick_value({ leagueId }) {
    const url = `${API_URL}/leagues/${leagueId}/draft-pick-value`
    return { url }
  },
  get_percentiles({ percentile_key }) {
    const url = `${API_URL}/percentiles/${percentile_key}`
    return { url }
  },
  get_nfl_team_seasonlogs({ leagueId }) {
    const url =
      leagueId !== null && leagueId !== undefined
        ? `${API_URL}/seasonlogs/teams?leagueId=${leagueId}`
        : `${API_URL}/seasonlogs/teams`
    return { url }
  },
  get_league_team_daily_values({ leagueId }) {
    const url = `${API_URL}/leagues/${leagueId}/team-daily-values`
    return { url }
  },
  post_data_view(data) {
    const url = `${API_URL}/data-views`
    return { url, ...POST(data) }
  },
  delete_data_view({ view_id }) {
    const url = `${API_URL}/data-views/${view_id}`
    return { url, method: 'DELETE' }
  },
  get_data_views({ user_id, username }) {
    let url = `${API_URL}/data-views`
    const params = new URLSearchParams()
    if (user_id) params.append('user_id', user_id)
    if (username) params.append('username', username)
    if (params.toString()) url += `?${params.toString()}`
    return { url }
  },
  get_data_view({ data_view_id }) {
    const url = `${API_URL}/data-views/${data_view_id}`
    return { url }
  },
  post_restricted_free_agent_nomination({ teamId, ...data }) {
    const url = `${API_URL}/teams/${teamId}/tag/restricted-free-agency/nominate`
    return { url, ...POST(data) }
  },
  delete_restricted_free_agent_nomination({ teamId, ...data }) {
    const url = `${API_URL}/teams/${teamId}/tag/restricted-free-agency/nominate`
    return { url, ...DELETE(data) }
  },
  get_league_careerlogs({ leagueId }) {
    const url = `${API_URL}/leagues/${leagueId}/careerlogs`
    return { url }
  },
  get_season({ leagueId, year }) {
    const url = `${API_URL}/leagues/${leagueId}/seasons/${year}`
    return { url }
  }
}

export const api_request = (apiFunction, opts, token) => {
  const controller = new AbortController()
  const abort = controller.abort.bind(controller)
  const headers = { Authorization: `Bearer ${token}` }
  const default_options = { headers, credentials: 'include' }
  const options = merge(default_options, apiFunction(opts), {
    signal: controller.signal
  })
  const request = dispatch_fetch.bind(null, options)
  return { abort, request }
}

export const dispatch_fetch = async (options) => {
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
