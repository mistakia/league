import { call, put, cancelled, select } from 'redux-saga/effects'
import Bugsnag from '@bugsnag/js'

import { api, api_request } from '@core/api/service'
import { get_draft_pick_value_actions } from '@core/draft-pick-value/actions'
import {
  auth_actions,
  login_actions,
  register_actions
} from '@core/app/actions'
import { get_app } from '@core/selectors'
import { get_status_actions } from '@core/status/actions'
import { get_schedule_actions } from '@core/schedule/actions'
import {
  get_draft_actions,
  post_draft_actions,
  get_draft_pick_details_actions
} from '@core/draft/actions'
import {
  get_rosters_actions,
  put_roster_actions,
  post_activate_actions,
  post_deactivate_actions,
  post_protect_actions,
  post_rosters_actions,
  put_rosters_actions,
  delete_rosters_actions,
  post_add_free_agent_actions,
  post_reserve_actions,
  post_release_actions,
  post_tag_actions,
  delete_tag_actions,
  post_restricted_free_agency_tag_actions,
  delete_restricted_free_agency_tag_actions,
  put_restricted_free_agency_tag_actions,
  post_restricted_free_agent_nomination_actions,
  delete_restricted_free_agent_nomination_actions
} from '@core/rosters/actions'
import { get_players_gamelogs_actions } from '@core/gamelogs/actions'
import {
  players_request_actions,
  all_players_request_actions,
  league_players_request_actions,
  team_players_request_actions,
  players_search_actions,
  get_player_actions,
  put_projection_actions,
  del_projection_actions,
  get_cutlist_actions,
  post_cutlist_actions,
  get_player_transactions_actions,
  get_baselines_actions,
  get_player_projections_actions,
  get_player_gamelogs_actions,
  get_player_practices_actions,
  get_player_betting_markets_actions
} from '@core/players/actions'
import { get_charted_plays_actions } from '@core/stats/actions'
import { get_plays_actions, get_play_stats_actions } from '@core/plays/actions'
import {
  get_teams_actions,
  put_team_actions,
  post_teams_actions,
  delete_teams_actions,
  get_league_team_stats_actions
} from '@core/teams/actions'
import {
  get_transactions_actions,
  get_release_transactions_actions,
  get_reserve_transactions_actions
} from '@core/transactions/actions'
import {
  get_matchups_actions,
  post_matchups_actions
} from '@core/matchups/actions'
import {
  post_trade_propose_actions,
  post_trade_accept_actions,
  post_trade_cancel_actions,
  post_trade_reject_actions,
  get_trades_actions
} from '@core/trade/actions'
import { put_league_actions, get_league_actions } from '@core/leagues/actions'
import { get_sources_actions, put_source_actions } from '@core/sources/actions'
import { put_setting_actions } from '@core/settings/actions'
import {
  post_poach_actions,
  put_poach_actions,
  post_process_poach_actions
} from '@core/poaches/actions'
import {
  post_waiver_actions,
  put_waiver_actions,
  post_cancel_waiver_actions,
  post_waiver_order_actions,
  get_waivers_actions,
  get_waiver_report_actions
} from '@core/waivers/actions'
import { notification_actions } from '@core/notifications/actions'
import { get_scoreboard_actions } from '@core/scoreboard/actions'
import { post_error_actions } from '@core/errors/actions'
import { get_percentiles_actions } from '@core/percentiles/actions'
import { get_nfl_team_seasonlogs_actions } from '@core/seasonlogs/actions'
import { get_league_team_daily_values_actions } from '@core/league-team-daily-values/actions'
import {
  post_data_view_actions,
  delete_data_view_actions,
  get_data_views_actions,
  get_data_view_actions
} from '@core/data-views/actions'
import { get_league_careerlogs_actions } from '@core/league-careerlogs/actions'
import { get_season_actions } from '@core/seasons/actions'

function* fetch_api(api_function, actions, opts = {}) {
  const { token } = yield select(get_app)
  const { request } = api_request(api_function, opts, token)
  try {
    yield put(actions.pending({ opts }))
    const data = yield call(request)
    yield put(actions.fulfilled({ opts, data }))
  } catch (err) {
    console.log(err)
    if (!opts.ignore_error) {
      const is_statement_timeout = err.message.includes(
        'canceling statement due to statement timeout'
      )

      let message = 'Request failed'
      if (is_statement_timeout) {
        message = 'Canceled request — took longer than 40 seconds'
      }

      const is_server_error =
        err.message.includes('Error') || err.message.includes('error')
      if (!is_server_error) {
        message = err.message
      }

      yield put(notification_actions.show({ severity: 'error', message }))
      Bugsnag.notify(err, (event) => {
        event.addMetadata('options', opts)
      })
    }
    yield put(actions.failed({ opts, error: err.toString() }))
  } finally {
    if (yield cancelled()) {
      // TODO re-enable request cancellation
      // console.log('request cancelled')
      // abort()
    }
  }
}

function* fetch(...args) {
  yield call(fetch_api.bind(null, ...args))
}

