import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc.js'
import { createSelector } from 'reselect'
import Immutable, { Map, List } from 'immutable'

import {
  constants,
  bookmaker_constants,
  Roster,
  isSlotActive,
  calculatePoints,
  isOnReleaseWaivers,
  getExtensionAmount,
  isReserveEligible,
  calculateStatsFromPlayStats,
  calculateDstStatsFromPlays,
  getYardlineInfoFromString,
  isReserveCovEligible,
  isSantuaryPeriod,
  getDraftDates,
  get_free_agent_period,
  getDraftWindow,
  groupBy,
  fixTeam,
  is_league_post_season_week,
  get_last_consecutive_pick,
  league_has_starting_position
} from '@libs-shared'
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
  state.getIn(['teams', constants.year], new Map())
export const get_team_by_id_for_year = (
  state,
  { tid, year = constants.year }
) => state.getIn(['teams', year, tid], new Team())
export const get_team_by_id_for_current_year = (state, { tid }) =>
  state.getIn(['teams', constants.year, tid], new Team())
export const get_scoreboard = (state) => state.get('scoreboard')
export const get_props = (state) => state.getIn(['props', 'items'])
export const get_plays = (state, { week = constants.week } = {}) =>
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
export const get_gamelog_by_player_id = (
  state,
  { pid, week, year = constants.year }
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
    constants.positions.filter((pos) =>
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
      [teamId, constants.year, constants.fantasy_season_week],
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
      constants.fantasy_season_week,
      constants.season.finalWeek
    )
    const year = constants.year
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
    for (const playerMap of currentPlayers.active) {
      const pid = playerMap.get('pid')
      if (!pid) continue
      filtered = filtered.set(pid, playerMap)
    }

    const search = auction.get('search')
    if (search) {
      filtered = filtered.filter((pMap) =>
        fuzzy_search(search, pMap.get('name', ''))
      )
    }
    return filtered.sort(
      (a, b) =>
        b.getIn(['pts_added', '0'], constants.default_points_added) -
        a.getIn(['pts_added', '0'], constants.default_points_added)
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
      (sum, playerMap) => sum + (playerMap.getIn(['market_salary', '0']) || 0),
      0
    )
    const actual = active_rostered.reduce(
      (sum, playerMap) => sum + (playerMap.get('value') || 0),
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

    const playerMap = playerMaps.get(pid)
    if (!playerMap) {
      return false
    }

    const pos = playerMap.get('pos')
    if (!pos) {
      return false
    }

    const ros = new Roster({ roster: roster.toJS(), league })
    return ros.hasOpenBenchSlot(pos)
  }
)

