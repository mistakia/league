import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc.js'
import { createSelector } from 'reselect'
import Immutable, { Map, List } from 'immutable'

import {
  bookmaker_constants,
  Roster,
  isSlotActive,
  calculatePoints,
  isOnReleaseWaivers,
  getExtensionAmount,
  calculateStatsFromPlayStats,
  calculateDstStatsFromPlays,
  calculate_dst_delta_from_play,
  getYardlineInfoFromString,
  isSantuaryPeriod,
  getDraftDates,
  get_free_agent_period,
  getDraftWindow,
  groupBy,
  fixTeam,
  is_league_post_season_week,
  get_last_consecutive_pick,
  league_has_starting_position,
  get_reserve_eligibility_from_player_map,
  get_default_trade_slot,
  get_game_progress,
  calculate_live_projection,
  optimizeStandingsLineup
} from '@libs-shared'
import {
  current_season,
  roster_slot_types,
  starting_lineup_slots,
  practice_squad_slots,
  practice_squad_protected_slots,
  practice_squad_unprotected_slots,
  transaction_types,
  player_tag_types,
  waiver_types,
  fantasy_positions,
  player_nfl_status,
  all_fantasy_stats,
  base_fantasy_stats,
  default_points_added
} from '@constants'
import { League } from '@core/leagues'
import { fuzzy_search } from '@core/utils'
import { create_matchup } from '@core/matchups'
import { default_player_filter_options } from '@core/players/reducer'
import { Poach } from '@core/poaches/poach'
import { Roster as RosterRecord } from '@core/rosters/roster'
import { create_scoreboard } from '@core/scoreboard'
import { Team } from '@core/teams'
import { create_trade } from '@core/trade'
import { Season } from '@core/seasons'

dayjs.extend(utc)
dayjs.extend(timezone)

export const get_app = (state) => state.get('app')
export const get_router = (state) => state.get('router')
export const get_request_history = (state) =>
  state.getIn(['api', 'request_history'])
export const get_confirmation_info = (state) => state.get('confirmation')
export const get_context_menu_info = (state) => state.get('contextMenu')
export const get_player_maps = (state) => state.getIn(['players', 'items'])
export const get_draft_pick_values = (state) => state.get('draft_pick_value')

export const get_waivers = (state) => state.get('waivers')
export const get_transactions = (state) => state.get('transactions')
export const get_trade = (state) => state.get('trade')
export const get_teams_for_current_year = (state) =>
  state.getIn(['teams', current_season.year], new Map())
export const get_team_by_id_for_year = (
  state,
  { tid, year = current_season.year }
) => state.getIn(['teams', year, tid], new Team())
export const get_team_by_id_for_current_year = (state, { tid }) =>
  state.getIn(['teams', current_season.year, tid], new Team())
export const get_scoreboard = (state) => state.get('scoreboard')
export const get_props = (state) => state.getIn(['props', 'items'])
export const get_plays = (state, { week = current_season.week } = {}) =>
  state.getIn(['plays', week], new Map())
export const get_draft_state = (state) => state.get('draft')
export const get_status = (state) => state.get('status')
export const get_stats_state = (state) => state.get('stats')
export const get_sources_state = (state) => state.get('sources')
export const get_rosters_state = (state) => state.get('rosters')
export const get_source_by_id = (state, { sourceId }) =>
  get_sources_state(state).get(sourceId)
export const get_schedule_state = (state) => state.get('schedule')
export const get_seasonlogs = (state) => state.get('seasonlogs')
export const get_percentiles = (state) => state.get('percentiles')
export const get_notification_info = (state) => state.get('notification')
export const get_matchups_state = (state) => state.get('matchups')
export const get_gamelogs_state = (state) => state.get('gamelogs')
export const get_player_gamelogs = (state) =>
  state.get('gamelogs').get('players').toList()
export const get_player_seasonlogs = (state) =>
  state.getIn(['players', 'player_seasonlogs'], new Map())
export const get_gamelog_by_player_id = (
  state,
  { pid, week, year = current_season.year }
) => state.getIn(['gamelogs', 'players', `${year}/REG/${week}/${pid}`])
export const get_poaches_for_current_league = (state) =>
  state.getIn(['poaches', state.getIn(['app', 'leagueId'])], new Map())
export const get_league_season = (state, { leagueId, year }) =>
  state.getIn(['seasons', leagueId, year], new Season())

export const get_current_league = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  (leagueId, leagues) => {
    return leagues.get(leagueId, new League()).toJS()
  }
)
export const get_current_league_team_ids = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  (leagueId, leagues) => {
    return leagues.getIn([leagueId, 'teams'], new List())
  }
)
export const get_league_by_id = (state, { lid }) =>
  state.get('leagues').get(lid, new League())

export const get_auction_state = (state) => state.get('auction')
export const isTeamConnected = createSelector(
  (state) => state.getIn(['auction', 'connected']),
  (state, { tid }) => tid,
  (connected, tid) => connected.includes(tid)
)

export const get_positions_for_current_league = createSelector(
  get_current_league,
  (league) =>
    fantasy_positions.filter((pos) =>
      league_has_starting_position({ pos, league })
    )
)

export const get_teams_for_current_league_and_year = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.getIn(['app', 'year']),
  (state) => state.get('teams'),
  (leagueId, year, teams) =>
    teams.get(year, new Map()).filter((t) => t.lid === leagueId)
)

export const get_current_team = createSelector(
  (state) => state.getIn(['app', 'teamId']),
  get_teams_for_current_league_and_year,
  (teamId, teams) => teams.get(teamId, new Team())
)

export const get_current_team_roster_record = createSelector(
  get_rosters_state,
  (state) => state.getIn(['app', 'teamId']),
  (rosters, teamId) => {
    return rosters.getIn(
      [teamId, current_season.year, current_season.fantasy_season_week],
      new RosterRecord()
    )
  }
)

export const get_teams_for_current_league = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  get_teams_for_current_year,
  (leagueId, teams) => teams.filter((t) => t.lid === leagueId)
)

export const get_waivers_for_current_team = createSelector(
  (state) => state.getIn(['waivers', 'teams']),
  (state) => state.getIn(['app', 'teamId']),
  (team_waivers, teamId) => team_waivers.get(teamId, new Map())
)

export function get_team_free_agency_auction_bid(state, { tid }) {
  const auction = get_auction_state(state)
  const last = auction.transactions.first()
  if (!last) {
    return null
  }

  const pid = last.pid
  const bid = auction.transactions.find((t) => t.pid === pid && t.tid === tid)
  return bid ? bid.value : null
}

export const get_rosters_for_current_league = createSelector(
  get_rosters_state,
  (state) => state.getIn(['app', 'leagueId']),
  (rosters, leagueId) => {
    const week = Math.min(
      current_season.fantasy_season_week,
      current_season.finalWeek
    )
    const year = current_season.year
    const filtered = rosters.filter((w) => {
      const r = w.getIn([year, week])
      if (!r) return false
      return r.lid === leagueId
    })

    return filtered.map((r) => r.getIn([year, week]))
  }
)

export const get_rostered_player_ids_for_current_league = createSelector(
  get_rosters_for_current_league,
  (rosters) => {
    const pids = []
    for (const roster of rosters.values()) {
      roster.players.forEach(({ pid }) => pids.push(pid))
    }
    return new List(pids)
  }
)

export const get_auction_target_players = createSelector(
  (state) => state.get('players').get('items'),
  get_rostered_player_ids_for_current_league,
  (state) => state.get('auction'),
  get_current_players_for_league,
  (playerMaps, rostered_pids, auction, currentPlayers) => {
    let filtered = playerMaps
    filtered = filtered.filter(
      (pMap) => !rostered_pids.includes(pMap.get('pid'))
    )
    for (const player_map of currentPlayers.active) {
      const pid = player_map.get('pid')
      if (!pid) continue
      filtered = filtered.set(pid, player_map)
    }

    const search = auction.get('search')
    if (search) {
      filtered = filtered.filter((pMap) =>
        fuzzy_search(search, pMap.get('name', ''))
      )
    }
    return filtered.sort(
      (a, b) =>
        b.getIn(['pts_added', '0'], default_points_added) -
        a.getIn(['pts_added', '0'], default_points_added)
    )
  }
)

export const get_active_roster_player_ids_for_current_league = createSelector(
  get_rosters_for_current_league,
  (rosters) => {
    const pids = []
    for (const roster of rosters.values()) {
      roster.players.forEach(({ slot, pid }) => {
        if (isSlotActive(slot)) {
          pids.push(pid)
        }
      })
    }

    return new List(pids)
  }
)

export const get_auction_info_for_position = createSelector(
  (state, { pos }) =>
    get_player_maps(state).filter((pMap) =>
      pos ? pMap.get('pos') === pos : true
    ),
  get_rostered_player_ids_for_current_league,
  get_active_roster_player_ids_for_current_league,
  (playerMaps, rostered_pids, active_roster_pids) => {
    const rostered = playerMaps.filter((pMap) =>
      rostered_pids.includes(pMap.get('pid'))
    )
    const active_rostered = playerMaps.filter((pMap) =>
      active_roster_pids.includes(pMap.get('pid'))
    )

    const available_players_above_baseline = playerMaps.filter(
      (pMap) =>
        pMap.getIn(['pts_added', '0'], 0) > 0 &&
        !rostered_pids.includes(pMap.get('pid'))
    )

    const total_pts_added = playerMaps.reduce(
      (a, b) => a + Math.max(b.getIn(['pts_added', '0']) || 0, 0),
      0
    )
    const rostered_pts_added = rostered.reduce(
      (a, b) => a + Math.max(b.getIn(['pts_added', '0']) || 0, 0),
      0
    )
    const retail = active_rostered.reduce(
      (sum, player_map) =>
        sum + (player_map.getIn(['market_salary', '0']) || 0),
      0
    )
    const actual = active_rostered.reduce(
      (sum, player_map) => sum + (player_map.get('value') || 0),
      0
    )
    return {
      count: {
        total: playerMaps.size,
        rostered: rostered.size,
        total_available_players_above_baseline:
          available_players_above_baseline.size
      },
      pts_added: {
        total: total_pts_added,
        rostered: rostered_pts_added
      },
      value: {
        retail,
        actual
      }
    }
  }
)

export const is_nominated_player_eligible = createSelector(
  (state) => state.getIn(['auction', 'nominated_pid']),
  get_player_maps,
  get_current_team_roster_record,
  get_current_league,
  (pid, playerMaps, roster, league) => {
    if (!pid) {
      return false
    }

    const player_map = playerMaps.get(pid)
    if (!player_map) {
      return false
    }

    const pos = player_map.get('pos')
    if (!pos) {
      return false
    }

    const ros = new Roster({ roster: roster.toJS(), league })
    return ros.has_bench_space_for_position(pos)
  }
)

export const is_free_agent_period = createSelector(
  get_current_league,
  (league) => {
    if (!league.free_agency_live_auction_start) {
      return false
    }

    const faPeriod = get_free_agent_period(league)
    return current_season.now.isBetween(faPeriod.start, faPeriod.end)
  }
)

// export const getPlayersForOptimalLineup = createSelector(
//   (state) => state.get('players'),
//   get_auction_state,
//   (players, auction) => {
//     return auction.lineupPlayers.map((pid) => players.get('items').get(pid))
//   }
// )

export const getPicks = createSelector(
  get_draft_state,
  (state) => state.get('app'),
  (draft, app) => {
    const { picks, draft_start, draft_type, draft_hour_min, draft_hour_max } =
      draft
    const { teamId } = app
    let previousSelected = true
    let previousActive = true
    let previousNotActive = false
    const last_consecutive_pick = get_last_consecutive_pick(picks.toJS())

    return picks
      .sort((a, b) => a.pick - b.pick)
      .map((p) => {
        if (p.pid || (p.tid !== teamId && previousNotActive)) {
          return p
        }

        if (draft_start && draft_type) {
          p.draftWindow = getDraftWindow({
            last_consecutive_pick,
            start: draft_start,
            type: draft_type,
            min: draft_hour_min,
            max: draft_hour_max,
            pickNum: p.pick
          })
        }

        if (previousNotActive) {
          return p
        }

        const isActive =
          current_season.now.isAfter(p.draftWindow) || previousSelected

        previousNotActive = !isActive && previousActive
        previousActive = isActive
        previousSelected = Boolean(p.pid)

        return p
      })
  }
)

export const get_rookie_draft_last_pick = createSelector(
  get_draft_state,
  (draft) => {
    return draft.picks.filter((p) => p.pick).max((a, b) => a.pick > b.pick)
  }
)

export const get_selected_draft_player = createSelector(
  (state) => state.getIn(['draft', 'selected']),
  get_player_maps,
  (pid, playerMaps) => {
    if (!pid) {
      return new Map()
    }

    return playerMaps.get(pid, new Map())
  }
)

export function is_player_drafted(state, { pid, player_map = new Map() }) {
  pid = pid || player_map.get('pid')
  if (!pid) {
    return false
  }

  const { drafted } = state.get('draft')
  return drafted.includes(pid)
}

export const get_rookie_draft_end = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  get_current_league,
  get_rookie_draft_last_pick,
  get_draft_state,
  (league_id, leagues, current_league, last_pick, draft) => {
    if (!last_pick) {
      return null
    }

    const league = leagues.get(league_id, new League())

    // Prioritize explicit completion timestamp when available
    const rookie_draft_completed_at = current_league.rookie_draft_completed_at
    if (rookie_draft_completed_at) {
      return dayjs.unix(rookie_draft_completed_at).tz('America/New_York')
    }

    // Fallback to existing calculation logic
    if (last_pick.selection_timestamp) {
      return dayjs
        .unix(last_pick.selection_timestamp)
        .tz('America/New_York')
        .endOf('day')
    }

    const { picks } = draft
    const last_consecutive_pick = get_last_consecutive_pick(picks.toJS())
    const rookie_draft_end = getDraftWindow({
      last_consecutive_pick,
      start: league.draft_start,
      pickNum: last_pick.pick + 1,
      type: league.draft_type,
      min: league.draft_hour_min,
      max: league.draft_hour_max
    })

    return rookie_draft_end
  }
)

export const is_after_rookie_draft = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  get_rookie_draft_end,
  (league_id, leagues, rookie_draft_end) => {
    if (current_season.isRegularSeason) {
      return {
        after_rookie_draft: true,
        after_rookie_draft_waivers: true
      }
    }

    const league = leagues.get(league_id, new League())
    const after_rookie_draft =
      league.draft_start &&
      rookie_draft_end &&
      dayjs().isAfter(rookie_draft_end)
    const after_rookie_draft_waivers =
      league.draft_start &&
      rookie_draft_end &&
      dayjs().isAfter(rookie_draft_end.add(24, 'hours').endOf('day'))
    return {
      after_rookie_draft,
      after_rookie_draft_waivers
    }
  }
)