export const api_post_register = fetch.bind(
  null,
  api.post_register,
  register_actions
)
export const api_post_login = fetch.bind(null, api.post_login, login_actions)
export const api_get_auth = fetch.bind(null, api.get_auth, auth_actions)

export const api_get_players = fetch.bind(
  null,
  api.get_players,
  players_request_actions
)
export const api_get_all_players = fetch.bind(
  null,
  api.get_players,
  all_players_request_actions
)
export const api_get_team_players = fetch.bind(
  null,
  api.get_team_players,
  team_players_request_actions
)
export const api_get_league_players = fetch.bind(
  null,
  api.get_league_players,
  league_players_request_actions
)
export const api_search_players = fetch.bind(
  null,
  api.get_players,
  players_search_actions
)
export const api_get_player = fetch.bind(
  null,
  api.get_player,
  get_player_actions
)

export const api_get_charted_plays = fetch.bind(
  null,
  api.get_charted_plays,
  get_charted_plays_actions
)
export const api_get_plays = fetch.bind(null, api.get_plays, get_plays_actions)
export const api_get_play_stats = fetch.bind(
  null,
  api.get_play_stats,
  get_play_stats_actions
)

export const api_get_rosters = fetch.bind(
  null,
  api.get_rosters,
  get_rosters_actions
)
export const api_put_roster = fetch.bind(
  null,
  api.put_roster,
  put_roster_actions
)

export const api_post_rosters = fetch.bind(
  null,
  api.post_rosters,
  post_rosters_actions
)
export const api_put_rosters = fetch.bind(
  null,
  api.put_rosters,
  put_rosters_actions
)
export const api_delete_rosters = fetch.bind(
  null,
  api.delete_rosters,
  delete_rosters_actions
)

export const api_post_add_free_agent = fetch.bind(
  null,
  api.post_add_free_agent,
  post_add_free_agent_actions
)
export const api_post_release = fetch.bind(
  null,
  api.post_release,
  post_release_actions
)

export const api_post_activate = fetch.bind(
  null,
  api.post_activate,
  post_activate_actions
)
export const api_post_deactivate = fetch.bind(
  null,
  api.post_deactivate,
  post_deactivate_actions
)
export const api_post_protect = fetch.bind(
  null,
  api.post_protect,
  post_protect_actions
)
export const api_post_reserve = fetch.bind(
  null,
  api.post_reserve,
  post_reserve_actions
)
export const api_post_tag = fetch.bind(null, api.post_tag, post_tag_actions)
export const api_delete_tag = fetch.bind(
  null,
  api.delete_tag,
  delete_tag_actions
)

export const api_get_draft = fetch.bind(null, api.get_draft, get_draft_actions)
export const api_post_draft = fetch.bind(
  null,
  api.post_draft,
  post_draft_actions
)
export const api_get_draft_pick_details = fetch.bind(
  null,
  api.get_draft_pick_details,
  get_draft_pick_details_actions
)

export const api_get_teams = fetch.bind(null, api.get_teams, get_teams_actions)
export const api_get_transactions = fetch.bind(
  null,
  api.get_transactions,
  get_transactions_actions
)
export const api_get_release_transactions = fetch.bind(
  null,
  api.get_release_transactions,
  get_release_transactions_actions
)
export const api_get_reserve_transactions = fetch.bind(
  null,
  api.get_reserve_transactions,
  get_reserve_transactions_actions
)

export const api_get_matchups = fetch.bind(
  null,
  api.get_matchups,
  get_matchups_actions
)
export const api_post_matchups = fetch.bind(
  null,
  api.post_matchups,
  post_matchups_actions
)

export const api_post_propose_trade = fetch.bind(
  null,
  api.post_propose_trade,
  post_trade_propose_actions
)
export const api_get_trades = fetch.bind(
  null,
  api.get_trades,
  get_trades_actions
)

export const api_post_cancel_trade = fetch.bind(
  null,
  api.post_cancel_trade,
  post_trade_cancel_actions
)
export const api_post_accept_trade = fetch.bind(
  null,
  api.post_accept_trade,
  post_trade_accept_actions
)
export const api_post_reject_trade = fetch.bind(
  null,
  api.post_reject_trade,
  post_trade_reject_actions
)

export const api_get_league = fetch.bind(
  null,
  api.get_league,
  get_league_actions
)
export const api_put_league = fetch.bind(
  null,
  api.put_league,
  put_league_actions
)

export const api_put_team = fetch.bind(null, api.put_team, put_team_actions)
export const api_post_teams = fetch.bind(
  null,
  api.post_teams,
  post_teams_actions
)
export const api_delete_teams = fetch.bind(
  null,
  api.delete_teams,
  delete_teams_actions
)

export const api_get_sources = fetch.bind(
  null,
  api.get_sources,
  get_sources_actions
)
export const api_put_source = fetch.bind(
  null,
  api.put_source,
  put_source_actions
)

export const api_get_players_gamelogs = fetch.bind(
  null,
  api.get_players_gamelogs,
  get_players_gamelogs_actions
)