export const is_free_agent_period = createSelector(
  get_current_league,
  (league) => {
    if (!league.free_agency_live_auction_start) {
      return false
    }

    const faPeriod = get_free_agent_period(league)
    return constants.season.now.isBetween(faPeriod.start, faPeriod.end)
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
          constants.season.now.isAfter(p.draftWindow) || previousSelected

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

export function is_player_drafted(state, { pid, playerMap = new Map() }) {
  pid = pid || playerMap.get('pid')
  if (!pid) {
    return false
  }

  const { drafted } = state.get('draft')
  return drafted.includes(pid)
}

export const get_rookie_draft_end = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  get_rookie_draft_last_pick,
  get_draft_state,
  (leagueId, leagues, lastPick, draft) => {
    if (!lastPick) {
      return null
    }

    const league = leagues.get(leagueId, new League())
    if (lastPick.selection_timestamp) {
      return dayjs
        .unix(lastPick.selection_timestamp)
        .tz('America/New_York')
        .endOf('day')
    }

    const { picks } = draft
    const last_consecutive_pick = get_last_consecutive_pick(picks.toJS())
    const draftEnd = getDraftWindow({
      last_consecutive_pick,
      start: league.draft_start,
      pickNum: lastPick.pick + 1,
      type: league.draft_type,
      min: league.draft_hour_min,
      max: league.draft_hour_max
    })

    return draftEnd
  }
)

export const is_after_rookie_draft = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  get_rookie_draft_end,
  (leagueId, leagues, draftEnd) => {
    if (constants.isRegularSeason) {
      return {
        afterDraft: true,
        afterWaivers: true
      }
    }

    const league = leagues.get(leagueId, new League())
    const afterDraft =
      league.draft_start && draftEnd && dayjs().isAfter(draftEnd)
    const afterWaivers =
      league.draft_start &&
      draftEnd &&
      dayjs().isAfter(
        draftEnd.tz('America/New_York').endOf('day').add(1, 'day')
      )
    return {
      afterDraft,
      afterWaivers
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

      if (constants.season.now.isAfter(draftDates.draftEnd)) {
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
    constants.season.finalWeek - constants.fantasy_season_week

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
    return constants.season.now.isBefore(deadline)
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
    return constants.season.now.isBefore(deadline)
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
    return constants.season.now.isBefore(deadline)
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

    const firstDayOfRegularSeason = constants.season.regular_season_start.add(
      '1',
      'week'
    )
    if (now.isBefore(firstDayOfRegularSeason)) {
      events.push({
        detail: 'Regular Season Begins',
        date: firstDayOfRegularSeason
      })
    }

    const firstWaiverDate = constants.season.regular_season_start
      .add('1', 'week')
      .day(3)
      .hour(15)
    if (now.isBefore(firstWaiverDate)) {
      events.push({
        detail: 'Regular Season Waivers Clear',
        date: firstWaiverDate
      })
    } else if (constants.isRegularSeason) {
      const waiverDate = constants.season.now.day(3).hour(15).minute(0)
      const nextWaiverDate = now.isBefore(waiverDate)
        ? waiverDate
        : waiverDate.add('1', 'week')

      events.push({
        detail: 'Waivers Processed',
        date: nextWaiverDate
      })
    }

    if (now.isBefore(constants.season.openingDay)) {
      events.push({
        detail: 'NFL Opening Day',
        date: constants.season.openingDay
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

    if (now.isBefore(constants.season.end)) {
      events.push({
        detail: 'Offseason Begins',
        date: constants.season.end
      })
    }

    return events.sort((a, b) => a.date.unix() - b.date.unix())
  }
)

export const get_regular_season_weeks = createSelector(
  (state) => state.getIn(['matchups', 'matchups_by_id']).toList(),
  (state) => state.getIn(['app', 'year'], constants.year),
  (matchups, year) =>
    matchups
      .filter((m) => m.year === year)
      .map((m) => m.week)
      .sort((a, b) => a - b)
)

export const get_post_season_weeks = createSelector(
  (state) => state.getIn(['matchups', 'playoffs']),
  (state) => state.getIn(['app', 'year'], constants.year),
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
  const year = state.getIn(['app', 'year'], constants.year)
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
  const year = state.getIn(['app', 'year'], constants.year)
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
  if (matchup.week === constants.season.finalWeek) {
    const prevWeek = constants.season.finalWeek - 1
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
  const year = state.getIn(['app', 'year'], constants.year)
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
      if (constants.positions.includes(week)) continue
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
      (pMap) => pMap.get('tag') === constants.tags.RESTRICTED_FREE_AGENCY
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

  return playerMaps.reduce((sum, playerMap) => {
    const value = playerMap.get('value')
    const extensions = playerMap.get('extensions', 0)
    const bid = playerMap.get('bid', 0)
    const salary = isBeforeExtension
      ? getExtensionAmount({
          pos: playerMap.get('pos'),
          tag: playerMap.get('tag'),
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
  const playerMap = getSelectedPlayer(state)
  return get_game_by_team(state, { nfl_team: playerMap.get('team'), week })
}

export function getSelectedPlayerGames(state) {
  const playerMap = getSelectedPlayer(state)
  return getGamesByTeam(state, { nfl_team: playerMap.get('team') })
}

// used by editable baseline component
export function getPlayersByPosition(state, { position }) {
  const playerMaps = get_player_maps(state)
  const filtered = playerMaps.filter((p) => p.pos === position)
  const period = !constants.week ? '0' : 'ros'
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
    .filter((pMap) => pMap.get('nfl_draft_year') === constants.year)
    .toList()
)

export function getPlayerById(state, { pid, playerMap }) {
  if (playerMap) return playerMap
  const playerMaps = get_player_maps(state)
  return playerMaps.get(pid) || new Map()
}

export function getGamesByYearForSelectedPlayer(state) {
  const pid = state.get('players').get('selected')
  const playerMap = getPlayerById(state, { pid })
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
    for (const stat of constants.fantasyStats) {
      initialValue[stat] = 0
    }

    const sum = years[year].reduce((sums, obj) => {
      const stats = Object.keys(obj).filter((k) => constants.stats.includes(k))
      stats.forEach((k) => {
        sums[k] += obj[k] || 0
      })
      return sums
    }, initialValue)
    const points = calculatePoints({
      stats: sum,
      position: playerMap.get('pos'),
      league: league.toJS()
    })
    sum.total = points.total
    overall[year] = sum
  }

  return { years, overall }
}

export const isPlayerOnReleaseWaivers = createSelector(
  getReleaseTransactions,
  (state, { pid }) => pid,
  (transactions, pid) => {
    const player_transactions = transactions.filter((t) => t.pid === pid).toJS()
    return isOnReleaseWaivers({ transactions: player_transactions })
  }
)

export function isPlayerReserveEligible(state, { playerMap }) {
  const reserve = {
    ir: false,
    cov: false
  }

  const nfl_status = playerMap.get('nfl_status')
  const injury_status = playerMap.get('injury_status')

  if (
    isReserveEligible({
      nfl_status,
      injury_status
    })
  ) {
    reserve.ir = true
  }

  if (
    isReserveCovEligible({
      nfl_status
    })
  ) {
    reserve.cov = true
  }

  return reserve
}

export function isPlayerLocked(state, { playerMap = new Map(), pid }) {
  if (constants.week > constants.season.finalWeek) {
    return true
  }

  if (pid) {
    playerMap = getPlayerById(state, { pid })
  }

  if (!playerMap.get('pid')) {
    return false
  }

  if (playerMap.get('nfl_status') === constants.player_nfl_status.INACTIVE) {
    return false
  }

  const game = get_game_by_team(state, { nfl_team: playerMap.get('team') })
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

export function getPlayerStatus(state, { playerMap = new Map(), pid }) {
  if (pid) {
    playerMap = getPlayerById(state, { pid })
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
      ir: false,
      ir_long_term: false,
      covid: false
    }
  }

  if (!playerMap.get('pid')) {
    return status
  }

  const league = get_current_league(state)
  const playerTag = playerMap.get('tag')
  const playerSlot = playerMap.get('slot')
  const playerId = playerMap.get('pid')
  const bid = playerMap.get('bid')
  status.restricted_free_agent_bid_exists =
    bid !== null && bid !== undefined && Number(bid) >= 0
  status.tagged.rookie = playerTag === constants.tags.ROOKIE
  status.tagged.restrictedFreeAgency =
    playerTag === constants.tags.RESTRICTED_FREE_AGENCY
  status.tagged.franchise = playerTag === constants.tags.FRANCHISE
  status.protected =
    playerSlot === constants.slots.PSP || playerSlot === constants.slots.PSDP
  status.starter = constants.starterSlots.includes(playerSlot)
  status.locked = isPlayerLocked(state, { playerMap })
  status.active = isSlotActive(playerSlot)

  const isFreeAgent = isPlayerFreeAgent(state, { playerMap })
  status.fa = isFreeAgent
  if (isFreeAgent) {
    const { isWaiverPeriod, isRegularSeason } = constants.season
    if (isRegularSeason && isWaiverPeriod) {
      status.waiver.active = true
      const isPracticeSquadEligible = isPlayerPracticeSquadEligible(state, {
        playerMap
      })
      if (isPracticeSquadEligible) status.waiver.practice = true
    } else if (is_free_agent_period(state)) {
      status.waiver.active = true
      status.waiver.practice = true
    } else {
      const onReleaseWaivers = isPlayerOnReleaseWaivers(state, {
        pid: playerId
      })
      const draft = is_after_rookie_draft(state)
      const isPracticeSquadEligible = isPlayerPracticeSquadEligible(state, {
        playerMap
      })
      if (onReleaseWaivers) {
        if (isRegularSeason) status.waiver.active = true
        if (draft.afterDraft && isPracticeSquadEligible)
          status.waiver.practice = true
      } else {
        if (isRegularSeason && !status.locked) {
          status.sign.active = true
        }
        if (isPracticeSquadEligible && !status.locked) {
          if (draft.afterWaivers) status.sign.practice = true
          else if (draft.afterDraft) status.waiver.practice = true
        }
      }
    }
  } else {
    const roster = getCurrentTeamRoster(state)

    const restricted_free_agency_tag_processed = playerMap.get(
      'restricted_free_agency_tag_processed'
    )

    if (
      status.tagged.restrictedFreeAgency &&
      !restricted_free_agency_tag_processed
    ) {
      status.eligible.restrictedFreeAgencyBid = true
    }

    status.tagged.restricted_free_agency_nominated = playerMap.get(
      'restricted_free_agency_tag_nominated'
    )
    status.tagged.restricted_free_agency_announced = playerMap.get(
      'restricted_free_agency_tag_announced'
    )

    if (roster.has(playerId)) {
      status.rostered = true

      // if before extension deadline
      //     was player a rookie last year
      //     otherwise are they a rookie now
      const isBeforeExtension = is_before_extension_deadline(state)
      const draft_year = playerMap.get('nfl_draft_year')
      if (isBeforeExtension && draft_year === constants.year - 1) {
        status.eligible.rookieTag = true
      } else if (draft_year === constants.year) {
        status.eligible.rookieTag = true
      }

      if (constants.week > 0 || isBeforeExtension) {
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
        // can not activate long term IR player during regular season
        status.eligible.activate = !(
          constants.isRegularSeason &&
          playerSlot === constants.slots.IR_LONG_TERM
        )

        // is regular season and is on practice squad && has no poaching claims
        const leaguePoaches = get_poaches_for_current_league(state)
        if (
          constants.isRegularSeason &&
          (playerSlot === constants.slots.PS ||
            playerSlot === constants.slots.PSD) &&
          !leaguePoaches.has(playerId)
        ) {
          status.eligible.protect = true
        }
      }

      if (isPlayerPracticeSquadEligible(state, { playerMap })) {
        status.eligible.ps = true
      }

      if (!status.protected && constants.week <= constants.season.finalWeek) {
        const reserve = isPlayerReserveEligible(state, { playerMap })
        if (
          reserve.ir &&
          playerSlot !== constants.slots.IR &&
          playerSlot !== constants.slots.IR_LONG_TERM
        ) {
          status.reserve.ir = true
        }

        if (reserve.ir && playerSlot !== constants.slots.IR_LONG_TERM) {
          status.reserve.ir_long_term = true
        }

        if (
          reserve.cov &&
          playerSlot !== constants.slots.COV &&
          constants.isRegularSeason
        ) {
          status.reserve.cov = true
        }
      }
    } else if (isPlayerOnPracticeSquad(state, { playerMap })) {
      const is_sanctuary_period = isSantuaryPeriod(league)
      // make sure player is unprotected and it is not a santuary period
      if (
        playerSlot === constants.slots.PS ||
        playerSlot === constants.slots.PSD
      ) {
        const rosterInfo = getRosterInfoForPlayerId(state, {
          pid: playerId
        })
        const sanctuaryEnd = dayjs.unix(rosterInfo.timestamp).add('24', 'hours')
        const cutoff = dayjs.unix(rosterInfo.timestamp).add('48', 'hours')

        // check if player has existing poaching claim and is after sanctuary period
        const leaguePoaches = get_poaches_for_current_league(state)
        if (
          !leaguePoaches.has(playerId) &&
          dayjs().isAfter(sanctuaryEnd) &&
          !is_sanctuary_period
        ) {
          status.eligible.poach = true
        }

        if (
          ((rosterInfo.type === constants.transactions.ROSTER_DEACTIVATE ||
            rosterInfo.type === constants.transactions.DRAFT ||
            rosterInfo.type === constants.transactions.PRACTICE_ADD) &&
            dayjs().isBefore(cutoff)) ||
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
  { playerMap = new Map() }
) {
  const pid = playerMap.get('pid')
  if (!pid) {
    return false
  }

  const acceptable_types = [
    constants.transactions.ROSTER_ADD,
    constants.transactions.TRADE,
    constants.transactions.DRAFT,
    constants.transactions.RESERVE_IR,
    constants.transactions.RESERVE_COV
  ]
  const type = playerMap.get('type')
  if (type && !acceptable_types.includes(type)) {
    return false
  }

  const rosterInfo = getRosterInfoForPlayerId(state, { pid })

  // if player is a FA during the offseason, they must be either:
  // - a rookie
  // - not on a nfl team
  if (
    !rosterInfo.tid && // not on a team
    !constants.isRegularSeason && // during the offseason
    playerMap.get('nfl_draft_year') !== constants.year && // not a rookie
    playerMap.get('team') !== 'INA' // not on a nfl team
  ) {
    return false
  }

  const { teamId } = get_app(state)

  // not eligible if already on another team
  if (rosterInfo.tid && rosterInfo.tid !== teamId) {
    return false
  }

  // not eligible if already on pracice squad
  const onPracticeSquad = isPlayerOnPracticeSquad(state, { playerMap })
  if (onPracticeSquad) {
    return false
  }

  const rosterRec = get_current_team_roster_record(state)
  const rosterPlayers = rosterRec.get('players')
  const rosterPlayer = rosterPlayers.find((p) => p.pid === pid)

  if (!rosterPlayer) {
    return true
  }

  // not eligible if player is on long term IR
  if (rosterPlayer.slot === constants.slots.IR_LONG_TERM) {
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
    (t) => t.type === constants.transactions.ROSTER_ACTIVATE
  )
  if (activations.size) {
    return false
  }

  // not eligible if player has been poached
  const poaches = transactions.filter(
    (t) => t.type === constants.transactions.POACHED
  )
  if (poaches.size) {
    return false
  }

  // if reserve player, must have been on practice squad previously
  const ps_types = [
    constants.transactions.ROSTER_DEACTIVATE,
    constants.transactions.PRACTICE_ADD,
    constants.transactions.DRAFT
  ]
  if (rosterInfo.slot === constants.slots.IR) {
    for (const tran of transactions.values()) {
      if (ps_types.includes(tran.type)) {
        break
      }

      if (
        tran.type === constants.transactions.ROSTER_ADD ||
        tran.type === constants.transactions.TRADE
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

export function get_plays_for_player(state, { playerMap, week }) {
  const plays = get_plays(state, { week })
  const formatted = plays.valueSeq().toList()

  const playerTeam = playerMap.get('team')
  if (playerMap.get('pos') === 'DST') {
    return formatted.filter((p) => {
      if (fixTeam(p.h) !== playerTeam && fixTeam(p.v) !== playerTeam) {
        return false
      }

      return (
        (Boolean(p.pos_team) && fixTeam(p.pos_team) !== playerMap.get('pid')) ||
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
        (ps.gsisId && ps.gsisId === playerMap.get('gsisid')) ||
        (ps.gsispid && ps.gsispid === playerMap.get('gsispid'))
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
    const playerMap = getPlayerById(state, { pid })
    poachPlayers.push(poach.set('playerMap', playerMap))
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

    const playerMap = getPlayerById(state, { pid })

    const slot = playerMap.get('slot')
    if (slot !== constants.slots.PS && slot !== constants.slots.PSD) {
      poaches = poaches.delete(pid)
      continue
    }

    poaches = poaches.setIn([pid, 'playerMap'], playerMap)
    if (poach.release.size) {
      const releases = []
      for (const pid of poach.release) {
        const playerMap = getPlayerById(state, { pid })
        releases.push(playerMap)
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
    const playerMap = getPlayerById(state, { pid: prop.pid })
    const proj = playerMap.getIn(['projection', `${prop.week}`], {})
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

      case bookmaker_constants.player_prop_types
        .GAME_RUSHING_RECEIVING_TOUCHDOWNS:
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
      week = Math.min(constants.fantasy_season_week, constants.season.finalWeek)
    }
  ) => week,
  (state, { year = constants.year }) => year,
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
  (roster, players) => roster.all.map(({ pid }) => players.get(pid, new Map()))
)

export function getStartersByTeamId(state, { tid, week }) {
  const roster = getRosterByTeamId(state, { tid, week })
  return roster.starters.map(({ pid, slot }) => {
    const playerMap = getPlayerById(state, { pid })
    return playerMap.set('slot', slot)
  })
}

export function getActivePlayersByTeamId(
  state,
  { tid, week = constants.fantasy_season_week }
) {
  const roster = getRosterByTeamId(state, { tid, week })
  return roster.active.map(({ pid }) => getPlayerById(state, { pid }))
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
  { pid, playerMap = new Map() }
) {
  pid = pid || playerMap.get('pid')
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
        if (constants.ps_slots.includes(slot)) {
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
        if (constants.ps_unprotected_slots.includes(slot)) {
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
        if (constants.ps_protected_slots.includes(slot)) {
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
          slot === constants.slots.IR ||
          slot === constants.slots.IR_LONG_TERM
        ) {
          pids.push(pid)
        }
      })
    }
    return new List(pids)
  }
)

export function isPlayerFreeAgent(state, { playerMap }) {
  const rostered = get_rostered_player_ids_for_current_league(state)
  return !rostered.includes(playerMap.get('pid'))
}

export function isPlayerOnPracticeSquad(state, { playerMap }) {
  const practiceSquads = get_practice_squad_player_ids_for_current_league(state)
  return practiceSquads.includes(playerMap.get('pid'))
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

    const seasonType = constants.isOffseason ? '0' : 'ros'
    for (const position of constants.positions) {
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
      constants.fantasy_season_week,
      constants.season.finalWeek
    )
    const roster = rosters.getIn([tid, constants.year, week])
    if (!roster) {
      return {
        active: new List(),
        practice: new List(),
        practice_signed: new List(),
        practice_drafted: new List(),
        ir: new List(),
        ir_long_term: new List(),
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
    const ir = new List(r.ir.map(({ pid }) => player_items.get(pid, new Map())))
    const ir_long_term = new List(
      r.ir_long_term.map(({ pid }) => player_items.get(pid, new Map()))
    )
    const cov = new List(
      r.cov.map(({ pid }) => player_items.get(pid, new Map()))
    )

    const players = active
      .concat(practice)
      .concat(ir)
      .concat(cov)
      .concat(ir_long_term)

    return {
      active,
      practice,
      practice_signed,
      practice_drafted,
      players,
      ir,
      ir_long_term,
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
  const playerMap = getPlayerById(state, { pid })
  return get_game_by_team(state, { nfl_team: playerMap.get('team'), week })
}

export function getByeByTeam(state, { nfl_team }) {
  return state.getIn(['schedule', 'teams', nfl_team, 'bye'])
}

export function get_game_by_team(
  state,
  { nfl_team, week = Math.max(constants.week, 1) }
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
  const isFuture = year === constants.year && week > constants.week
  return getRosterByTeamId(state, {
    tid,
    week: isFuture ? constants.week : week,
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
  starterMaps.forEach((playerMap) => {
    const gamelog = get_gamelog_for_player(state, { playerMap, week })
    if (gamelog) points += gamelog.total
  })
  return points
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
    constants.season.finalWeek
  const championship_round_first_week =
    Math.min(...season.get('championship_round', [])) ||
    constants.season.finalWeek - 1
  const is_championship_round = matchup.week === championship_round_final_week

  // TODO - set flag for processed matchup
  // check matchup points to see if it has any truthy values (means it has been processed)
  // check if matchup tids includes tid, tid might belong to a team not in the matchup (wildcard round and championship round)
  const team_index = matchup.tids.indexOf(tid)
  if (matchup.points.some((p) => Boolean(p)) && team_index >= 0) {
    let points =
      matchup.points_manual.get(team_index) || matchup.points.get(team_index)
    let projected_points = matchup.projections.get(team_index)

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
    }

    return create_scoreboard({
      tid,
      points,
      projected: projected_points,
      minutes,
      matchup
    })
  }

  let points = is_championship_round
    ? getPointsByTeamId(state, { tid, week: championship_round_first_week })
    : 0
  const previousWeek = points

  // TODO - instead use matchup projected value
  const isFuture = year === constants.year && matchup.week > constants.week
  const starterMaps = getStartersByTeamId(state, {
    tid,
    week: isFuture ? constants.week : matchup.week
  })
  for (const playerMap of starterMaps) {
    const gamelog = get_gamelog_for_player(state, {
      playerMap,
      week: matchup.week
    })
    if (gamelog) {
      points += gamelog.total
      const gameStatus = getGameStatusByPlayerId(state, {
        pid: playerMap.get('pid'),
        week: matchup.week
      })
      if (gameStatus && gameStatus.lastPlay) {
        const lp = gameStatus.lastPlay
        const quarterMinutes =
          lp.desc === 'END GAME'
            ? 0
            : Number((lp.game_clock_start || '').split(':').pop()) // TODO - double check
        const quartersRemaining = lp.qtr === 5 ? 0 : 4 - lp.qtr
        minutes += quartersRemaining * 15 + quarterMinutes
      }
    } else {
      minutes += 60
    }
    const add = gamelog
      ? gamelog.total
      : playerMap.getIn(['points', `${matchup.week}`, 'total'], 0)

    projected += add
  }

  return create_scoreboard({
    tid,
    points: Number(points.toFixed(2)),
    projected: Number((projected + previousWeek).toFixed(2)),
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
  for (const playerMap of playerMaps) {
    if (!playerMap.get('pid')) continue
    const game = get_game_by_team(state, {
      nfl_team: playerMap.get('team'),
      week: matchup.week
    })
    if (!game) continue
    const dateStr = `${game.date} ${game.time_est}`
    if (!games[dateStr]) games[dateStr] = []
    games[dateStr].push(playerMap)
  }

  return { matchup, games, teams }
}

export function getScoreboardGamelogByPlayerId(state, { pid }) {
  const playerMap = getPlayerById(state, { pid })

  if (!playerMap.get('pid')) return

  const week = state.getIn(['scoreboard', 'week'])
  const year = state.getIn(['app', 'year'])
  return get_gamelog_for_player(state, { playerMap, week, year })
}

export function getPlaysByMatchupId(state, { mid }) {
  const matchup = get_selected_matchup(state)
  if (!matchup) return new List()

  const playerMaps = matchup.tids.reduce((arr, tid) => {
    const starters = getStartersByTeamId(state, { tid, week: matchup.week })
    return arr.concat(starters)
  }, [])
  const gsisids = playerMaps.map((pMap) => pMap.get('gsisid')).filter(Boolean)
  if (!gsisids.length) return new List()

  const gsispids = playerMaps.map((pMap) => pMap.get('gsispid')).filter(Boolean)

  const plays = get_plays(state, { week: matchup.week })
  // TODO - match/filter dst plays
  const filteredPlays = plays
    .valueSeq()
    .toList()
    .filter((p) => {
      if (!p.playStats) return false

      const matchSingleGsis = p.playStats.find((p) =>
        gsisids.includes(p.gsisId)
      )
      if (matchSingleGsis) return true

      const matchSingleGsisPid = p.playStats.find((p) =>
        gsispids.includes(p.gsispid)
      )
      return Boolean(matchSingleGsisPid)
    })

  const league = get_current_league(state)
  let result = new List()
  for (const play of filteredPlays) {
    const game = get_game_by_team(state, {
      nfl_team: fixTeam(play.pos_team),
      week: matchup.week
    })

    if (!game) continue

    // TODO - calculate dst stats and points
    const playStats = play.playStats.filter((p) => p.gsispid || p.gsisId)
    const grouped = {}
    for (const playStat of playStats) {
      const playerMap = playerMaps.find((pMap) => {
        if (playStat.gsispid && pMap.get('gsispid', false) === playStat.gsispid)
          return true
        if (playStat.gsisId && pMap.get('gsisid', false) === playStat.gsisId)
          return true
        return false
      })
      if (!playerMap) continue
      const pid = playerMap.get('pid')
      if (!grouped[pid]) grouped[pid] = []
      grouped[pid].push(playStat)
    }
    const points = {}
    const stats = {}
    for (const pid in grouped) {
      const playerMap = playerMaps.find((pMap) => pMap.get('pid') === pid)
      const playStats = grouped[pid]
      stats[pid] = calculateStatsFromPlayStats(playStats)
      points[pid] = calculatePoints({
        stats: stats[pid],
        position: playerMap.get('pos'),
        league
      })
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
      time = dayjs() // default to current time if date is invalid or missing
    }
    result = result.push({
      time: time.unix(),
      play,
      game,
      stats,
      points
    })
  }

  return result.sort((a, b) => b.time - a.time)
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

export function getGameStatusByPlayerId(state, { pid, week = constants.week }) {
  const game = getGameByPlayerId(state, { pid, week })
  if (!game) {
    return null
  }

  const plays = get_plays(state, { week })
  const playerMap = getPlayerById(state, { pid })
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

  const hasPossession = fixTeam(lastPlay.pos_team) === playerMap.get('team')
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

export const getGamelogsForSelectedPlayer = createSelector(
  getSelectedPlayer,
  get_player_gamelogs,
  (playerMap, gamelogs) => {
    const pid = playerMap.get('pid')
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
  { playerMap, week, year = constants.year }
) {
  if (!playerMap || !playerMap.get('pid')) return null

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

  const pid = playerMap.get('pid')
  const gamelog = get_gamelog_by_player_id(state, { pid, week, year })
  if (gamelog) return process(gamelog)

  // TODO should handle year
  const plays = get_plays_for_player(state, { playerMap, week }).toJS()
  if (!plays.length) return null

  const pos = playerMap.get('pos')
  const stats =
    pos === 'DST'
      ? calculateDstStatsFromPlays(plays, playerMap.get('team'))
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
  release_pids.forEach((pid) => roster.removePlayer(pid))
  remove_pids.forEach((pid) => roster.removePlayer(pid))
  for (const pid of add_pids) {
    const playerMap = playerMaps.get(pid)
    const hasOpenBenchSlot = roster.hasOpenBenchSlot(playerMap.get('pos'))
    if (!hasOpenBenchSlot) {
      return false
    }
    roster.addPlayer({
      slot: constants.slots.BENCH,
      pid,
      pos: playerMap.get('pos'),
      value: playerMap.get('value')
    })
  }

  return true
}

export function get_trade_selected_team_id(state) {
  let { teamId } = get_trade(state)
  if (!teamId) {
    const myTeamId = get_app(state).teamId
    teamId = get_current_league_team_ids(state).find(
      (teamId) => teamId !== myTeamId
    )
  }

  return teamId
}

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
      return trade.merge({ acceptingTeamReleasePlayers: releasePlayers })
    } else {
      return trade
    }
  } else {
    const { teamId } = get_app(state)
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
      )
    })
  }
}

export function get_current_trade_players(state) {
  const trade = get_current_trade(state)

  const acceptingTeamPlayers = new List(
    trade.acceptingTeamPlayers.map((pid) => getPlayerById(state, { pid }))
  )

  const proposingTeamPlayers = new List(
    trade.proposingTeamPlayers.map((pid) => getPlayerById(state, { pid }))
  )

  const acceptingTeamReleasePlayers = new List(
    trade.acceptingTeamReleasePlayers.map((pid) =>
      getPlayerById(state, { pid })
    )
  )

  const proposingTeamReleasePlayers = new List(
    trade.proposingTeamReleasePlayers.map((pid) =>
      getPlayerById(state, { pid })
    )
  )

  return {
    acceptingTeamPlayers,
    proposingTeamPlayers,
    acceptingTeamReleasePlayers,
    proposingTeamReleasePlayers
  }
}

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

function getTeamTradeSummary(state, { lineups, playerMaps, picks }) {
  const pts_added_type = constants.isOffseason ? '0' : 'ros'
  const draft_value = picks.reduce(
    (sum, pick) => sum + get_draft_pick_value_by_pick(state, { pick }),
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

export function get_current_trade_analysis(state) {
  const trade = get_current_trade(state)

  const proposingTeamRoster = getRosterRecordByTeamId(state, {
    tid: trade.propose_tid
  })
  const acceptingTeamRoster = getRosterRecordByTeamId(state, {
    tid: trade.accept_tid
  })

  const proposingTeamLineups = proposingTeamRoster
    .get('lineups', new Map())
    .valueSeq()
    .toArray()
  const acceptingTeamLineups = acceptingTeamRoster
    .get('lineups', new Map())
    .valueSeq()
    .toArray()

  const proposingTeamProjectedLineups = state
    .getIn(['trade', 'proposingTeamLineups'], new Map())
    .valueSeq()
    .toArray()
  const acceptingTeamProjectedLineups = state
    .getIn(['trade', 'acceptingTeamLineups'], new Map())
    .valueSeq()
    .toArray()

  const proposingTeamTradedPicks = get_proposing_team_traded_picks(state)
  const acceptingTeamTradedPicks = get_accepting_team_traded_picks(state)

  const proposingTeamTradedPlayers =
    get_proposing_team_traded_roster_players(state)
  const acceptingTeamTradedPlayers =
    get_accepting_team_traded_roster_players(state)

  const proposingTeamPlayers = getActivePlayersByTeamId(state, {
    tid: trade.propose_tid
  })
  const acceptingTeamPlayers = getActivePlayersByTeamId(state, {
    tid: trade.accept_tid
  })

  const proposingTeamRecord = get_team_by_id_for_current_year(state, {
    tid: trade.propose_tid
  })
  const proposingTeam = {
    team: proposingTeamRecord,
    before: getTeamTradeSummary(state, {
      lineups: proposingTeamLineups,
      playerMaps: proposingTeamPlayers,
      picks: proposingTeamRecord.picks
    }),
    after: getTeamTradeSummary(state, {
      lineups: proposingTeamProjectedLineups,
      playerMaps: proposingTeamTradedPlayers,
      picks: proposingTeamTradedPicks
    })
  }

  const acceptingTeamRecord = get_team_by_id_for_current_year(state, {
    tid: trade.accept_tid
  })
  const acceptingTeam = {
    team: acceptingTeamRecord,
    before: getTeamTradeSummary(state, {
      lineups: acceptingTeamLineups,
      playerMaps: acceptingTeamPlayers,
      picks: acceptingTeamRecord.picks
    }),
    after: getTeamTradeSummary(state, {
      lineups: acceptingTeamProjectedLineups,
      playerMaps: acceptingTeamTradedPlayers,
      picks: acceptingTeamTradedPicks
    })
  }

  return { proposingTeam, acceptingTeam }
}

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

export function getWaiverById(state, { waiverId }) {
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
      const playerMap = player_maps.get(pid, new Map())
      teamWaivers = teamWaivers.setIn([waiver.uid, 'playerMap'], playerMap)
      if (waiver.release.size) {
        const releases = []
        for (const pid of waiver.release) {
          const playerMap = player_maps.get(pid, new Map())
          releases.push(playerMap)
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
      if (w.type === constants.waivers.FREE_AGENCY) {
        active = active.push(w)
      } else if (w.type === constants.waivers.FREE_AGENCY_PRACTICE) {
        practice = practice.push(w)
      } else if (w.type === constants.waivers.POACH) {
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