export const get_rookie_draft_next_pick = createSelector(
  get_draft_state,
  (state) => state.get('app'),
  get_rookie_draft_last_pick,
  get_current_league,
  (draft, app, lastPick, league) => {
    if (lastPick) {
      const draftDates = getDraftDates({
        start: league.draft_start,
        type: league.draft_type,
        min: league.draft_hour_min,
        max: league.draft_hour_max,
        picks: lastPick.pick, // TODO — should be total number of picks in case some picks are missing due to decommissoned teams
        last_selection_timestamp: lastPick.selection_timestamp
      })

      if (current_season.now.isAfter(draftDates.draftEnd)) {
        return null
      }
    }

    const { draft_start, draft_type, draft_hour_min, draft_hour_max, picks } =
      draft
    const { teamId } = app
    const team_picks = picks
      .filter((p) => p.tid === teamId)
      .sort((a, b) => a.pick - b.pick)
    const pick = team_picks.filter((p) => p.pick).find((p) => !p.pid)
    if (!pick) return null

    const last_consecutive_pick = get_last_consecutive_pick(picks.toJS())
    if (draft_start && draft_type) {
      pick.draftWindow = getDraftWindow({
        last_consecutive_pick,
        start: draft_start,
        type: draft_type,
        min: draft_hour_min,
        max: draft_hour_max,
        pickNum: pick.pick
      })
    }

    return pick
  }
)

// will use the actual pick number if it exists, otherwise use a mid round pick
const get_rookie_draft_pick_rank = ({ pick, round }) => {
  if (pick) {
    return pick
  }

  switch (round) {
    case 1:
      return 6
    case 2:
      return 18
    case 3:
      return 36
    case 4:
      return 50
    default:
      return 60
  }
}

function get_draft_pick_value(values, pick) {
  const rank = get_rookie_draft_pick_rank(pick)
  const item = values.find((value) => value.rank === rank)

  if (!item) {
    return 0
  }

  const avg =
    (3 * item.median_best_season_points_added_per_game +
      item.median_career_points_added_per_game) /
    4
  const weeks_remaining =
    current_season.finalWeek - current_season.fantasy_season_week

  return avg * weeks_remaining
}

export const get_draft_pick_value_by_pick = createSelector(
  get_draft_pick_values,
  (state, { pick }) => pick,
  get_draft_pick_value
)

export const is_before_extension_deadline = createSelector(
  (state) =>
    state.getIn(['leagues', state.getIn(['app', 'leagueId']), 'ext_date']),
  (ext_date) => {
    if (!ext_date) {
      return true
    }

    const deadline = dayjs.unix(ext_date)
    return current_season.now.isBefore(deadline)
  }
)

export const is_before_restricted_free_agency_start = createSelector(
  (state) =>
    state.getIn(['leagues', state.getIn(['app', 'leagueId']), 'tran_start']),
  (tran_start) => {
    if (!tran_start) {
      return false
    }

    const deadline = dayjs.unix(tran_start)
    return current_season.now.isBefore(deadline)
  }
)

export const is_before_restricted_free_agency_end = createSelector(
  (state) =>
    state.getIn(['leagues', state.getIn(['app', 'leagueId']), 'tran_end']),
  (tran_end) => {
    if (!tran_end) {
      return false
    }

    const deadline = dayjs.unix(tran_end)
    return current_season.now.isBefore(deadline)
  }
)

export const is_restricted_free_agency_period = createSelector(
  is_before_restricted_free_agency_start,
  is_before_restricted_free_agency_end,
  (isBeforeStart, isBeforeEnd) => {
    return !isBeforeStart && isBeforeEnd
  }
)

export const get_league_events = createSelector(
  get_current_league,
  get_rookie_draft_last_pick,
  (league, lastPick) => {
    const events = []
    const now = dayjs()

    if (league.ext_date) {
      const ext_date = dayjs.unix(league.ext_date)
      if (now.isBefore(ext_date)) {
        events.push({
          detail: 'Extension Deadline',
          date: ext_date
        })
      }
    }

    if (league.tran_start) {
      const tran_start = dayjs.unix(league.tran_start)
      if (now.isBefore(tran_start)) {
        events.push({
          detail: 'Restricted FA Begins',
          date: tran_start
        })
      }
    }

    if (league.tran_end) {
      const tran_end = dayjs.unix(league.tran_end)
      if (now.isBefore(tran_end)) {
        events.push({
          detail: 'Restricted FA Ends',
          date: tran_end
        })
      }
    }

    if (league.draft_start) {
      const draft_start = dayjs.unix(league.draft_start)
      if (now.isBefore(draft_start)) {
        events.push({
          detail: 'Rookie Draft Begins',
          date: draft_start
        })
      }

      if (lastPick) {
        const draftDates = getDraftDates({
          start: league.draft_start,
          type: league.draft_type,
          min: league.draft_hour_min,
          max: league.draft_hour_max,
          picks: lastPick.pick, // TODO — should be total number of picks in case some picks are missing due to decommissoned teams
          last_selection_timestamp: lastPick.selection_timestamp
        })

        if (now.isBefore(draftDates.draftEnd)) {
          events.push({
            detail: 'Rookie Draft Ends',
            date: draftDates.draftEnd
          })
        }

        if (now.isBefore(draftDates.waiverEnd)) {
          events.push({
            detail: 'Rookie Waivers Clear',
            date: draftDates.waiverEnd
          })
        }
      }
    }

    const firstDayOfRegularSeason = current_season.regular_season_start.add(
      '1',
      'week'
    )
    if (now.isBefore(firstDayOfRegularSeason)) {
      events.push({
        detail: 'Regular Season Begins',
        date: firstDayOfRegularSeason
      })
    }

    const firstWaiverDate = current_season.regular_season_start
      .add('1', 'week')
      .day(3)
      .hour(15)
    if (now.isBefore(firstWaiverDate)) {
      events.push({
        detail: 'Regular Season Waivers Clear',
        date: firstWaiverDate
      })
    } else if (current_season.isRegularSeason) {
      const waiverDate = current_season.now.day(3).hour(15).minute(0)
      const nextWaiverDate = now.isBefore(waiverDate)
        ? waiverDate
        : waiverDate.add('1', 'week')

      events.push({
        detail: 'Waivers Processed',
        date: nextWaiverDate
      })
    }

    if (now.isBefore(current_season.openingDay)) {
      events.push({
        detail: 'NFL Opening Day',
        date: current_season.openingDay
      })
    }

    if (league.free_agency_live_auction_start) {
      const faPeriod = get_free_agent_period(league)
      const date = dayjs.unix(league.free_agency_live_auction_start)
      if (now.isBefore(date)) {
        if (now.isBefore(faPeriod.start)) {
          events.push({
            detail: 'Free Agency Period Begins',
            date: faPeriod.start
          })
        }

        events.push({
          detail: 'Auction',
          date
        })
      }

      if (league.free_agency_live_auction_end) {
        const next_waiver_processing = now.hour() < 15 ? now : now.add(1, 'day')
        const waiver_processing_time = next_waiver_processing
          .hour(15)
          .minute(0)
          .second(0)

        // Only show daily waiver processing if we're after the live auction has ended
        // and the waiver processing time is before the free agency period ends
        if (
          faPeriod.free_agency_live_auction_end &&
          now.isAfter(faPeriod.free_agency_live_auction_end) &&
          now.isBefore(faPeriod.end) &&
          now.isBefore(waiver_processing_time) &&
          waiver_processing_time.isBefore(faPeriod.end)
        ) {
          events.push({
            detail: 'Waivers Processed',
            date: waiver_processing_time
          })
        }
      }

      if (now.isBefore(faPeriod.end)) {
        events.push({
          detail: 'Free Agency Period Ends',
          date: faPeriod.end
        })
      }
    }

    if (league.tddate) {
      const date = dayjs.unix(league.tddate)
      if (now.isBefore(date)) {
        events.push({
          detail: 'Trade Deadline',
          date
        })
      }
    }

    if (now.isBefore(current_season.end)) {
      events.push({
        detail: 'Offseason Begins',
        date: current_season.end
      })
    }

    return events.sort((a, b) => a.date.unix() - b.date.unix())
  }
)

export const get_regular_season_weeks = createSelector(
  (state) => state.getIn(['matchups', 'matchups_by_id']).toList(),
  (state) => state.getIn(['app', 'year'], current_season.year),
  (matchups, year) =>
    matchups
      .filter((m) => m.year === year)
      .map((m) => m.week)
      .sort((a, b) => a - b)
)

export const get_post_season_weeks = createSelector(
  (state) => state.getIn(['matchups', 'playoffs']),
  (state) => state.getIn(['app', 'year'], current_season.year),
  (playoffs, year) =>
    playoffs
      .filter((m) => m.year === year)
      .map((m) => m.week)
      .sort((a, b) => a - b)
)

export const get_weeks_for_selected_year_matchups = createSelector(
  get_regular_season_weeks,
  get_post_season_weeks,
  (regular_season_weeks, post_season_weeks) => {
    return [...new Set([...regular_season_weeks, ...post_season_weeks])]
  }
)

export function get_matchup_by_id(state, { matchupId }) {
  const matchups = state.get('matchups')
  return matchups.getIn(['matchups_by_id', matchupId], create_matchup())
}

export function get_filtered_matchups(state) {
  const matchups = state.get('matchups')
  const items = matchups.get('matchups_by_id').toList()
  const teams = matchups.get('teams')
  const weeks = matchups.get('weeks')
  const year = state.getIn(['app', 'year'], current_season.year)
  const filtered = items.filter((m) => {
    // Always apply year filter first
    if (m.year !== year) return false

    // Apply team filter if teams are selected
    if (teams.size > 0) {
      if (!teams.includes(m.aid) && !teams.includes(m.hid)) return false
    }

    // Apply week filter if weeks are selected
    if (weeks.size > 0) {
      if (!weeks.includes(m.week)) return false
    }

    return true
  })
  return filtered
}

export function get_selected_matchup(state) {
  const matchups = state.get('matchups')
  const matchupId = matchups.get('selected')
  if (!matchupId) return create_matchup()

  // TODO - fix / derive based on season schedule
  const year = state.getIn(['app', 'year'], current_season.year)
  const week = state.getIn(['scoreboard', 'week'])
  if (is_league_post_season_week({ year, week })) {
    const items = matchups.get('playoffs')
    return (
      items.find((m) => m.uid === matchupId && m.year === year) ||
      create_matchup()
    )
  } else {
    return matchups.getIn(['matchups_by_id', matchupId], create_matchup())
  }
}

export function get_selected_matchup_teams(state) {
  const matchup = get_selected_matchup(state)
  const teams = matchup.tids.map((tid) =>
    get_team_by_id_for_year(state, { tid, year: matchup.year })
  )
  if (matchup.week === current_season.finalWeek) {
    const prevWeek = current_season.finalWeek - 1
    return teams.map((teamRecord) => {
      const previousWeekScore = getPointsByTeamId(state, {
        tid: teamRecord.uid,
        week: prevWeek
      })
      return { previousWeekScore, ...teamRecord.toJS() }
    })
  }
  return teams
}

export function get_matchups_for_selected_week(state) {
  const matchups = state.getIn(['matchups', 'matchups_by_id']).toList()
  const week = state.getIn(['scoreboard', 'week'])
  const year = state.getIn(['app', 'year'], current_season.year)
  return matchups.filter((m) => m.week === week && m.year === year)
}

export function get_matchup_by_team_id(state, { tid, year, week }) {
  const playoffs = state.getIn(['matchups', 'playoffs'])

  // first check if week is in playoffs
  const playoff_matchup = playoffs.find(
    (m) => m.year === year && m.week === week
  )
  if (playoff_matchup) {
    if (!tid) {
      return playoff_matchup
    }

    return (
      playoffs.find(
        (m) => m.year === year && m.week === week && m.tids.includes(tid)
      ) || playoff_matchup
    )
  }

  const matchups = state.getIn(['matchups', 'matchups_by_id']).toList()
  return (
    matchups.find(
      (m) =>
        m.year === year && m.week === week && (m.hid === tid || m.aid === tid)
    ) || create_matchup()
  )
}

export function get_players_state(state) {
  return state.get('players')
}

export const get_selected_players_page_view = createSelector(
  (state) => state.getIn(['players', 'selected_players_page_view']),
  (state) => state.getIn(['players', 'players_page_views'], new Map()),
  (selected_players_page_view, players_page_views) =>
    players_page_views.get(selected_players_page_view)
)

export function getBaselines(state) {
  const result = state.getIn(['players', 'baselines'])
  const playerMaps = get_player_maps(state)
  return result.withMutations((b) => {
    for (const [week, positions] of b.entrySeq()) {
      // TODO document this
      if (fantasy_positions.includes(week)) continue
      for (const [position, baselines] of positions.entrySeq()) {
        for (const [baseline, pid] of baselines.entrySeq()) {
          b.setIn([week, position, baseline], playerMaps.get(pid))
        }
      }
    }
  })
}

export const get_restricted_free_agency_players = createSelector(
  get_player_maps,
  (playerMaps) =>
    playerMaps.filter(
      (pMap) => pMap.get('tag') === player_tag_types.RESTRICTED_FREE_AGENCY
    )
)

export function get_cutlist_players(state) {
  const cutlist = state.getIn(['players', 'cutlist'])
  return cutlist.map((pid) => getPlayerById(state, { pid }))
}

export function get_cutlist_total_salary(state) {
  const playerMaps = get_cutlist_players(state)
  const league = get_current_league(state)
  const isBeforeExtension = is_before_extension_deadline(state)

  return playerMaps.reduce((sum, player_map) => {
    const value = player_map.get('value')
    const extensions = player_map.get('extensions', 0)
    const bid = player_map.get('bid', 0)
    const salary = isBeforeExtension
      ? getExtensionAmount({
          pos: player_map.get('pos'),
          tag: player_map.get('tag'),
          extensions,
          league,
          value,
          bid
        })
      : bid || value

    return sum + salary
  }, 0)
}

export function getSelectedPlayer(state) {
  const pid = get_players_state(state).get('selected')
  return getPlayerById(state, { pid })
}

export function getSelectedPlayerGame(state, { week }) {
  const player_map = getSelectedPlayer(state)
  return get_game_by_team(state, { nfl_team: player_map.get('team'), week })
}