export const api_put_projection = fetch.bind(
  null,
  api.put_projection,
  put_projection_actions
)
export const api_delete_projection = fetch.bind(
  null,
  api.del_projection,
  del_projection_actions
)

export const api_put_setting = fetch.bind(
  null,
  api.put_setting,
  put_setting_actions
)

export const api_post_waiver = fetch.bind(
  null,
  api.post_waiver,
  post_waiver_actions
)
export const api_put_waiver = fetch.bind(
  null,
  api.put_waiver,
  put_waiver_actions
)
export const api_post_waiver_order = fetch.bind(
  null,
  api.post_waiver_order,
  post_waiver_order_actions
)
export const api_post_cancel_waiver = fetch.bind(
  null,
  api.post_cancel_waiver,
  post_cancel_waiver_actions
)
export const api_post_poach = fetch.bind(
  null,
  api.post_poach,
  post_poach_actions
)
export const api_put_poach = fetch.bind(null, api.put_poach, put_poach_actions)
export const api_get_waivers = fetch.bind(
  null,
  api.get_waivers,
  get_waivers_actions
)
export const api_get_waiver_report = fetch.bind(
  null,
  api.get_waiver_report,
  get_waiver_report_actions
)

export const api_get_schedule = fetch.bind(
  null,
  api.get_schedule,
  get_schedule_actions
)

export const api_get_scoreboard = fetch.bind(
  null,
  api.get_scoreboard,
  get_scoreboard_actions
)

export const api_post_error = fetch.bind(
  null,
  api.post_error,
  post_error_actions
)
export const api_get_status = fetch.bind(
  null,
  api.get_status,
  get_status_actions
)

export const api_get_cutlist = fetch.bind(
  null,
  api.get_cutlist,
  get_cutlist_actions
)
export const api_post_cutlist = fetch.bind(
  null,
  api.post_cutlist,
  post_cutlist_actions
)

export const api_post_restricted_free_agency_tag = fetch.bind(
  null,
  api.post_restricted_free_agency_tag,
  post_restricted_free_agency_tag_actions
)
export const api_delete_restricted_free_agency_tag = fetch.bind(
  null,
  api.delete_restricted_free_agency_tag,
  delete_restricted_free_agency_tag_actions
)
export const api_put_restricted_free_agency_tag = fetch.bind(
  null,
  api.put_restricted_free_agency_tag,
  put_restricted_free_agency_tag_actions
)

export const api_get_player_transactions = fetch.bind(
  null,
  api.get_transactions,
  get_player_transactions_actions
)

export const api_get_baselines = fetch.bind(
  null,
  api.get_baselines,
  get_baselines_actions
)

export const api_get_player_projections = fetch.bind(
  null,
  api.get_player_projections,
  get_player_projections_actions
)

export const api_get_league_team_stats = fetch.bind(
  null,
  api.get_league_team_stats,
  get_league_team_stats_actions
)

export const api_get_player_gamelogs = fetch.bind(
  null,
  api.get_player_gamelogs,
  get_player_gamelogs_actions
)

export const api_get_player_practices = fetch.bind(
  null,
  api.get_player_practices,
  get_player_practices_actions
)

export const api_get_draft_pick_value = fetch.bind(
  null,
  api.get_draft_pick_value,
  get_draft_pick_value_actions
)

export const api_get_percentiles = fetch.bind(
  null,
  api.get_percentiles,
  get_percentiles_actions
)

export const api_get_nfl_team_seasonlogs = fetch.bind(
  null,
  api.get_nfl_team_seasonlogs,
  get_nfl_team_seasonlogs_actions
)

export const api_get_league_team_daily_values = fetch.bind(
  null,
  api.get_league_team_daily_values,
  get_league_team_daily_values_actions
)

export const api_post_process_poach = fetch.bind(
  null,
  api.post_process_poach,
  post_process_poach_actions
)

export const api_post_data_view = fetch.bind(
  null,
  api.post_data_view,
  post_data_view_actions
)

export const api_delete_data_view = fetch.bind(
  null,
  api.delete_data_view,
  delete_data_view_actions
)

export const api_get_data_views = fetch.bind(
  null,
  api.get_data_views,
  get_data_views_actions
)

export const api_get_data_view = fetch.bind(
  null,
  api.get_data_view,
  get_data_view_actions
)

export const api_post_restricted_free_agent_nomination = fetch.bind(
  null,
  api.post_restricted_free_agent_nomination,
  post_restricted_free_agent_nomination_actions
)

export const api_delete_restricted_free_agent_nomination = fetch.bind(
  null,
  api.delete_restricted_free_agent_nomination,
  delete_restricted_free_agent_nomination_actions
)

export const api_get_player_betting_markets = fetch.bind(
  null,
  api.get_player_betting_markets,
  get_player_betting_markets_actions
)

export const api_get_league_careerlogs = fetch.bind(
  null,
  api.get_league_careerlogs,
  get_league_careerlogs_actions
)

export const api_get_season = fetch.bind(
  null,
  api.get_season,
  get_season_actions
)