export function getSelectedPlayerGames(state) {
  const player_map = getSelectedPlayer(state)
  return getGamesByTeam(state, { nfl_team: player_map.get('team') })
}

// used by editable baseline component
export function getPlayersByPosition(state, { position }) {
  const playerMaps = get_player_maps(state)
  const filtered = playerMaps.filter((p) => p.pos === position)
  const period = !current_season.week ? '0' : 'ros'
  return filtered
    .sort(
      (a, b) =>
        b.getIn(['points', period, 'total']) -
        a.getIn(['points', period, 'total'])
    )
    .toList()
}

export const getRookiePlayers = createSelector(get_player_maps, (playerMaps) =>
  playerMaps
    .filter((pMap) => pMap.get('nfl_draft_year') === current_season.year)
    .toList()
)

export function getPlayerById(state, { pid, player_map }) {
  if (player_map) return player_map
  const playerMaps = get_player_maps(state)
  return playerMaps.get(pid, Map())
}

export function getGamesByYearForSelectedPlayer(state) {
  const pid = state.get('players').get('selected')
  const player_map = getPlayerById(state, { pid })
  const gamelogs = get_player_gamelogs(state)
  const games = gamelogs.filter((p) => p.pid === pid && p.seas_type === 'REG')

  const years = {}
  for (const game of games) {
    if (!years[game.year]) years[game.year] = []
    years[game.year].push(game)
  }

  // sum yearly values
  const { leagueId } = get_app(state)
  const league = state.get('leagues').get(leagueId)
  const overall = {}
  for (const year in years) {
    const initialValue = {}
    for (const stat of all_fantasy_stats) {
      initialValue[stat] = 0
    }

    const sum = years[year].reduce((sums, obj) => {
      const stats = Object.keys(obj).filter((k) =>
        base_fantasy_stats.includes(k)
      )
      stats.forEach((k) => {
        sums[k] += obj[k] || 0
      })
      return sums
    }, initialValue)
    const points = calculatePoints({
      stats: sum,
      position: player_map.get('pos'),
      league: league.toJS()
    })
    sum.total = points.total
    overall[year] = sum
  }

  return { years, overall }
}

export function get_player_seasonlogs_for_selected_player(state) {
  const pid = state.getIn(['players', 'selected'])
  if (!pid) return new List()
  return state.getIn(['players', 'player_seasonlogs', pid], new List())
}

export const isPlayerOnReleaseWaivers = createSelector(
  getReleaseTransactions,
  (state, { pid }) => pid,
  (transactions, pid) => {
    const player_transactions = transactions.filter((t) => t.pid === pid).toJS()
    return isOnReleaseWaivers({ transactions: player_transactions })
  }
)

export function isPlayerLocked(state, { player_map = new Map(), pid }) {
  if (current_season.week > current_season.finalWeek) {
    return true
  }

  if (pid) {
    player_map = getPlayerById(state, { pid })
  }

  if (!player_map.get('pid')) {
    return false
  }

  if (player_map.get('roster_status') === player_nfl_status.INACTIVE) {
    return false
  }

  const game = get_game_by_team(state, { nfl_team: player_map.get('team') })
  if (!game) {
    return false
  }

  const gameStart = dayjs.tz(
    `${game.date} ${game.time_est}`,
    'YYYY/MM/DD HH:mm:SS',
    'America/New_York'
  )
  if (dayjs().isAfter(gameStart)) {
    return true
  }

  return false
}

export function getPlayerStatus(state, { player_map = new Map(), pid }) {
  if (pid) {
    player_map = getPlayerById(state, { pid })
  }

  const status = {
    locked: false, // TODO
    starter: false,
    fa: false,
    rostered: false,
    protected: false,
    active: false,
    bid: null,
    tagged: {
      rookie: false,
      restrictedFreeAgency: false,
      franchise: false,
      restricted_free_agency_nominated: false,
      restricted_free_agency_announced: false
    },
    waiver: {
      active: false,
      practice: false,
      poach: false
    },
    sign: {
      active: false,
      practice: false
    },
    eligible: {
      protect: false,
      activate: false,
      ps: false,
      poach: false,
      rookieTag: false,
      restrictedFreeAgencyTag: false,
      restrictedFreeAgencyBid: false
    },
    reserve: {
      reserve_short_term_eligible: false,
      reserve_long_term_eligible: false,
      covid: false
    }
  }

  if (!player_map.get('pid')) {
    return status
  }

  const league = get_current_league(state)
  const playerTag = player_map.get('tag')
  const playerSlot = player_map.get('slot')
  const playerId = player_map.get('pid')
  const bid = player_map.get('bid')
  status.restricted_free_agent_bid_exists =
    bid !== null && bid !== undefined && Number(bid) >= 0
  status.tagged.rookie = playerTag === player_tag_types.ROOKIE
  status.tagged.restrictedFreeAgency =
    playerTag === player_tag_types.RESTRICTED_FREE_AGENCY
  status.tagged.franchise = playerTag === player_tag_types.FRANCHISE
  status.protected =
    playerSlot === roster_slot_types.PSP ||
    playerSlot === roster_slot_types.PSDP
  status.starter = starting_lineup_slots.includes(playerSlot)
  status.locked = isPlayerLocked(state, { player_map })
  status.active = isSlotActive(playerSlot)

  const isFreeAgent = isPlayerFreeAgent(state, { player_map })
  status.fa = isFreeAgent
  if (isFreeAgent) {
    const { isWaiverPeriod, isRegularSeason } = current_season
    if (isRegularSeason && isWaiverPeriod) {
      status.waiver.active = true
      const isPracticeSquadEligible = isPlayerPracticeSquadEligible(state, {
        player_map
      })
      if (isPracticeSquadEligible) status.waiver.practice = true
    } else if (is_free_agent_period(state)) {
      status.waiver.active = true
      status.waiver.practice = true
    } else {
      const onReleaseWaivers = isPlayerOnReleaseWaivers(state, {
        pid: playerId
      })
      const rookie_draft_dates = is_after_rookie_draft(state)
      const isPracticeSquadEligible = isPlayerPracticeSquadEligible(state, {
        player_map
      })
      if (onReleaseWaivers) {
        if (isRegularSeason) status.waiver.active = true
        if (rookie_draft_dates.after_rookie_draft && isPracticeSquadEligible)
          status.waiver.practice = true
      } else {
        if (isRegularSeason && !status.locked) {
          status.sign.active = true
        }
        if (isPracticeSquadEligible && !status.locked) {
          if (rookie_draft_dates.after_rookie_draft_waivers)
            status.sign.practice = true
          else if (rookie_draft_dates.after_rookie_draft)
            status.waiver.practice = true
        }
      }
    }
  } else {
    const roster = getCurrentTeamRoster(state)

    const restricted_free_agency_tag_processed = player_map.get(
      'restricted_free_agency_tag_processed'
    )

    if (
      status.tagged.restrictedFreeAgency &&
      !restricted_free_agency_tag_processed
    ) {
      status.eligible.restrictedFreeAgencyBid = true
    }

    status.tagged.restricted_free_agency_nominated = player_map.get(
      'restricted_free_agency_tag_nominated'
    )
    status.tagged.restricted_free_agency_announced = player_map.get(
      'restricted_free_agency_tag_announced'
    )

    if (roster.has(playerId)) {
      status.rostered = true

      // if before extension deadline
      //     was player a rookie last year
      //     otherwise are they a rookie now
      const isBeforeExtension = is_before_extension_deadline(state)
      const draft_year = player_map.get('nfl_draft_year')
      if (isBeforeExtension && draft_year === current_season.year - 1) {
        status.eligible.rookieTag = true
      } else if (draft_year === current_season.year) {
        status.eligible.rookieTag = true
      }

      if (current_season.week > 0 || isBeforeExtension) {
        status.eligible.franchiseTag = true
      }

      const has_available_restricted_tag = roster.hasUnprocessedRestrictedTag()
      const isBeforeRestrictedFreeAgency =
        is_before_restricted_free_agency_end(state)
      status.eligible.restrictedFreeAgencyTag =
        isBeforeRestrictedFreeAgency &&
        has_available_restricted_tag &&
        !restricted_free_agency_tag_processed

      const isActive = Boolean(
        roster.active.find(({ pid }) => pid === playerId)
      )
      if (!isActive) {
        // can not activate long term reserve player during regular season
        status.eligible.activate = !(
          current_season.isRegularSeason &&
          playerSlot === roster_slot_types.RESERVE_LONG_TERM
        )

        // is regular season and is on practice squad && has no poaching claims
        const leaguePoaches = get_poaches_for_current_league(state)
        if (
          current_season.isRegularSeason &&
          (playerSlot === roster_slot_types.PS ||
            playerSlot === roster_slot_types.PSD) &&
          !leaguePoaches.has(playerId)
        ) {
          status.eligible.protect = true
        }
      }

      if (isPlayerPracticeSquadEligible(state, { player_map })) {
        status.eligible.ps = true
      }

      if (
        !status.protected &&
        current_season.week <= current_season.finalWeek
      ) {
        const reserve = get_reserve_eligibility_from_player_map({ player_map })

        // For practice squad players, only allow reserve if they have active poaching claim
        const isPracticeSquad =
          playerSlot === roster_slot_types.PS ||
          playerSlot === roster_slot_types.PSD
        let practiceSquadReserveEligible = true
        if (isPracticeSquad) {
          const leaguePoaches = get_poaches_for_current_league(state)
          practiceSquadReserveEligible = leaguePoaches.has(playerId)
        }

        if (
          reserve.reserve_short_term_eligible &&
          playerSlot !== roster_slot_types.RESERVE_SHORT_TERM &&
          playerSlot !== roster_slot_types.RESERVE_LONG_TERM &&
          practiceSquadReserveEligible
        ) {
          status.reserve.reserve_short_term_eligible = true
        }

        if (
          reserve.reserve_short_term_eligible &&
          playerSlot !== roster_slot_types.RESERVE_LONG_TERM &&
          practiceSquadReserveEligible
        ) {
          status.reserve.reserve_long_term_eligible = true
        }

        if (
          reserve.cov &&
          playerSlot !== roster_slot_types.COV &&
          current_season.isRegularSeason &&
          practiceSquadReserveEligible
        ) {
          status.reserve.cov = true
        }
      }
    } else if (isPlayerOnPracticeSquad(state, { player_map })) {
      const is_sanctuary_period = isSantuaryPeriod(league)
      // make sure player is unprotected and it is not a santuary period
      if (
        playerSlot === roster_slot_types.PS ||
        playerSlot === roster_slot_types.PSD
      ) {
        const roster_info = getRosterInfoForPlayerId(state, {
          pid: playerId
        })
        const sanctuary_end = dayjs
          .unix(roster_info.timestamp)
          .add('24', 'hours')
        const waiver_period_end = dayjs
          .unix(roster_info.timestamp)
          .add('24', 'hours')

        // check if player has existing poaching claim and is after sanctuary period
        const league_poaches = get_poaches_for_current_league(state)
        if (
          !league_poaches.has(playerId) &&
          dayjs().isAfter(sanctuary_end) &&
          !is_sanctuary_period
        ) {
          status.eligible.poach = true
        }

        // waiver period overlaps with sanctuary period (both 24 hours)
        if (
          ((roster_info.type === transaction_types.ROSTER_DEACTIVATE ||
            roster_info.type === transaction_types.DRAFT ||
            roster_info.type === transaction_types.PRACTICE_ADD) &&
            dayjs().isBefore(waiver_period_end)) ||
          is_sanctuary_period
        ) {
          status.waiver.poach = true
        }
      }
    }
  }

  return status
}

export function isPlayerPracticeSquadEligible(
  state,
  { player_map = new Map() }
) {
  const pid = player_map.get('pid')
  if (!pid) {
    return false
  }

  const acceptable_types = [
    transaction_types.ROSTER_ADD,
    transaction_types.TRADE,
    transaction_types.DRAFT,
    transaction_types.RESERVE_IR,
    transaction_types.RESERVE_COV
  ]
  const type = player_map.get('type')
  if (type && !acceptable_types.includes(type)) {
    return false
  }

  const rosterInfo = getRosterInfoForPlayerId(state, { pid })

  // if player is a FA during the offseason, they must be either:
  // - a rookie
  // - not on a nfl team
  if (
    !rosterInfo.tid && // not on a team
    !current_season.isRegularSeason && // during the offseason
    player_map.get('nfl_draft_year') !== current_season.year && // not a rookie
    player_map.get('team') !== 'INA' // not on a nfl team
  ) {
    return false
  }

  const { teamId } = get_app(state)

  // not eligible if already on another team
  if (rosterInfo.tid && rosterInfo.tid !== teamId) {
    return false
  }

  // not eligible if already on pracice squad
  const onPracticeSquad = isPlayerOnPracticeSquad(state, { player_map })
  if (onPracticeSquad) {
    return false
  }

  const rosterRec = get_current_team_roster_record(state)
  const rosterPlayers = rosterRec.get('players')
  const rosterPlayer = rosterPlayers.find((p) => p.pid === pid)

  if (!rosterPlayer) {
    return true
  }

  // not eligible if player is on long term reserve
  if (rosterPlayer.slot === roster_slot_types.RESERVE_LONG_TERM) {
    return false
  }

  // not eligible if player has been on active roster for more than 48 hours
  const cutoff = dayjs.unix(rosterPlayer.timestamp).add('48', 'hours')
  if (isSlotActive(rosterPlayer.slot) && dayjs().isAfter(cutoff)) {
    return false
  }

  const transactions = getReserveTransactionsByPlayerId(state, { pid })

  // not eligible if activated previously
  const activations = transactions.filter(
    (t) => t.type === transaction_types.ROSTER_ACTIVATE
  )
  if (activations.size) {
    return false
  }

  // not eligible if player has been poached
  const poaches = transactions.filter(
    (t) => t.type === transaction_types.POACHED
  )
  if (poaches.size) {
    return false
  }

  // if reserve player, must have been on practice squad previously
  const ps_types = [
    transaction_types.ROSTER_DEACTIVATE,
    transaction_types.PRACTICE_ADD,
    transaction_types.DRAFT
  ]
  if (rosterInfo.slot === roster_slot_types.RESERVE_SHORT_TERM) {
    for (const tran of transactions.values()) {
      if (ps_types.includes(tran.type)) {
        break
      }

      if (
        tran.type === transaction_types.ROSTER_ADD ||
        tran.type === transaction_types.TRADE
      ) {
        return false
      }
    }
  }

  return true
}

export const getPlayersForWatchlist = createSelector(
  get_players_state,
  (players) => {
    return players
      .get('watchlist')
      .toList()
      .map((pid) => players.get('items').get(pid) || new Map())
  }
)

export function is_player_filter_options_changed(state) {
  const player_state = state.get('players')
  const option_fields = Object.keys(default_player_filter_options)

  for (const field of option_fields) {
    const field_value = player_state.get(field)
    if (!Immutable.is(field_value, default_player_filter_options[field])) {
      return true
    }
  }

  return false
}

export function get_plays_for_player(state, { player_map, week }) {
  const plays = get_plays(state, { week })
  const formatted = plays.valueSeq().toList()

  const playerTeam = player_map.get('team')
  if (player_map.get('pos') === 'DST') {
    return formatted.filter((p) => {
      if (fixTeam(p.h) !== playerTeam && fixTeam(p.v) !== playerTeam) {
        return false
      }

      return (
        (Boolean(p.pos_team) &&
          fixTeam(p.pos_team) !== player_map.get('pid')) ||
        p.play_type_nfl === 'PUNT' ||
        p.play_type_nfl === 'KICK_OFF' ||
        p.play_type_nfl === 'XP_KICK'
      )
    })
  }

  let filtered = new List()
  for (const play of formatted.valueSeq()) {
    const pos = play.pos_team
    if (
      !pos ||
      (fixTeam(pos) !== playerTeam &&
        play.play_type_nfl !== 'PUNT' &&
        play.play_type_nfl !== 'KICK_OFF' &&
        play.play_type_nfl !== 'XP_KICK')
    )
      continue

    const playStats = play.playStats.filter(
      (ps) =>
        (ps.gsisId && ps.gsisId === player_map.get('gsisid')) ||
        (ps.gsispid && ps.gsispid === player_map.get('gsispid'))
    )

    if (!playStats.length) continue

    filtered = filtered.push({
      ...play,
      playStats
    })
  }
  return filtered
}

export const getPoachById = createSelector(
  get_poaches_for_current_league,
  (state, { poachId }) => poachId,
  (poaches, poachId) => {
    return poaches.find((p) => p.uid === poachId) || new Poach()
  }
)

export function getPoachReleasePlayers(state, { poachId }) {
  const poach = getPoachById(state, { poachId })
  return poach.release.map((pid) => getPlayerById(state, { pid }))
}

export function get_active_poaches_against_my_players(state) {
  const poaches = get_poaches_for_current_league(state)
  const players = get_current_players_for_league(state)
  const pids = players.practice.map((pMap) => pMap.get('pid'))
  return poaches.filter((p) => pids.includes(p.pid))
}

export function getPoachPlayersForCurrentTeam(state) {
  const poaches = get_poaches_for_current_league(state)
  const { teamId } = get_app(state)

  const poachPlayers = []
  for (const poach of poaches.valueSeq()) {
    if (poach.tid !== teamId) continue
    const pid = poach.pid
    const player_map = getPlayerById(state, { pid })
    poachPlayers.push(poach.set('player_map', player_map))
  }

  return new List(poachPlayers)
}

export function get_poach_players_for_current_league(state) {
  let poaches = get_poaches_for_current_league(state)

  for (const poach of poaches.values()) {
    const pid = poach.pid

    if (poach.processed) {
      poaches = poaches.delete(pid)
      continue
    }

    const player_map = getPlayerById(state, { pid })

    const slot = player_map.get('slot')
    if (slot !== roster_slot_types.PS && slot !== roster_slot_types.PSD) {
      poaches = poaches.delete(pid)
      continue
    }

    poaches = poaches.setIn([pid, 'player_map'], player_map)
    if (poach.release.size) {
      const releases = []
      for (const pid of poach.release) {
        const player_map = getPlayerById(state, { pid })
        releases.push(player_map)
      }
      poaches = poaches.setIn([pid, 'release'], new List(releases))
    }
  }

  return poaches.valueSeq().toList()
}

export function getFilteredProps(state) {
  const props = get_props(state)

  // filter props

  const items = props.toJS()

  for (const prop of items) {
    const player_map = getPlayerById(state, { pid: prop.pid })
    const proj = player_map.getIn(['projection', `${prop.week}`], {})
    switch (prop.prop_type) {
      case bookmaker_constants.player_prop_types.GAME_PASSING_YARDS:
        prop.proj = proj.py
        break

      case bookmaker_constants.player_prop_types.GAME_RECEIVING_YARDS:
        prop.proj = proj.recy
        break

      case bookmaker_constants.player_prop_types.GAME_RUSHING_YARDS:
        prop.proj = proj.ry
        break

      case bookmaker_constants.player_prop_types.GAME_PASSING_COMPLETIONS:
        prop.proj = proj.pc
        break

      case bookmaker_constants.player_prop_types.GAME_PASSING_TOUCHDOWNS:
        prop.proj = proj.tdp
        break

      case bookmaker_constants.player_prop_types.GAME_RECEPTIONS:
        prop.proj = proj.rec
        break

      case bookmaker_constants.player_prop_types.GAME_PASSING_INTERCEPTIONS:
        prop.proj = proj.ints
        break

      case bookmaker_constants.player_prop_types.GAME_RUSHING_ATTEMPTS:
        prop.proj = proj.ra
        break

      case bookmaker_constants.player_prop_types.ANYTIME_TOUCHDOWN:
        prop.proj = proj.tdr + proj.tdrec
        break

      case bookmaker_constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS:
        prop.proj = proj.ry + proj.recy
        break

      case bookmaker_constants.player_prop_types.GAME_PASSING_ATTEMPTS:
        prop.proj = proj.pa
        break

      case bookmaker_constants.player_prop_types.GAME_RUSHING_TOUCHDOWNS:
        prop.proj = proj.tdr
        break

      case bookmaker_constants.player_prop_types.GAME_RECEIVING_TOUCHDOWNS:
        prop.proj = proj.tdrec
        break

      default:
        console.log(`unrecognized betype: ${prop.prop_type}`)
    }

    prop.diff = prop.proj - prop.ln
    prop.abs = Math.abs(prop.diff)
  }

  return items.sort((a, b) => b.abs - a.abs)
}

export const getRosterRecordByTeamId = createSelector(
  get_rosters_state,
  (state, { tid }) => tid,
  (
    state,
    {
      week = Math.min(
        current_season.fantasy_season_week,
        current_season.finalWeek
      )
    }
  ) => week,
  (state, { year = current_season.year }) => year,
  (rosters, tid, week, year) =>
    rosters.getIn([tid, year, week]) || new RosterRecord()
)

export const getRosterByTeamId = createSelector(
  getRosterRecordByTeamId,
  get_current_league,
  (rec, league) => new Roster({ roster: rec.toJS(), league })
)

export const getPlayersByTeamId = createSelector(
  getRosterByTeamId,
  (state) => state.get('players').get('items'),
  (roster, players) =>
    roster.all.map(({ pid, slot }) => {
      const player_map = players.get(pid, new Map())
      // Enrich with slot information from roster for accurate slot display
      return slot !== undefined ? player_map.set('slot', slot) : player_map
    })
)

export function getStartersByTeamId(state, { tid, week }) {
  const roster = getRosterByTeamId(state, { tid, week })
  return roster.starters.map(({ pid, slot }) => {
    const player_map = getPlayerById(state, { pid })
    return player_map.set('slot', slot)
  })
}

export function getActivePlayersByTeamId(
  state,
  { tid, week = current_season.fantasy_season_week }
) {
  const roster = getRosterByTeamId(state, { tid, week })
  // Include both active roster players and practice squad players for trades
  // Set the slot from the roster (important for practice squad players)
  const active_players = roster.active.map(({ pid, slot }) => {
    const player_map = getPlayerById(state, { pid })
    return player_map.set('slot', slot)
  })
  const practice_players = roster.practice.map(({ pid, slot }) => {
    const player_map = getPlayerById(state, { pid })
    return player_map.set('slot', slot)
  })

  const all_players = active_players.concat(practice_players)
  // Filter out any undefined/null players (in case player data isn't loaded yet)
  const filtered_players = all_players.filter((p) => p && p.size > 0)

  return filtered_players
}

export function getAvailableSalarySpaceForCurrentLeague(state) {
  const rosters = get_rosters_for_current_league(state)
  const league = get_current_league(state)
  let available_salary_space = 0
  for (const roster of rosters.valueSeq()) {
    const r = new Roster({ roster: roster.toJS(), league })
    available_salary_space += r.availableCap
  }

  return available_salary_space
}

export function getAvailablePlayersForCurrentLeague(state) {
  const rostered_pids = get_rostered_player_ids_for_current_league(state)
  const playerMaps = get_player_maps(state)
  return playerMaps.filter((pMap) => !rostered_pids.includes(pMap.get('pid')))
}

export function getActivePlayersByRosterForCurrentLeague(state) {
  const rosters = get_rosters_for_current_league(state)
  const league = get_current_league(state)
  let result = new Map()
  for (const ros of rosters.valueSeq()) {
    if (!ros) continue
    const r = new Roster({ roster: ros.toJS(), league })
    const active = r.active.map(({ pid }) => getPlayerById(state, { pid }))
    result = result.set(ros.get('tid'), new List(active))
  }

  return result
}

export function getRosterInfoForPlayerId(
  state,
  { pid, player_map = new Map() }
) {
  pid = pid || player_map.get('pid')
  if (!pid) {
    return {}
  }

  const rosters = get_rosters_for_current_league(state)
  for (const roster of rosters.values()) {
    for (const rosterPlayer of roster.players) {
      if (rosterPlayer.pid === pid) {
        return { tid: roster.tid, ...rosterPlayer }
      }
    }
  }
  return {}
}

export const get_practice_squad_player_ids_for_current_league = createSelector(
  get_rosters_for_current_league,
  (rosters) => {
    const pids = []
    for (const roster of rosters.values()) {
      roster.players.forEach(({ slot, pid }) => {
        if (practice_squad_slots.includes(slot)) {
          pids.push(pid)
        }
      })
    }
    return new List(pids)
  }
)

export const get_practice_squad_unprotected_player_ids_for_current_league =
  createSelector(get_rosters_for_current_league, (rosters) => {
    const pids = []
    for (const roster of rosters.values()) {
      roster.players.forEach(({ slot, pid }) => {
        if (practice_squad_unprotected_slots.includes(slot)) {
          pids.push(pid)
        }
      })
    }
    return new List(pids)
  })

export const get_practice_squad_protected_player_ids_for_current_league =
  createSelector(get_rosters_for_current_league, (rosters) => {
    const pids = []
    for (const roster of rosters.values()) {
      roster.players.forEach(({ slot, pid }) => {
        if (practice_squad_protected_slots.includes(slot)) {
          pids.push(pid)
        }
      })
    }
    return new List(pids)
  })

export const get_injured_reserve_player_ids_for_current_league = createSelector(
  get_rosters_for_current_league,
  (rosters) => {
    const pids = []
    for (const roster of rosters.values()) {
      roster.players.forEach(({ slot, pid }) => {
        if (
          slot === roster_slot_types.RESERVE_SHORT_TERM ||
          slot === roster_slot_types.RESERVE_LONG_TERM
        ) {
          pids.push(pid)
        }
      })
    }
    return new List(pids)
  }
)

export function isPlayerFreeAgent(state, { player_map }) {
  const rostered = get_rostered_player_ids_for_current_league(state)
  return !rostered.includes(player_map.get('pid'))
}

export function isPlayerOnPracticeSquad(state, { player_map }) {
  const practiceSquads = get_practice_squad_player_ids_for_current_league(state)
  return practiceSquads.includes(player_map.get('pid'))
}

export const getCurrentTeamRoster = createSelector(
  get_current_team_roster_record,
  get_current_league,
  (roster, league) => {
    return new Roster({ roster: roster.toJS(), league })
  }
)

export const get_rostered_player_maps = createSelector(
  get_rostered_player_ids_for_current_league,
  get_player_maps,
  (pids, player_maps) => {
    let result = new Map()
    for (const pid of pids) {
      result = result.set(pid, player_maps.get(pid))
    }
    return result
  }
)

export const getRosterPositionalValueByTeamId = createSelector(
  get_rosters_for_current_league,
  get_current_league,
  get_teams_for_current_league,
  get_team_by_id_for_current_year,
  get_rostered_player_maps,
  get_draft_pick_values,
  (rosterRecords, league, teams, team, player_maps, draft_pick_values) => {
    const divTeamIds = teams.filter((t) => t.div === team.div).map((t) => t.uid)

    const values = {
      league_min: {},
      league_avg: {},
      league_avg_normalized: {},
      league_max: {},
      league: {},
      div_avg: {},
      div_avg_normalized: {},
      div: {},

      team: {},
      team_normalized: {},

      total: {},
      rosters: {},
      sorted_tids: []
    }

    const rosters = []
    for (const rec of rosterRecords.valueSeq()) {
      const roster = new Roster({ roster: rec.toJS(), league })
      rosters.push(roster)
      values.rosters[roster.tid] = {}
    }

    const seasonType = current_season.isOffseason ? '0' : 'ros'
    for (const position of fantasy_positions) {
      // skip positions that don't start in the current league
      if (!league[`s${position.toLowerCase()}`]) {
        continue
      }
      const position_values_by_team = []
      const div_position_values = []
      for (const roster of rosters) {
        const rosterPlayers = roster.active.filter((p) => p.pos === position)
        const playerMaps = rosterPlayers.map(({ pid }) =>
          player_maps.get(pid, new Map())
        )
        const pts_added_array = playerMaps.map((pMap) =>
          Math.max(pMap.getIn(['pts_added', seasonType], 0), 0)
        )
        const pts_added_total = pts_added_array.reduce((s, i) => s + i, 0)
        position_values_by_team.push(pts_added_total)
        values.rosters[roster.tid][position] = pts_added_total
        if (divTeamIds.includes(roster.tid))
          div_position_values.push(pts_added_total)
        if (roster.tid === team.uid) values.team[position] = pts_added_total
        values.total[roster.tid] =
          (values.total[roster.tid] ?? 0) + pts_added_total
      }
      values.league_avg[position] =
        position_values_by_team.reduce((s, i) => s + i, 0) /
        position_values_by_team.length
      values.league[position] = position_values_by_team
      values.div_avg[position] =
        div_position_values.reduce((s, i) => s + i, 0) /
        div_position_values.length
      values.div[position] = div_position_values

      values.league_min[position] = Math.min(...position_values_by_team)
      values.league_max[position] = Math.max(...position_values_by_team)
      const team_value = values.team[position]
      const min_value = values.league_min[position]
      const max_value = values.league_max[position]
      const is_max = max_value - min_value === 0
      values.team_normalized[position] = is_max
        ? 100
        : ((team_value - min_value) / (max_value - min_value)) * 100

      const div_value = values.div_avg[position]
      values.div_avg_normalized[position] = is_max
        ? 100
        : ((div_value - min_value) / (max_value - min_value)) * 100

      const league_value = values.league_avg[position]
      values.league_avg_normalized[position] = is_max
        ? 100
        : ((league_value - min_value) / (max_value - min_value)) * 100
    }

    const league_draft_value = []
    const div_draft_value = []
    for (const [tid, team_i] of teams) {
      const draft_value = team_i.picks.reduce(
        (sum, pick) => sum + get_draft_pick_value(draft_pick_values, pick),
        0
      )
      league_draft_value.push(draft_value)
      if (divTeamIds.includes(tid)) div_draft_value.push(draft_value)
      if (tid === team.uid) {
        values.team.DRAFT = draft_value
      }
      if (values.rosters[tid]) {
        values.rosters[tid].DRAFT = draft_value
        values.total[tid] = values.total[tid] + draft_value
      }
    }

    values.league_avg.DRAFT =
      league_draft_value.reduce((s, i) => s + i, 0) / league_draft_value.length
    values.league.DRAFT = league_draft_value
    values.div_avg.DRAFT =
      div_draft_value.reduce((s, i) => s + i, 0) / div_draft_value.length
    values.div.DRAFT = div_draft_value

    values.league_max.DRAFT = Math.max(...league_draft_value)
    values.league_min.DRAFT = Math.min(...league_draft_value)
    const team_draft_value = values.team.DRAFT
    const min_draft_value = values.league_min.DRAFT
    const max_draft_value = values.league_max.DRAFT
    const is_max_draft = max_draft_value - min_draft_value === 0
    values.team_normalized.DRAFT = is_max_draft
      ? 100
      : ((team_draft_value - min_draft_value) /
          (max_draft_value - min_draft_value)) *
        100

    const div_draft_value_avg = values.div_avg.DRAFT
    values.div_avg_normalized.DRAFT = is_max_draft
      ? 100
      : ((div_draft_value_avg - min_draft_value) /
          (max_draft_value - min_draft_value)) *
        100

    const league_draft_value_avg = values.league_avg.DRAFT
    values.league_avg_normalized.DRAFT = is_max_draft
      ? 100
      : ((league_draft_value_avg - min_draft_value) /
          (max_draft_value - min_draft_value)) *
        100

    const team_values = Object.entries(values.total).map(([key, value]) => ({
      tid: key,
      value
    }))
    values.sorted_tids = team_values.sort((a, b) => b.value - a.value)
    values.team_total = values.total[team.uid]

    return values
  }
)

export const getGroupedPlayersByTeamId = createSelector(
  get_rosters_state,
  get_current_league,
  (state) => state.get('players').get('items'),
  (state, { tid }) => tid,
  (rosters, league, player_items, tid) => {
    const week = Math.min(
      current_season.fantasy_season_week,
      current_season.finalWeek
    )
    const roster = rosters.getIn([tid, current_season.year, week])
    if (!roster) {
      return {
        active: new List(),
        practice: new List(),
        practice_signed: new List(),
        practice_drafted: new List(),
        reserve_short_term: new List(),
        reserve_long_term: new List(),
        cov: new List(),
        players: new List(),
        roster: new Roster({ roster: new RosterRecord().toJS(), league })
      }
    }

    const r = new Roster({ roster: roster.toJS(), league })
    const active = new List(
      r.active.map(({ pid }) => player_items.get(pid, new Map()))
    )
    const practice = new List(
      r.practice.map(({ pid }) => player_items.get(pid, new Map()))
    )
    const practice_signed = new List(
      r.practice_signed.map(({ pid }) => player_items.get(pid, new Map()))
    )
    const practice_drafted = new List(
      r.practice_drafted.map(({ pid }) => player_items.get(pid, new Map()))
    )
    const reserve_short_term = new List(
      r.reserve_short_term_players.map(({ pid }) =>
        player_items.get(pid, new Map())
      )
    )
    const reserve_long_term = new List(
      r.reserve_long_term_players.map(({ pid }) =>
        player_items.get(pid, new Map())
      )
    )
    const cov = new List(
      r.cov.map(({ pid }) => player_items.get(pid, new Map()))
    )

    const players = active
      .concat(practice)
      .concat(reserve_short_term)
      .concat(cov)
      .concat(reserve_long_term)

    return {
      active,
      practice,
      practice_signed,
      practice_drafted,
      players,
      reserve_short_term,
      reserve_long_term,
      cov,
      roster: r
    }
  }
)

export function get_current_players_for_league(state) {
  const { teamId } = get_app(state)
  return getGroupedPlayersByTeamId(state, { tid: teamId })
}

export function getGameByPlayerId(state, { pid, week }) {
  const player_map = getPlayerById(state, { pid })
  return get_game_by_team(state, { nfl_team: player_map.get('team'), week })
}

export function getByeByTeam(state, { nfl_team }) {
  return state.getIn(['schedule', 'teams', nfl_team, 'bye'])
}

export function get_game_by_team(
  state,
  { nfl_team, week = Math.max(current_season.week, 1) }
) {
  const team = state.getIn(['schedule', 'teams', nfl_team])
  if (!team) {
    return null
  }

  return team.games.find((g) => g.week === week)
}

export function getGamesByTeam(state, { nfl_team }) {
  const team = state.getIn(['schedule', 'teams', nfl_team])
  if (!team) {
    return []
  }

  return team.games
}

export function getScoreboardRosterByTeamId(state, { tid }) {
  const year = state.getIn(['app', 'year'])
  const week = state.getIn(['scoreboard', 'week'])
  const isFuture = year === current_season.year && week > current_season.week
  return getRosterByTeamId(state, {
    tid,
    week: isFuture ? current_season.week : week,
    year
  })
}

export function getSelectedMatchupScoreboards(state) {
  const matchup = get_selected_matchup(state)
  return matchup.tids.map((tid) => getScoreboardByTeamId(state, { tid }))
}

export function getPointsByTeamId(state, { tid, week }) {
  let points = 0
  const starterMaps = getStartersByTeamId(state, { tid, week })
  starterMaps.forEach((player_map) => {
    const gamelog = get_gamelog_for_player(state, { player_map, week })
    if (gamelog) points += gamelog.total
  })
  return points
}

export function getOptimalPointsByTeamId(state, { tid, week }) {
  const league = get_current_league(state)
  const roster = getRosterByTeamId(state, { tid, week })

  // Get all active roster players (not just starters)
  const players = []
  for (const { pid } of roster.active) {
    const player_map = getPlayerById(state, { pid })
    if (!player_map || !player_map.get('pid')) continue

    const pos = player_map.get('pos')
    if (!pos) continue

    const gamelog = get_gamelog_for_player(state, { player_map, week })
    const points = gamelog ? gamelog.total : 0

    players.push({ pid, pos, points })
  }

  if (players.length === 0) {
    return 0
  }

  const result = optimizeStandingsLineup({ players, league })
  return result.total || 0
}

export function getScoreboardByMatchupId(state, { matchupId }) {
  const matchup = get_matchup_by_id(state, { matchupId })
  if (!matchup) {
    return {
      home: create_scoreboard(),
      away: create_scoreboard()
    }
  }

  const home = getScoreboardByTeamId(state, { tid: matchup.hid, matchupId })
  const away = getScoreboardByTeamId(state, { tid: matchup.aid, matchupId })

  return { home, away }
}

export function getScoreboardByTeamId(state, { tid, matchupId }) {
  const year = state.getIn(['app', 'year'])
  const leagueId = state.getIn(['app', 'leagueId'])
  const scoreboard_week = state.getIn(['scoreboard', 'week'])
  const matchup = matchupId
    ? get_matchup_by_id(state, { matchupId })
    : get_matchup_by_team_id(state, { tid, year, week: scoreboard_week })

  let minutes = 0
  let projected = 0

  const season = get_league_season(state, { leagueId, year })

  const championship_round_final_week =
    Math.max(...season.get('championship_round', [])) ||
    current_season.finalWeek
  const championship_round_first_week =
    Math.min(...season.get('championship_round', [])) ||
    current_season.finalWeek - 1
  const is_championship_round = matchup.week === championship_round_final_week

  // For past matchups (before current week), use stored values
  // For current/future weeks, calculate live projections dynamically
  const is_past_matchup =
    matchup.year < current_season.year ||
    (matchup.year === current_season.year && matchup.week < current_season.week)

  const team_index = matchup.tids.indexOf(tid)
  if (
    is_past_matchup &&
    matchup.points.some((p) => Boolean(p)) &&
    team_index >= 0
  ) {
    let points =
      matchup.points_manual.get(team_index) || matchup.points.get(team_index)
    let projected_points = matchup.projections.get(team_index)

    // Calculate optimal points for past matchups
    let optimal = getOptimalPointsByTeamId(state, { tid, week: matchup.week })

    if (is_championship_round) {
      const previous_matchup = get_matchup_by_team_id(state, {
        tid,
        year,
        week: championship_round_first_week
      })
      const previous_team_index = previous_matchup.tids.indexOf(tid)
      if (previous_team_index >= 0) {
        points +=
          previous_matchup.points_manual.get(previous_team_index) ||
          previous_matchup.points.get(previous_team_index)
        projected_points +=
          previous_matchup.projections.get(previous_team_index)
      }
      // Add optimal from the previous week of championship round
      optimal += getOptimalPointsByTeamId(state, {
        tid,
        week: championship_round_first_week
      })
    }

    return create_scoreboard({
      tid,
      points,
      projected: projected_points,
      optimal: Number(optimal.toFixed(2)),
      minutes,
      matchup
    })
  }

  let points = is_championship_round
    ? getPointsByTeamId(state, { tid, week: championship_round_first_week })
    : 0
  const previousWeek = points

  // TODO - instead use matchup projected value
  const isFuture =
    year === current_season.year && matchup.week > current_season.week
  const starterMaps = getStartersByTeamId(state, {
    tid,
    week: isFuture ? current_season.week : matchup.week
  })
  for (const player_map of starterMaps) {
    const gamelog = get_gamelog_for_player(state, {
      player_map,
      week: matchup.week
    })
    if (gamelog) {
      points += gamelog.total
      const gameStatus = getGameStatusByPlayerId(state, {
        pid: player_map.get('pid'),
        week: matchup.week
      })
      if (gameStatus && gameStatus.lastPlay) {
        const lp = gameStatus.lastPlay
        const quarterMinutes =
          lp.desc === 'END GAME'
            ? 0
            : Number((lp.game_clock_start || '0:00').split(':')[0])
        const quartersRemaining = lp.qtr === 5 ? 0 : 4 - lp.qtr
        minutes += quartersRemaining * 15 + quarterMinutes
      }
    } else {
      minutes += 60
    }

    // Team projected = sum of individual projected_totals (expected final score)
    const live_projection = get_player_live_projection(state, {
      player_map,
      week: matchup.week
    })

    if (live_projection) {
      // For all game states, use projected_total (expected final points for player)
      // - pending: full projection
      // - live: accumulated + remaining
      // - completed: actual points (since remaining ≈ 0)
      projected += live_projection.projected_total
    } else {
      projected += player_map.getIn(['points', `${matchup.week}`, 'total'], 0)
    }
  }

  // Calculate optimal points for current/live matchups
  let optimal = getOptimalPointsByTeamId(state, { tid, week: matchup.week })
  if (is_championship_round) {
    // Add optimal from the previous week of championship round
    optimal += getOptimalPointsByTeamId(state, {
      tid,
      week: championship_round_first_week
    })
  }

  return create_scoreboard({
    tid,
    points: Number(points.toFixed(2)),
    projected: Number((projected + previousWeek).toFixed(2)),
    optimal: Number(optimal.toFixed(2)),
    minutes,
    matchup
  })
}

export const getScoreboardUpdated = createSelector(get_plays, (plays) => {
  const play = plays.maxBy((x) => x.updated)
  return play ? play.updated : 0
})

export function getStartersByMatchupId(state, { mid }) {
  const matchup = get_selected_matchup(state)
  if (!matchup) {
    return {
      matchup: {},
      games: {},
      teams: []
    }
  }

  const teams = {}
  matchup.tids.forEach((tid) => {
    teams[tid] = getStartersByTeamId(state, { tid, week: matchup.week })
  })
  const playerMaps = Object.values(teams).flat()

  const games = {}
  for (const player_map of playerMaps) {
    if (!player_map.get('pid')) continue
    const game = get_game_by_team(state, {
      nfl_team: player_map.get('team'),
      week: matchup.week
    })
    if (!game) continue
    const dateStr = `${game.date} ${game.time_est}`
    if (!games[dateStr]) games[dateStr] = []
    games[dateStr].push(player_map)
  }

  return { matchup, games, teams }
}

export function getScoreboardGamelogByPlayerId(state, { pid }) {
  const player_map = getPlayerById(state, { pid })

  if (!player_map.get('pid')) return

  const week = state.getIn(['scoreboard', 'week'])
  const year = state.getIn(['app', 'year'])
  return get_gamelog_for_player(state, { player_map, week, year })
}

export function getPlaysByMatchupId(state, { mid }) {
  const matchup = get_selected_matchup(state)

  if (!matchup) {
    return new List()
  }

  const playerMaps = matchup.tids.reduce((arr, tid) => {
    const starters = getStartersByTeamId(state, { tid, week: matchup.week })
    return arr.concat(starters)
  }, [])

  const gsisids = playerMaps.map((pMap) => pMap.get('gsisid')).filter(Boolean)
  const gsispids = playerMaps.map((pMap) => pMap.get('gsispid')).filter(Boolean)

  // Identify DST starters and their teams
  const dst_player_maps = playerMaps.filter((pMap) => pMap.get('pos') === 'DST')
  const dst_teams = dst_player_maps.map((pMap) => fixTeam(pMap.get('team')))

  // Need either individual players or DST starters to proceed
  if (!gsisids.length && !dst_teams.length) {
    return new List()
  }

  const plays = get_plays(state, { week: matchup.week })
  const all_plays_list = plays.valueSeq().toList()

  const filteredPlays = all_plays_list.filter((play) => {
    // Check if DST team is on defense for this play
    const play_def_team = fixTeam(play.def)
    const is_dst_defensive_play = dst_teams.includes(play_def_team)
    if (is_dst_defensive_play) return true

    // Check for individual player stats
    if (!play.playStats || play.playStats.length === 0) {
      return false
    }

    const matchSingleGsis = play.playStats.find((playStat) =>
      gsisids.includes(playStat.gsisId)
    )
    if (matchSingleGsis) return true

    const matchSingleGsisPid = play.playStats.find((playStat) =>
      gsispids.includes(playStat.gsispid)
    )
    return Boolean(matchSingleGsisPid)
  })

  const league = get_current_league(state)

  // Sort plays chronologically (ascending) for DST running total calculation
  const chronological_plays = filteredPlays.sort((a, b) => {
    // Sort by esbid first (game), then by sequence within game
    if (a.esbid !== b.esbid) return a.esbid - b.esbid
    return (a.sequence || 0) - (b.sequence || 0)
  })

  // Initialize DST running totals per team
  const dst_running_totals = {}
  for (const dst_team of dst_teams) {
    dst_running_totals[dst_team] = { dya: 0, dpa: 0 }
  }

  let result = new List()

  for (const play of chronological_plays) {
    const game = get_game_by_team(state, {
      nfl_team: play.pos_team ? fixTeam(play.pos_team) : fixTeam(play.def),
      week: matchup.week
    })

    if (!game) {
      continue
    }

    // Calculate individual player stats and points
    const play_stats_with_ids = (play.playStats || []).filter(
      (p) => p.gsispid || p.gsisId
    )
    const grouped_play_stats = {}
    for (const playStat of play_stats_with_ids) {
      const player_map = playerMaps.find((pMap) => {
        if (playStat.gsispid && pMap.get('gsispid', false) === playStat.gsispid)
          return true
        if (playStat.gsisId && pMap.get('gsisid', false) === playStat.gsisId)
          return true
        return false
      })
      if (!player_map) continue
      const pid = player_map.get('pid')
      if (!grouped_play_stats[pid]) grouped_play_stats[pid] = []
      grouped_play_stats[pid].push(playStat)
    }

    const points = {}
    const stats = {}
    for (const pid in grouped_play_stats) {
      const player_map = playerMaps.find((pMap) => pMap.get('pid') === pid)
      const player_play_stats = grouped_play_stats[pid]
      stats[pid] = calculateStatsFromPlayStats(player_play_stats)
      points[pid] = calculatePoints({
        stats: stats[pid],
        position: player_map.get('pos'),
        league
      })
    }

    // Calculate DST points delta for this play
    const play_def_team = fixTeam(play.def)
    if (dst_teams.includes(play_def_team)) {
      const dst_player_map = dst_player_maps.find(
        (pMap) => fixTeam(pMap.get('team')) === play_def_team
      )
      if (dst_player_map) {
        const dst_pid = dst_player_map.get('pid')
        const { delta_stats, updated_running_totals } =
          calculate_dst_delta_from_play({
            play,
            dst_team: play_def_team,
            dst_running_totals: dst_running_totals[play_def_team]
          })

        // Update running totals for next play
        dst_running_totals[play_def_team] = updated_running_totals

        // Only add DST to points if there was a non-zero delta
        if (delta_stats.total !== 0) {
          points[dst_pid] = delta_stats
          stats[dst_pid] = delta_stats
        }
      }
    }

    // Skip plays with no fantasy points impact
    if (Object.keys(points).length === 0) {
      continue
    }

    let time
    try {
      time = dayjs.tz(
        `${game.date} ${play.timestamp}`,
        'YYYY-MM-DD HH:mm:ss',
        'America/New_York'
      )
    } catch (error) {
      console.error(
        `Invalid or missing date for playId: ${play.playId}, esbid: ${play.esbid}`,
        error
      )
      time = dayjs()
    }

    result = result.push({
      time: time.unix(),
      play,
      game,
      stats,
      points
    })
  }

  // Sort result descending (most recent first) for display
  const sorted_result = result.sort((a, b) => b.time - a.time)
  return sorted_result
}

function getYardline(str, pos_team) {
  if (!str) {
    return ''
  }

  if (str === '50') {
    return 50
  }

  const { side, number } = getYardlineInfoFromString(str)
  return side === pos_team ? number : 100 - number
}

export function getGameStatusByPlayerId(
  state,
  { pid, week = current_season.week }
) {
  const game = getGameByPlayerId(state, { pid, week })
  if (!game) {
    return null
  }

  const plays = get_plays(state, { week })
  const player_map = getPlayerById(state, { pid })
  const play = plays.find((p) => {
    if (!p.pos_team) return false

    const team = fixTeam(p.pos_team)
    return team === game.h || team === game.v
  })

  if (!play) {
    return { game }
  }

  const filteredPlays = plays.filter((p) => p.esbid === play.esbid && p.desc)
  const lastPlay = filteredPlays.maxBy((p) => p.sequence)
  if (!lastPlay.pos_team) {
    return { game, lastPlay }
  }

  const hasPossession = fixTeam(lastPlay.pos_team) === player_map.get('team')
  const yardline = getYardline(
    lastPlay.ydl_end || lastPlay.ydl_start,
    lastPlay.pos_team
  )
  const isRedzone = yardline >= 80

  return {
    game,
    lastPlay,
    yardline,
    isRedzone,
    hasPossession
  }
}

/**
 * Determine the game state for a player: 'pending', 'live', or 'completed'
 */
export function get_player_game_state(
  state,
  { pid, week = current_season.week }
) {
  const game_status = getGameStatusByPlayerId(state, { pid, week })

  if (!game_status || !game_status.game) {
    return 'pending'
  }

  const { game, lastPlay } = game_status

  // Check if game is final - prefer play data (real-time) over schedule status (cached)
  // "END GAME" play is pushed via WebSocket, so this detects completion immediately
  if (lastPlay && lastPlay.desc === 'END GAME') {
    return 'completed'
  }

  // Fall back to cached schedule status (for past weeks or if play data unavailable)
  if (game.status && game.status.toUpperCase().startsWith('FINAL')) {
    return 'completed'
  }

  // Check if game has started (has plays)
  if (lastPlay) {
    return 'live'
  }

  // Game exists but no plays yet
  const now = Date.now()
  if (game.timestamp && now >= game.timestamp) {
    return 'live'
  }

  return 'pending'
}

/**
 * Get game progress percentage for a player's current game
 */
export function get_player_game_progress(
  state,
  { pid, week = current_season.week }
) {
  const game_status = getGameStatusByPlayerId(state, { pid, week })

  if (!game_status || !game_status.game) {
    return 0
  }

  const { game, lastPlay } = game_status

  // Check if game is final - prefer play data (real-time) over schedule status (cached)
  const is_final =
    (lastPlay && lastPlay.desc === 'END GAME') ||
    (game.status && game.status.toUpperCase().startsWith('FINAL'))

  if (!lastPlay) {
    return is_final ? 1 : 0
  }

  return get_game_progress({
    quarter: lastPlay.qtr,
    game_clock: lastPlay.game_clock_start,
    is_final
  })
}

/**
 * Calculate live projection for a player combining accumulated points with remaining projection
 */
export function get_player_live_projection(
  state,
  { player_map, week = current_season.week }
) {
  if (!player_map || !player_map.get('pid')) {
    return null
  }

  const pid = player_map.get('pid')
  const game_state = get_player_game_state(state, { pid, week })

  // For pending games, return full projection
  if (game_state === 'pending') {
    const full_projection = player_map.getIn(['points', `${week}`, 'total'], 0)
    return {
      projected_total: Number(full_projection.toFixed(2)),
      remaining_projection: Number(full_projection.toFixed(2)),
      accumulated_points: 0,
      game_progress: 0,
      game_state
    }
  }

  // Get accumulated points from play-by-play
  const gamelog = get_gamelog_for_player(state, { player_map, week })
  const accumulated_points = gamelog ? gamelog.total : 0

  // For completed games, return actual points
  if (game_state === 'completed') {
    return {
      projected_total: Number(accumulated_points.toFixed(2)),
      remaining_projection: 0,
      accumulated_points: Number(accumulated_points.toFixed(2)),
      game_progress: 1,
      game_state
    }
  }

  // For live games, combine accumulated + remaining projection
  const full_projection = player_map.getIn(['points', `${week}`, 'total'], 0)
  const game_progress = get_player_game_progress(state, { pid, week })

  const result = calculate_live_projection({
    accumulated_points,
    full_game_projection: full_projection,
    game_progress
  })

  return {
    ...result,
    game_state
  }
}

export const getGamelogsForSelectedPlayer = createSelector(
  getSelectedPlayer,
  get_player_gamelogs,
  (player_map, gamelogs) => {
    const pid = player_map.get('pid')
    const games = gamelogs
      .filter((p) => p.pid === pid)
      .sort((a, b) => b.timestamp - a.timestamp)
    return games.toJS()
  }
)

export const get_team_value_deltas_by_team_id = createSelector(
  get_current_league,
  (state) => state.get('league_team_daily_values'),
  (state, { tid }) => tid,
  (league, league_team_daily_values, tid) => {
    const team_values = league_team_daily_values.get(tid)
    if (!team_values) return new Map()

    const league_total_due_amount = league.num_teams * league.season_due_amount

    let result = new Map()

    const latest_value = team_values.last()
    const latest_team_share = latest_value.ktc_share

    result = result.set('latest_team_share', latest_team_share)
    result = result.set(
      'latest_team_value',
      latest_team_share * league_total_due_amount
    )

    const deltas_result = []

    const days_ago = [7, 30, 90, 365, 730]
    const sorted_values = team_values.sort((a, b) => b.timestamp - a.timestamp)
    for (const days of days_ago) {
      const value = sorted_values.find(
        (v) => v.timestamp < dayjs().subtract(days, 'days').valueOf()
      )
      if (!value) continue

      const team_share = value.ktc_share
      const delta = latest_team_share - team_share
      const delta_pct = delta / team_share
      const delta_dollar_amount = delta * league_total_due_amount
      deltas_result.push({ delta, delta_pct, days, delta_dollar_amount })
    }

    result = result.set('deltas', deltas_result)

    return result
  }
)

export function get_league_teams_value_deltas(state) {
  const teams = get_teams_for_current_league(state)

  let result = new Map()
  for (const team of teams.values()) {
    const uid = team.get('uid')
    const deltas = get_team_value_deltas_by_team_id(state, { tid: uid })
    result = result.set(uid, deltas)
  }

  return result
}

export function get_gamelog_for_player(
  state,
  { player_map, week, year = current_season.year }
) {
  if (!player_map || !player_map.get('pid')) return null

  const league = get_current_league(state)

  const process = (gamelog) => {
    const points = calculatePoints({
      stats: gamelog,
      position: gamelog.pos,
      league
    })

    return {
      points,
      total: points.total,
      ...gamelog
    }
  }

  const pid = player_map.get('pid')
  const gamelog = get_gamelog_by_player_id(state, { pid, week, year })
  if (gamelog) return process(gamelog)

  // TODO should handle year
  const plays = get_plays_for_player(state, { player_map, week }).toJS()
  if (!plays.length) return null

  const pos = player_map.get('pos')
  const stats =
    pos === 'DST'
      ? calculateDstStatsFromPlays(plays, player_map.get('team'))
      : calculateStatsFromPlayStats(plays.flatMap((p) => p.playStats))
  const play = plays.find((p) => p.possessionTeam)
  const opp = play
    ? fixTeam(play.possessionTeam) === fixTeam(play.h)
      ? fixTeam(play.v)
      : fixTeam(play.h)
    : null

  return process({
    pid,
    week,
    year,
    pos,
    opp,
    ...stats
  })
}

export function get_draft_pick_by_id(state, { pickId }) {
  const teams = get_teams_for_current_league_and_year(state)
  for (const team of teams.valueSeq()) {
    const picks = team.get('picks')
    const pick = picks.find((p) => p.uid === pickId)
    if (pick) {
      return pick
    }
  }

  return {}
}

export const get_draft_pick_trade_counts = createSelector(
  get_draft_state,
  (draft) => {
    const trade_counts = new Map()

    // Get trade counts from draft picks data (now included in API response)
    draft.picks.forEach((pick) => {
      const count = pick.trade_count || 0
      trade_counts.set(pick.uid, count)
    })

    return trade_counts
  }
)

// gets the overall standings for the current league and year
export function get_overall_standings(state) {
  const teams = get_teams_for_current_league_and_year(state)
  const divisionTeams = teams.groupBy((x) => x.getIn(['div'], 0))
  let divisionLeaders = new List()
  for (const teams of divisionTeams.values()) {
    const sorted = teams.sort(
      (a, b) =>
        b.getIn(['stats', 'wins'], 0) - a.getIn(['stats', 'wins'], 0) ||
        b.getIn(['stats', 'ties'], 0) - a.getIn(['stats', 'ties'], 0) ||
        b.getIn(['stats', 'pf'], 0) - a.getIn(['stats', 'pf'], 0)
    )

    // top two teams
    divisionLeaders = divisionLeaders.push(sorted.toList().get(0, new Map()))
    divisionLeaders = divisionLeaders.push(sorted.toList().get(1, new Map()))
  }

  let sortedDivisionLeaders = divisionLeaders.sort(
    (a, b) =>
      b.getIn(['stats', 'apWins'], 0) - a.getIn(['stats', 'apWins'], 0) ||
      b.getIn(['stats', 'apTies'], 0) - a.getIn(['stats', 'apTies'], 0) ||
      b.getIn(['stats', 'pf'], 0) - a.getIn(['stats', 'pf'], 0)
  )

  // TODO cleanup
  // if the 2nd ranked team in sortedDivisionLeaders is from the same division as the first, swap it with the 3rd ranked team
  const team_1 = sortedDivisionLeaders.get(0)
  const team_2 = sortedDivisionLeaders.get(1)
  if (team_1 && team_2 && team_1.get('div') === team_2.get('div')) {
    sortedDivisionLeaders = sortedDivisionLeaders.set(
      1,
      sortedDivisionLeaders.get(2)
    )
    sortedDivisionLeaders = sortedDivisionLeaders.set(2, team_2)
  }

  const playoffTeamTids = divisionLeaders.map((p) => p.uid)
  const wildcardTeams = teams
    .filter((t) => !playoffTeamTids.includes(t.uid))
    .toList()
  const sortedWildcardTeams = wildcardTeams.sort(
    (a, b) => b.getIn(['stats', 'pf'], 0) - a.getIn(['stats', 'pf'], 0)
  )

  return {
    teams,
    divisionTeams,
    divisionLeaders: sortedDivisionLeaders,
    wildcardTeams: sortedWildcardTeams
  }
}

export const getTeamEvents = createSelector(
  get_rookie_draft_next_pick,
  get_active_poaches_against_my_players,
  (nextPick, activePoaches) => {
    const events = []

    for (const poach of activePoaches.valueSeq()) {
      const date = dayjs.unix(poach.submitted).add('48', 'hours')
      events.push({
        detail: 'Poaching Claim Expires',
        date
      })
    }

    if (nextPick) {
      events.push({
        detail: 'Your Next Pick',
        date: nextPick.draftWindow
      })
    }

    return events.sort((a, b) => a.date.unix() - b.date.unix())
  }
)

export function get_trade_is_valid(state) {
  const { teamId } = get_app(state)
  const trade = get_current_trade(state)
  const isProposer = trade.propose_tid === teamId

  const rosterRecord = isProposer
    ? get_proposing_team_roster(state)
    : get_accepting_team_roster(state)
  const add_pids = isProposer
    ? trade.acceptingTeamPlayers
    : trade.proposingTeamPlayers
  const release_pids = isProposer
    ? trade.proposingTeamReleasePlayers
    : trade.acceptingTeamReleasePlayers
  const remove_pids = isProposer
    ? trade.proposingTeamPlayers
    : trade.acceptingTeamPlayers

  const league = get_current_league(state)
  const playerMaps = get_player_maps(state)
  const roster = new Roster({ roster: rosterRecord.toJS(), league })
  const tradeState = get_trade(state)
  const slot_assignments = isProposer
    ? tradeState.proposingTeamSlots
    : tradeState.acceptingTeamSlots

  release_pids.forEach((pid) => roster.removePlayer(pid))
  remove_pids.forEach((pid) => roster.removePlayer(pid))

  for (const pid of add_pids) {
    const player_map = playerMaps.get(pid)
    if (!player_map) {
      // Player data not loaded yet, skip validation
      continue
    }

    const current_slot = player_map.get('slot')

    // Determine target slot - use assigned slot or calculate default using shared logic
    let target_slot = slot_assignments.get(pid)

    if (!target_slot) {
      // Convert Immutable player_map to plain object for get_default_trade_slot
      const player = {
        pid: player_map.get('pid'),
        pos: player_map.get('pos'),
        roster_status: player_map.get('roster_status'),
        game_designation: player_map.get('game_designation'),
        practice: player_map.get('practice'),
        game_day: player_map.get('game_day'),
        prior_week_inactive: player_map.get('prior_week_inactive'),
        prior_week_ruled_out: player_map.get('prior_week_ruled_out'),
        value: player_map.get('value')
      }

      target_slot = get_default_trade_slot({
        player,
        current_slot,
        roster,
        week: current_season.week,
        is_regular_season: current_season.isRegularSeason
      })
    }

    // Validate slot availability
    let has_space = true
    if (target_slot === roster_slot_types.BENCH) {
      has_space = roster.has_bench_space_for_position(player_map.get('pos'))
    } else if (
      target_slot === roster_slot_types.PS ||
      target_slot === roster_slot_types.PSP
    ) {
      has_space = roster.has_practice_squad_space_for_position(
        player_map.get('pos')
      )
    } else if (
      target_slot === roster_slot_types.PSD ||
      target_slot === roster_slot_types.PSDP
    ) {
      // Drafted practice squad has unlimited space
      has_space = true
    } else if (target_slot === roster_slot_types.RESERVE_SHORT_TERM) {
      has_space = roster.has_open_reserve_short_term_slot()
    }

    if (!has_space) {
      return false
    }

    // Add player with error handling - gracefully handle roster full errors
    try {
      roster.addPlayer({
        slot: target_slot,
        pid,
        pos: player_map.get('pos'),
        value: player_map.get('value')
      })
    } catch (error) {
      // If roster is full or any other error, return false to show release section
      if (
        error.message === 'Roster is full' ||
        error.message === 'Player is not eligible'
      ) {
        return false
      }
      // Re-throw unexpected errors
      throw error
    }
  }

  return true
}

export function get_trade_validation_details(state) {
  const { teamId } = get_app(state)
  const trade = get_current_trade(state)
  const isProposer = trade.propose_tid === teamId

  const rosterRecord = isProposer
    ? get_proposing_team_roster(state)
    : get_accepting_team_roster(state)
  const add_pids = isProposer
    ? trade.acceptingTeamPlayers
    : trade.proposingTeamPlayers
  const release_pids = isProposer
    ? trade.proposingTeamReleasePlayers
    : trade.acceptingTeamReleasePlayers
  const remove_pids = isProposer
    ? trade.proposingTeamPlayers
    : trade.acceptingTeamPlayers

  const league = get_current_league(state)
  const playerMaps = get_player_maps(state)
  const roster = new Roster({ roster: rosterRecord.toJS(), league })
  const tradeState = get_trade(state)
  const slot_assignments = isProposer
    ? tradeState.proposingTeamSlots
    : tradeState.acceptingTeamSlots

  release_pids.forEach((pid) => roster.removePlayer(pid))
  remove_pids.forEach((pid) => roster.removePlayer(pid))

  const needs_active_releases = []
  const needs_ps_releases = []
  let all_valid = true

  for (const pid of add_pids) {
    const player_map = playerMaps.get(pid)
    if (!player_map) {
      continue
    }

    const current_slot = player_map.get('slot')
    let target_slot = slot_assignments.get(pid)

    if (!target_slot) {
      const player = {
        pid: player_map.get('pid'),
        pos: player_map.get('pos'),
        roster_status: player_map.get('roster_status'),
        game_designation: player_map.get('game_designation'),
        practice: player_map.get('practice'),
        game_day: player_map.get('game_day'),
        prior_week_inactive: player_map.get('prior_week_inactive'),
        prior_week_ruled_out: player_map.get('prior_week_ruled_out'),
        value: player_map.get('value')
      }

      target_slot = get_default_trade_slot({
        player,
        current_slot,
        roster,
        week: current_season.week,
        is_regular_season: current_season.isRegularSeason
      })
    }

    // Check if this slot needs releases
    if (target_slot === roster_slot_types.BENCH) {
      if (!roster.has_bench_space_for_position(player_map.get('pos'))) {
        needs_active_releases.push(pid)
        all_valid = false
        continue
      }
    } else if (
      target_slot === roster_slot_types.PS ||
      target_slot === roster_slot_types.PSP
    ) {
      if (
        !roster.has_practice_squad_space_for_position(player_map.get('pos'))
      ) {
        needs_ps_releases.push(pid)
        all_valid = false
        continue
      }
    } else if (target_slot === roster_slot_types.RESERVE_SHORT_TERM) {
      if (!roster.has_open_reserve_short_term_slot()) {
        all_valid = false
        continue
      }
    }
    // PSD/PSDP have unlimited space, always valid

    // Try adding player to roster simulation
    try {
      roster.addPlayer({
        slot: target_slot,
        pid,
        pos: player_map.get('pos'),
        value: player_map.get('value')
      })
    } catch (error) {
      if (
        error.message === 'Roster is full' ||
        error.message === 'Player is not eligible'
      ) {
        // Categorize by slot type
        if (isSlotActive(target_slot)) {
          needs_active_releases.push(pid)
        } else if (
          target_slot === roster_slot_types.PS ||
          target_slot === roster_slot_types.PSP
        ) {
          needs_ps_releases.push(pid)
        }
        all_valid = false
      } else {
        throw error
      }
    }
  }

  return {
    is_valid: all_valid,
    needs_active_releases: needs_active_releases.length > 0,
    needs_ps_releases: needs_ps_releases.length > 0,
    active_release_count: needs_active_releases.length,
    ps_release_count: needs_ps_releases.length
  }
}

export const get_trade_selected_team_id = createSelector(
  get_trade,
  get_app,
  get_current_league_team_ids,
  (trade_state, app, team_ids) => {
    let { teamId } = trade_state
    if (!teamId) {
      const myTeamId = app.teamId
      teamId = team_ids.find((teamId) => teamId !== myTeamId)
    }
    return teamId
  }
)

export function get_current_trade(state) {
  const { teamId } = get_app(state)
  const {
    selectedTradeId,
    items,
    proposingTeamPlayers,
    acceptingTeamPlayers,
    acceptingTeamPicks,
    proposingTeamPicks,
    releasePlayers
  } = get_trade(state)

  if (selectedTradeId) {
    const trade = items.get(selectedTradeId)
    const isOpen =
      !trade.cancelled && !trade.rejected && !trade.accepted && !trade.vetoed
    const isAcceptingTeam = trade.accept_tid === teamId
    if (isOpen && isAcceptingTeam) {
      return trade.merge({
        acceptingTeamReleasePlayers: releasePlayers,
        acceptingTeamSlots: get_trade(state).acceptingTeamSlots
      })
    } else {
      return trade
    }
  } else {
    const accept_tid = get_trade_selected_team_id(state)
    return create_trade({
      accept_tid,
      propose_tid: teamId,
      proposingTeamReleasePlayers: releasePlayers,
      acceptingTeamPlayers,
      proposingTeamPlayers,
      acceptingTeamPicks: acceptingTeamPicks.map((pickId) =>
        get_draft_pick_by_id(state, { pickId })
      ),
      proposingTeamPicks: proposingTeamPicks.map((pickId) =>
        get_draft_pick_by_id(state, { pickId })
      ),
      proposingTeamSlots: get_trade(state).proposingTeamSlots,
      acceptingTeamSlots: get_trade(state).acceptingTeamSlots
    })
  }
}

export const get_current_trade_players = createSelector(
  get_current_trade,
  get_app,
  get_trade_selected_team_id,
  get_trade,
  get_rosters_state,
  get_player_maps,
  get_current_league,
  (
    trade,
    app,
    accept_tid_from_state,
    trade_state,
    rosters_state,
    player_maps,
    league
  ) => {
    const { teamId } = app
    const accept_tid = trade.accept_tid || accept_tid_from_state

    const week = Math.min(
      current_season.fantasy_season_week,
      current_season.finalWeek
    )
    const year = current_season.year

    const get_accepting_roster = () => {
      if (!accept_tid) return null
      const rec =
        rosters_state.getIn([accept_tid, year, week]) || new RosterRecord()
      return new Roster({ roster: rec.toJS(), league })
    }

    const accepting_roster = get_accepting_roster()

    const acceptingTeamPlayersArray = trade.acceptingTeamPlayers
      .map((pid) => {
        const player_map = player_maps.get(pid, Map())
        let slot = player_map.get('slot')
        if (accepting_roster) {
          const roster_player = accepting_roster._players.get(pid)
          if (roster_player) {
            slot = roster_player.slot
          }
        }
        return slot ? player_map.set('slot', slot) : player_map
      })
      .filter((player_map) => player_map && player_map.size > 0)
      .toArray()

    const acceptingTeamPlayers = List(acceptingTeamPlayersArray)

    const propose_tid = trade.propose_tid || teamId

    const get_proposing_roster = () => {
      if (!propose_tid) return null
      const rec =
        rosters_state.getIn([propose_tid, year, week]) || new RosterRecord()
      return new Roster({ roster: rec.toJS(), league })
    }

    const proposing_roster = get_proposing_roster()

    const proposingTeamPlayersArray = trade.proposingTeamPlayers
      .map((pid) => {
        const player_map = player_maps.get(pid, Map())
        let slot = player_map.get('slot')
        if (proposing_roster) {
          const roster_player = proposing_roster._players.get(pid)
          if (roster_player) {
            slot = roster_player.slot
          }
        }
        return slot ? player_map.set('slot', slot) : player_map
      })
      .filter((player_map) => player_map && player_map.size > 0)
      .toArray()
    const proposingTeamPlayers = List(proposingTeamPlayersArray)

    const acceptingTeamReleasePlayers = new List(
      trade.acceptingTeamReleasePlayers.map((pid) =>
        player_maps.get(pid, Map())
      )
    )

    const proposingTeamReleasePlayers = new List(
      trade.proposingTeamReleasePlayers.map((pid) =>
        player_maps.get(pid, Map())
      )
    )

    return {
      acceptingTeamPlayers,
      proposingTeamPlayers,
      acceptingTeamReleasePlayers,
      proposingTeamReleasePlayers,
      acceptingTeamSlots: trade_state.acceptingTeamSlots,
      proposingTeamSlots: trade_state.proposingTeamSlots
    }
  }
)

function calculateTradedPicks({ picks, add, remove }) {
  const pickids = remove.map((p) => p.uid)

  let filtered = picks.filter((pick) => !pickids.includes(pick.uid))
  for (const pick of add) {
    filtered = filtered.push(pick)
  }

  return filtered
}

export function get_proposing_team_traded_picks(state) {
  const trade = get_current_trade(state)
  const team = get_team_by_id_for_current_year(state, {
    tid: trade.propose_tid
  })

  return calculateTradedPicks({
    picks: team.picks,
    add: trade.acceptingTeamPicks,
    remove: trade.proposingTeamPicks
  })
}

export function get_accepting_team_traded_picks(state) {
  const trade = get_current_trade(state)
  const team = get_team_by_id_for_current_year(state, { tid: trade.accept_tid })

  return calculateTradedPicks({
    picks: team.picks,
    add: trade.proposingTeamPicks,
    remove: trade.acceptingTeamPicks
  })
}

function calculateTradedRosterPlayers({ state, roster, add, remove, release }) {
  const active_pids = roster.active.map((p) => p.pid)

  const remove_pids = []
  remove.forEach((pid) => remove_pids.push(pid))
  release.forEach((pid) => remove_pids.push(pid))

  const filtered_pids = active_pids.filter((pid) => !remove_pids.includes(pid))
  add.forEach((pid) => filtered_pids.push(pid))

  return filtered_pids.map((pid) => getPlayerById(state, { pid }))
}

export function get_proposing_team_traded_roster_players(state) {
  const trade = get_current_trade(state)
  const roster = getRosterByTeamId(state, { tid: trade.propose_tid })

  return calculateTradedRosterPlayers({
    state,
    roster,
    add: trade.acceptingTeamPlayers,
    release: trade.proposingTeamReleasePlayers,
    remove: trade.proposingTeamPlayers
  })
}

export function get_accepting_team_traded_roster_players(state) {
  const trade = get_current_trade(state)
  const roster = getRosterByTeamId(state, { tid: trade.accept_tid })

  return calculateTradedRosterPlayers({
    state,
    roster,
    add: trade.proposingTeamPlayers,
    release: trade.acceptingTeamReleasePlayers,
    remove: trade.acceptingTeamPlayers
  })
}

function getTeamTradeSummary(
  draft_pick_values,
  { lineups, playerMaps, picks }
) {
  const pts_added_type = current_season.isOffseason ? '0' : 'ros'
  const get_draft_pick_value = (pick) => {
    if (!pick || !draft_pick_values) return 0
    const rank = get_rookie_draft_pick_rank(pick)
    const item = draft_pick_values.find((value) => value.rank === rank)
    if (!item) return 0
    const avg =
      (3 * item.median_best_season_points_added_per_game +
        item.median_career_points_added_per_game) /
      4
    const weeks_remaining =
      current_season.finalWeek - current_season.fantasy_season_week
    return avg * weeks_remaining
  }
  const draft_value = picks.reduce(
    (sum, pick) => sum + get_draft_pick_value(pick),
    0
  )
  const player_value = playerMaps.reduce(
    (sum, pMap) =>
      sum + Math.max(pMap.getIn(['pts_added', pts_added_type], 0), 0),
    0
  )
  const values = {
    points: lineups.reduce((sum, l) => sum + l.baseline_total, 0),
    value: player_value + draft_value,
    player_value,
    draft_value,
    value_adj: playerMaps.reduce(
      (sum, pMap) =>
        sum +
        Math.max(
          pMap.getIn(['salary_adjusted_pts_added', pts_added_type], 0),
          0
        ),
      0
    ),
    salary: playerMaps.reduce((sum, pMap) => sum + pMap.get('value', 0), 0)
  }

  return values
}

export const get_current_trade_analysis = createSelector(
  get_current_trade,
  get_rosters_state,
  get_trade,
  get_teams_for_current_year,
  get_player_maps,
  get_draft_pick_values,
  get_current_league,
  (
    trade,
    rosters_state,
    trade_state,
    teams,
    player_maps,
    draft_pick_values,
    league
  ) => {
    // Helper to get roster record
    const getRosterRecord = (tid) => {
      const week = Math.min(
        current_season.fantasy_season_week,
        current_season.finalWeek
      )
      const year = current_season.year
      return rosters_state.getIn([tid, year, week]) || new RosterRecord()
    }

    const proposingTeamRoster = getRosterRecord(trade.propose_tid)
    const acceptingTeamRoster = getRosterRecord(trade.accept_tid)

    const proposingTeamLineups = proposingTeamRoster
      .get('lineups', new Map())
      .valueSeq()
      .toArray()
    const acceptingTeamLineups = acceptingTeamRoster
      .get('lineups', new Map())
      .valueSeq()
      .toArray()

    const proposingTeamProjectedLineups = trade_state.proposingTeamLineups
      ? trade_state.proposingTeamLineups.valueSeq().toArray()
      : []
    const acceptingTeamProjectedLineups = trade_state.acceptingTeamLineups
      ? trade_state.acceptingTeamLineups.valueSeq().toArray()
      : []

    // Inline the traded picks calculation
    const getTradedPicks = (teamPicks, add, remove) => {
      // Convert Immutable Lists to arrays if needed
      const add_array = List.isList(add) ? add.toArray() : add
      const remove_array = List.isList(remove) ? remove.toArray() : remove

      // Extract pick IDs from remove, handling both pick objects and pick ID strings
      const pickids = remove_array
        .filter((p) => p != null) // Filter out undefined/null values
        .map((p) =>
          typeof p === 'string' || typeof p === 'number' ? p : p.uid
        )
      let filtered = teamPicks.filter((pick) => !pickids.includes(pick.uid))
      // Add new picks, filtering out undefined values
      for (const pick of add_array) {
        if (pick != null) {
          filtered = filtered.push(pick)
        }
      }
      return filtered
    }

    const proposingTeamRecord = teams.get(trade.propose_tid, new Team())
    const acceptingTeamRecord = teams.get(trade.accept_tid, new Team())

    const proposingTeamTradedPicks = getTradedPicks(
      proposingTeamRecord.picks,
      trade.acceptingTeamPicks,
      trade.proposingTeamPicks
    )
    const acceptingTeamTradedPicks = getTradedPicks(
      acceptingTeamRecord.picks,
      trade.proposingTeamPicks,
      trade.acceptingTeamPicks
    )

    // Inline traded roster players calculation
    const getTradedRosterPlayers = (roster, add, remove, release) => {
      const remove_pids = remove.map((pid) => pid)
      const release_pids = release.map((pid) => pid)
      const filtered = roster.all.filter(
        ({ pid }) => !remove_pids.includes(pid) && !release_pids.includes(pid)
      )
      const added = add.map((pid) => {
        const player_map = player_maps.get(pid, Map())
        return { pid, slot: player_map.get('slot') }
      })
      return filtered.concat(added).map(({ pid, slot }) => {
        const player_map = player_maps.get(pid, Map())
        return slot !== undefined ? player_map.set('slot', slot) : player_map
      })
    }

    const proposingTeamTradedPlayers = getTradedRosterPlayers(
      new Roster({ roster: proposingTeamRoster.toJS(), league }),
      trade.acceptingTeamPlayers,
      trade.proposingTeamPlayers,
      trade.proposingTeamReleasePlayers
    )
    const acceptingTeamTradedPlayers = getTradedRosterPlayers(
      new Roster({ roster: acceptingTeamRoster.toJS(), league }),
      trade.proposingTeamPlayers,
      trade.acceptingTeamPlayers,
      trade.acceptingTeamReleasePlayers
    )

    // Get active players
    const getActivePlayers = (tid) => {
      const roster = new Roster({
        roster: getRosterRecord(tid).toJS(),
        league
      })
      return roster.all.map(({ pid, slot }) => {
        const player_map = player_maps.get(pid, Map())
        return slot !== undefined ? player_map.set('slot', slot) : player_map
      })
    }

    const proposingTeamPlayers = getActivePlayers(trade.propose_tid)
    const acceptingTeamPlayers = getActivePlayers(trade.accept_tid)

    const proposingTeam = {
      team: proposingTeamRecord,
      before: getTeamTradeSummary(draft_pick_values, {
        lineups: proposingTeamLineups,
        playerMaps: proposingTeamPlayers,
        picks: proposingTeamRecord.picks
      }),
      after: getTeamTradeSummary(draft_pick_values, {
        lineups: proposingTeamProjectedLineups,
        playerMaps: proposingTeamTradedPlayers,
        picks: proposingTeamTradedPicks
      })
    }

    const acceptingTeam = {
      team: acceptingTeamRecord,
      before: getTeamTradeSummary(draft_pick_values, {
        lineups: acceptingTeamLineups,
        playerMaps: acceptingTeamPlayers,
        picks: acceptingTeamRecord.picks
      }),
      after: getTeamTradeSummary(draft_pick_values, {
        lineups: acceptingTeamProjectedLineups,
        playerMaps: acceptingTeamTradedPlayers,
        picks: acceptingTeamTradedPicks
      })
    }

    return { proposingTeam, acceptingTeam }
  }
)

export function get_proposing_team_players(state) {
  const trade = get_current_trade(state)
  return getPlayersByTeamId(state, { tid: trade.propose_tid })
}

export function get_accepting_team_players(state) {
  const trade = get_current_trade(state)
  return getPlayersByTeamId(state, { tid: trade.accept_tid })
}

export function get_proposing_team(state) {
  const trade = get_current_trade(state)
  return get_team_by_id_for_current_year(state, { tid: trade.propose_tid })
}

export function get_accepting_team(state) {
  const trade = get_current_trade(state)
  return get_team_by_id_for_current_year(state, { tid: trade.accept_tid })
}

export function get_proposing_team_roster(state) {
  const trade = get_current_trade(state)
  return getRosterRecordByTeamId(state, { tid: trade.propose_tid })
}

export function get_accepting_team_roster(state) {
  const trade = get_current_trade(state)
  return getRosterRecordByTeamId(state, { tid: trade.accept_tid })
}

export function getReleaseTransactions(state) {
  return get_transactions(state).get('release')
}

export function getReserveTransactionsByPlayerId(state, { pid }) {
  return get_transactions(state)
    .get('reserve')
    .filter((t) => t.pid === pid)
    .sort((a, b) => b.timestamp - a.timestamp)
}

export function get_waiver_by_id(state, { waiverId }) {
  const waivers = get_waivers_for_current_team(state)
  return waivers.get(waiverId)
}

export function get_waiver_report_items(state) {
  const items = state.getIn(['waivers', 'report']).toJS()
  const grouped = groupBy(items, 'pid')

  const result = []
  for (const playerId in grouped) {
    const waiver = grouped[playerId].find((w) => w.succ)
    const { pid } = grouped[playerId][0]
    result.push({
      pid,
      ...waiver,
      waivers: grouped[playerId].filter((w) => !w.succ)
    })
  }
  return result.sort((a, b) => {
    if (!a.tid) return 1
    if (!b.tid) return -1
    return (b.bid || 0) - (a.bid || 0)
  })
}

export const get_waiver_players_for_current_team = createSelector(
  get_waivers_for_current_team,
  get_player_maps,
  (teamWaivers, player_maps) => {
    for (const waiver of teamWaivers.values()) {
      const pid = waiver.pid
      const player_map = player_maps.get(pid, new Map())
      teamWaivers = teamWaivers.setIn([waiver.uid, 'player_map'], player_map)
      if (waiver.release.size) {
        const releases = []
        for (const pid of waiver.release) {
          const player_map = player_maps.get(pid, new Map())
          releases.push(player_map)
        }
        teamWaivers = teamWaivers.setIn(
          [waiver.uid, 'release'],
          new List(releases)
        )
      } else {
        teamWaivers = teamWaivers.setIn([waiver.uid, 'release'], new List())
      }
    }

    const waivers = teamWaivers.valueSeq().toList()
    const sorted = waivers.sort(
      (a, b) => b.bid - a.bid || a.po - b.po || a.uid - b.uid
    )
    let poach = new List()
    let active = new List()
    let practice = new List()
    for (const w of sorted) {
      if (w.type === waiver_types.FREE_AGENCY) {
        active = active.push(w)
      } else if (w.type === waiver_types.FREE_AGENCY_PRACTICE) {
        practice = practice.push(w)
      } else if (w.type === waiver_types.POACH) {
        poach = poach.push(w)
      }
    }

    return { poach, active, practice }
  }
)

export const get_data_views = createSelector(
  (state) => state.get('data_views'),
  (state) => state.getIn(['app', 'userId']),
  (views, current_user_id) => {
    return views.map((view) =>
      view.set('is_editable', view.get('user_id') === current_user_id)
    )
  }
)

export const get_data_view_by_id = (state, { view_id }) => {
  return state.get('data_views').get(view_id, new Map())
}

export const get_selected_data_view_id = (state) =>
  state.getIn(['app', 'selected_data_view_id'])

export const get_selected_data_view = createSelector(
  get_selected_data_view_id,
  get_data_views,
  (view_id, views) => views.get(view_id, new Map()).toJS()
)

export const get_league_user_historical_ranks = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.getIn(['league_careerlogs']),
  (league_id, league_careerlogs) => {
    const league_careerlogs_data = league_careerlogs.get(`${league_id}`)
    if (!league_careerlogs_data) {
      return {}
    }

    const user_careerlogs = league_careerlogs_data.get('user_careerlogs')
    const rankableFields = [
      'wins',
      'losses',
      'ties',
      'apWins',
      'apLosses',
      'apTies',
      'pf',
      'pa',
      'pdiff',
      'pp',
      'pw',
      'pl',
      'pp_pct',
      'pmax',
      'pmin',
      'weekly_high_scores',
      'post_seasons',
      'championships',
      'championship_rounds',
      'regular_season_leader',
      'num_byes',
      'best_season_win_pct',
      'best_season_all_play_pct',
      'wildcards',
      'wildcard_wins',
      'wildcard_highest_score',
      'wildcard_total_points',
      'wildcard_lowest_score',
      'championship_highest_score',
      'championship_total_points',
      'championship_lowest_score',
      'worst_regular_season_finish',
      'best_regular_season_finish',
      'best_overall_finish',
      'worst_overall_finish',
      'division_wins'
    ]

    const ranks = {}
    user_careerlogs.forEach((user_careerlog) => {
      const result = {}
      rankableFields.forEach((field) => {
        const value = user_careerlog[field]
        result[field] = value

        // Calculate rank
        const sortedValues = user_careerlogs
          .map((log) => log[field])
          .sort((a, b) => b - a) // Sort in descending order
        const rank = sortedValues.indexOf(value) + 1
        result[`${field}_rank`] = rank
      })

      // Add non-rankable fields
      result.first_season_year = user_careerlog.first_season_year
      result.last_season_year = user_careerlog.last_season_year
      result.num_seasons = user_careerlog.num_seasons
      result.userid = user_careerlog.userid
      result.username = user_careerlog.username

      ranks[user_careerlog.userid] = result
    })

    return ranks
  }
)

export const get_league_team_historical_ranks = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.getIn(['league_careerlogs']),
  (league_id, league_careerlogs) => {
    const league_careerlogs_data = league_careerlogs.get(`${league_id}`)
    if (!league_careerlogs_data) {
      return {}
    }

    const team_careerlogs = league_careerlogs_data.get('team_careerlogs')
    const rankableFields = [
      'wins',
      'losses',
      'ties',
      'apWins',
      'apLosses',
      'apTies',
      'pf',
      'pa',
      'pdiff',
      'pp',
      'pw',
      'pl',
      'pp_pct',
      'pmax',
      'pmin',
      'weekly_high_scores',
      'post_seasons',
      'championships',
      'championship_rounds',
      'regular_season_leader',
      'num_byes',
      'best_season_win_pct',
      'best_season_all_play_pct',
      'wildcards',
      'wildcard_wins',
      'wildcard_highest_score',
      'wildcard_total_points',
      'wildcard_lowest_score',
      'championship_highest_score',
      'championship_total_points',
      'championship_lowest_score',
      'worst_regular_season_finish',
      'best_regular_season_finish',
      'best_overall_finish',
      'worst_overall_finish',
      'division_wins'
    ]

    const ranks = {}
    team_careerlogs.forEach((team_careerlog) => {
      const result = {}
      rankableFields.forEach((field) => {
        const value = team_careerlog[field]
        result[field] = value

        // Calculate rank
        const sortedValues = team_careerlogs
          .map((log) => log[field])
          .sort((a, b) => b - a) // Sort in descending order
        const rank = sortedValues.indexOf(value) + 1
        result[`${field}_rank`] = rank
      })

      // Add non-rankable fields
      result.first_season_year = team_careerlog.first_season_year
      result.last_season_year = team_careerlog.last_season_year
      result.num_seasons = team_careerlog.num_seasons
      result.tid = team_careerlog.tid

      ranks[team_careerlog.tid] = result
    })

    return ranks
  }
)

export function get_league_historical_ranks_by_team_id(state, { tid }) {
  const league_historical_ranks = get_league_team_historical_ranks(state)
  return league_historical_ranks[tid] || {}
}
