import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import { createSelector } from 'reselect'
import Immutable, { Map, List } from 'immutable'

import {
  constants,
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
  getFreeAgentPeriod,
  getDraftWindow,
  groupBy,
  fixTeam
} from '@common'
import { League } from '@core/leagues'
import { fuzzySearch } from '@core/utils'
import { createMatchup } from '@core/matchups'
import { default_player_filter_options } from '@core/players/reducer'
import { Poach } from '@core/poaches/poach'
import { Roster as RosterRecord } from '@core/rosters/roster'
import { Scoreboard } from '@core/scoreboard'
import { Team } from '@core/teams'
import { createTrade } from '@core/trade'
import PlayerRowOpponent from '@components/player-row-opponent'
import { percentileActions } from '@core/percentiles'
import { store } from '@core/store.js'
import { seasonlogsActions } from '@core/seasonlogs/actions'

dayjs.extend(utc)

export const get_app = (state) => state.get('app')
export const get_router = (state) => state.get('router')
export const get_request_history = (state) =>
  state.getIn(['api', 'request_history'])
export const get_confirmation_info = (state) => state.get('confirmation')
export const get_context_menu_info = (state) => state.get('contextMenu').toJS()
export const get_player_maps = (state) => state.getIn(['players', 'items'])

export const getWaivers = (state) => state.get('waivers')
export const getTransactions = (state) => state.get('transactions')
export const getTrade = (state) => state.get('trade')
export const getTeams = (state) => state.get('teams')
export const getTeamById = (state, { tid }) =>
  state.getIn(['teams', tid], new Team())
export const getScoreboard = (state) => state.get('scoreboard')
export const getProps = (state) => state.getIn(['props', 'items'])
export const getPlays = (state, { week = constants.week }) =>
  state.getIn(['plays', week], new Map())
export const getDraft = (state) => state.get('draft')
export const getStatus = (state) => state.get('status')
export const getStats = (state) => state.get('stats')
export const getSources = (state) => state.get('sources')
export const getRosters = (state) => state.get('rosters')
export const get_source_by_id = (state, { sourceId }) =>
  getSources(state).get(sourceId)
export const getSchedule = (state) => state.get('schedule')
export const get_seasonlogs = (state) => state.get('seasonlogs')
export const getPercentiles = (state) => state.get('percentiles')
export const get_notification_info = (state) => state.get('notification')
export const getMatchups = (state) => state.get('matchups')
export const getGamelogs = (state) => state.get('gamelogs')
export const getPlayerGamelogs = (state) =>
  state.get('gamelogs').get('players').toList()
export const getGamelogByPlayerId = (
  state,
  { pid, week, year = constants.year }
) => state.getIn(['gamelogs', 'players', `${year}/REG/${week}/${pid}`])
export const getPoachesForCurrentLeague = (state) =>
  state.getIn(['poaches', state.getIn(['app', 'leagueId'])], new Map())

export const getLeagues = (state) => state.get('leagues').toList()
export const getCurrentLeague = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  (leagueId, leagues) => {
    return leagues.get(leagueId, new League()).toJS()
  }
)
export const getCurrentLeagueTeamIds = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  (leagueId, leagues) => {
    return leagues.getIn([leagueId, 'teams'], new List())
  }
)
export const getLeagueById = (state, { lid }) =>
  state.get('leagues').get(lid, new League())

export const getAuction = (state) => state.get('auction')
export const isTeamConnected = createSelector(
  (state) => state.getIn(['auction', 'connected']),
  (state, { tid }) => tid,
  (connected, tid) => connected.includes(tid)
)

export const getCurrentTeam = createSelector(
  (state) => state.getIn(['app', 'teamId']),
  (state) => state.get('teams'),
  (teamId, teams) => teams.get(teamId, new Team())
)

export const getCurrentTeamRosterRecord = createSelector(
  getRosters,
  (state) => state.getIn(['app', 'teamId']),
  (rosters, teamId) => {
    return rosters.getIn(
      [teamId, constants.year, constants.fantasy_season_week],
      new RosterRecord()
    )
  }
)

export const getWaiversForCurrentTeam = createSelector(
  (state) => state.getIn(['waivers', 'teams']),
  (state) => state.getIn(['app', 'teamId']),
  (team_waivers, teamId) => team_waivers.get(teamId, new Map())
)

export function getTeamBid(state, { tid }) {
  const auction = getAuction(state)
  const last = auction.transactions.first()
  if (!last) {
    return null
  }

  const pid = last.pid
  const bid = auction.transactions.find((t) => t.pid === pid && t.tid === tid)
  return bid ? bid.value : null
}

export function getAuctionTargetPlayers(state) {
  const playerMaps = state.get('players').get('items')
  const rostered_pids = getRosteredPlayerIdsForCurrentLeague(state)
  const auction = state.get('auction')
  const search = auction.get('search')
  const currentPlayers = getCurrentPlayers(state)

  let filtered = playerMaps
  filtered = filtered.filter((pMap) => !rostered_pids.includes(pMap.get('pid')))
  for (const playerMap of currentPlayers.active) {
    const pid = playerMap.get('pid')
    if (!pid) continue
    filtered = filtered.set(pid, playerMap)
  }

  if (search) {
    filtered = filtered.filter((pMap) => fuzzySearch(search, pMap.get('name')))
  }
  return filtered.sort(
    (a, b) =>
      b.getIn(['vorp', '0'], constants.default_points_added) -
      a.getIn(['vorp', '0'], constants.default_points_added)
  )
}

export const getAuctionPosition = createSelector(
  (state) => state.getIn(['auction', 'transactions']),
  (transactions) => {
    const processed = transactions.filter(
      (t) => t.type === constants.transactions.AUCTION_PROCESSED
    )
    return processed.size
  }
)

export const getRostersForCurrentLeague = createSelector(
  getRosters,
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

export const getActiveRosterPlayerIdsForCurrentLeague = createSelector(
  getRostersForCurrentLeague,
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

export const getAuctionInfoForPosition = createSelector(
  (state, { pos }) =>
    get_player_maps(state).filter((pMap) =>
      pos ? pMap.get('pos') === pos : true
    ),
  getActiveRosterPlayerIdsForCurrentLeague,
  (playerMaps, active_pids) => {
    const rostered = playerMaps.filter((pMap) =>
      active_pids.includes(pMap.get('pid'))
    )

    const totalVorp = playerMaps.reduce(
      (a, b) => a + Math.max(b.getIn(['vorp', '0']) || 0, 0),
      0
    )
    const rosteredVorp = rostered.reduce(
      (a, b) => a + Math.max(b.getIn(['vorp', '0']) || 0, 0),
      0
    )
    const retail = rostered.reduce(
      (sum, playerMap) => sum + (playerMap.getIn(['market_salary', '0']) || 0),
      0
    )
    const actual = rostered.reduce(
      (sum, playerMap) => sum + (playerMap.get('value') || 0),
      0
    )
    return {
      count: {
        total: playerMaps.size,
        rostered: rostered.size
      },
      vorp: {
        total: totalVorp,
        rostered: rosteredVorp
      },
      value: {
        retail,
        actual
      }
    }
  }
)

export const isNominatedPlayerEligible = createSelector(
  (state) => state.getIn(['auction', 'nominated_pid']),
  get_player_maps,
  getCurrentTeamRosterRecord,
  getCurrentLeague,
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

export const isFreeAgentPeriod = createSelector(
  (state) =>
    state.getIn(['leagues', state.getIn(['app', 'leagueId']), 'adate']),
  (adate) => {
    if (!adate) {
      return false
    }

    const faPeriod = getFreeAgentPeriod(adate)
    return constants.season.now.isBetween(faPeriod.start, faPeriod.end)
  }
)

export const getPlayersForOptimalLineup = createSelector(
  (state) => state.get('players'),
  getAuction,
  (players, auction) => {
    return auction.lineupPlayers.map((pid) => players.get('items').get(pid))
  }
)

export const getPicks = createSelector(
  getDraft,
  (state) => state.get('app'),
  (draft, app) => {
    const { picks, draft_start, draft_type, draft_hour_min, draft_hour_max } =
      draft
    const { teamId } = app
    let previousSelected = true
    let previousActive = true
    let previousNotActive = false
    return picks
      .sort((a, b) => a.pick - b.pick)
      .map((p) => {
        if (p.pid || (p.tid !== teamId && previousNotActive)) {
          return p
        }

        if (draft_start && draft_type) {
          p.draftWindow = getDraftWindow({
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

export const getLastPick = createSelector(getDraft, (draft) => {
  return draft.picks.filter((p) => p.pick).max((a, b) => a.pick > b.pick)
})

export const getSelectedDraftPlayer = createSelector(
  (state) => state.getIn(['draft', 'selected']),
  get_player_maps,
  (pid, playerMaps) => {
    if (!pid) {
      return new Map()
    }

    return playerMaps.get(pid, new Map())
  }
)

export function isDrafted(state, { pid, playerMap = new Map() }) {
  pid = pid || playerMap.get('pid')
  if (!pid) {
    return false
  }

  const { drafted } = state.get('draft')
  return drafted.includes(pid)
}

export const getDraftEnd = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  getLastPick,
  (leagueId, leagues, lastPick) => {
    if (!lastPick) {
      return null
    }

    const league = leagues.get(leagueId, new League())
    if (lastPick.selection_timestamp) {
      return dayjs.unix(lastPick.selection_timestamp).endOf('day')
    }

    const draftEnd = getDraftWindow({
      start: league.draft_start,
      pickNum: lastPick.pick + 1,
      type: league.draft_type,
      min: league.draft_hour_min,
      max: league.draft_hour_max
    })

    return draftEnd
  }
)

export const isAfterDraft = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  getDraftEnd,
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
      dayjs().isAfter(draftEnd.endOf('day').add(1, 'day'))
    return {
      afterDraft,
      afterWaivers
    }
  }
)

export const getNextPick = createSelector(
  getDraft,
  (state) => state.get('app'),
  (draft, app) => {
    const { draft_start, draft_type, draft_hour_min, draft_hour_max, picks } =
      draft
    const { teamId } = app
    const team_picks = picks
      .filter((p) => p.tid === teamId)
      .sort((a, b) => a.pick - b.pick)
    const pick = team_picks.filter((p) => p.pick).find((p) => !p.pid)
    if (!pick) return null

    if (draft_start && draft_type) {
      pick.draftWindow = getDraftWindow({
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

const getRank = ({ pick, round }) => {
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

export const getDraftPickValueByPick = createSelector(
  (state) => state.get('draft_pick_value'),
  (state, { pick }) => pick,
  (values, pick) => {
    const rank = getRank(pick)
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
)

export const isBeforeExtensionDeadline = createSelector(
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

export const isBeforeTransitionStart = createSelector(
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

export const isBeforeTransitionEnd = createSelector(
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

export const isRestrictedFreeAgencyPeriod = createSelector(
  isBeforeTransitionStart,
  isBeforeTransitionEnd,
  (isBeforeStart, isBeforeEnd) => {
    return !isBeforeStart && isBeforeEnd
  }
)

export const getLeagueEvents = createSelector(
  getCurrentLeague,
  getLastPick,
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
          picks: lastPick.pick,
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

    const firstDayOfRegularSeason = constants.season.start.add('1', 'week')
    if (now.isBefore(firstDayOfRegularSeason)) {
      events.push({
        detail: 'Regular Season Begins',
        date: firstDayOfRegularSeason
      })
    }

    const firstWaiverDate = constants.season.start
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

    if (league.adate) {
      const faPeriod = getFreeAgentPeriod(league.adate)
      const date = dayjs.unix(league.adate)
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
  (state) => state.getIn(['matchups', 'items']),
  (state) => state.getIn(['app', 'year'], constants.year),
  (matchups, year) => matchups.filter((m) => m.year === year).map((m) => m.week)
)

export const getWeeksForSelectedYearMatchups = createSelector(
  get_regular_season_weeks,
  (state) => state.getIn(['matchups', 'playoffs']).map((m) => m.week),
  (regular_season_weeks, post_season_weeks) => {
    return [...new Set([...regular_season_weeks, ...post_season_weeks])]
  }
)

export function getMatchupById(state, { mid }) {
  const matchups = state.get('matchups')
  const items = matchups.get('items')
  return items.find((m) => m.uid === mid)
}

export function getFilteredMatchups(state) {
  const matchups = state.get('matchups')
  const items = matchups.get('items')
  const teams = matchups.get('teams')
  const weeks = matchups.get('weeks')
  const filtered = items.filter(
    (m) => teams.includes(m.aid) || teams.includes(m.hid)
  )
  return filtered.filter((m) => weeks.includes(m.week))
}

export function getSelectedMatchup(state) {
  const matchups = state.get('matchups')
  const matchupId = matchups.get('selected')
  if (!matchupId) return createMatchup()

  // TODO - fix / derive based on season schedule
  const year = state.getIn(['app', 'year'], constants.year)
  const week = state.getIn(['scoreboard', 'week'])
  if (week <= constants.season.regularSeasonFinalWeek) {
    const items = matchups.get('items')
    return items.find((m) => m.uid === matchupId) || createMatchup()
  } else {
    const items = matchups.get('playoffs')
    return (
      items.find((m) => m.uid === matchupId && m.year === year) ||
      createMatchup()
    )
  }
}

export function getSelectedMatchupTeams(state) {
  const matchup = getSelectedMatchup(state)
  const teams = matchup.tids.map((tid) => getTeamById(state, { tid }))
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

export function getMatchupsForSelectedWeek(state) {
  const matchups = state.getIn(['matchups', 'items'])
  const week = state.getIn(['scoreboard', 'week'])
  return matchups.filter((m) => m.week === week)
}

export function getMatchupByTeamId(state, { tid, year, week }) {
  const matchups = state.getIn(['matchups', 'items'])
  return (
    matchups.find(
      (m) =>
        m.year === year && m.week === week && (m.hid === tid || m.aid === tid)
    ) || createMatchup()
  )
}

export function getPlayers(state) {
  return state.get('players')
}

export const getPlayerFields = createSelector(
  (state) =>
    state.getIn(['players', 'week'], new List([constants.week])).get(0),
  (state) => state,
  (week, state) => PlayerFields({ week, state })
)

export const getSelectedPlayersView = createSelector(
  (state) => state.getIn(['players', 'selected_players_view']),
  (state) => state.getIn(['players', 'views'], new Map()),
  (selected_players_view, views) => views.get(selected_players_view)
)

export const getSelectedViewGroupedFields = createSelector(
  getSelectedPlayersView,
  getPlayerFields,
  (selected_players_view, fields) => {
    const groups = []
    for (const field of selected_players_view.fields) {
      const field_info = fields[field]
      const group = groups[groups.length - 1]
      if (!group || group.category !== field_info.category) {
        groups.push({
          category: field_info.category,
          fields: [field_info]
        })
      } else {
        group.fields.push(field_info)
      }
    }

    return groups
  }
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

export const getTransitionPlayers = createSelector(
  get_player_maps,
  (playerMaps) =>
    playerMaps.filter((pMap) => pMap.get('tag') === constants.tags.TRANSITION)
)

export function getCutlistPlayers(state) {
  const cutlist = state.getIn(['players', 'cutlist'])
  return cutlist.map((pid) => getPlayerById(state, { pid }))
}

export function getCutlistTotalSalary(state) {
  const playerMaps = getCutlistPlayers(state)
  const league = getCurrentLeague(state)
  const isBeforeExtension = isBeforeExtensionDeadline(state)

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
  const pid = getPlayers(state).get('selected')
  return getPlayerById(state, { pid })
}

export function getSelectedPlayerGame(state, { week }) {
  const playerMap = getSelectedPlayer(state)
  return getGameByTeam(state, { nfl_team: playerMap.get('team'), week })
}

export function getSelectedPlayerGames(state) {
  const playerMap = getSelectedPlayer(state)
  return getGamesByTeam(state, { nfl_team: playerMap.get('team') })
}

function descendingComparator(a, b, key_path = [], getValue) {
  const aValue = getValue ? getValue(a) : a.getIn(key_path)
  const bValue = getValue ? getValue(b) : b.getIn(key_path)
  if (typeof bValue === 'undefined' || bValue === null) {
    return -1
  }

  if (typeof aValue === 'undefined' || aValue === null) {
    return 1
  }

  if (bValue < aValue) {
    return -1
  }
  if (bValue > aValue) {
    return 1
  }
  return 0
}

function getComparator(order, key_path, get_value_func) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, key_path, get_value_func)
    : (a, b) => -descendingComparator(a, b, key_path, get_value_func)
}

export function getFilteredPlayers(state) {
  const { qualifiers } = getStats(state)
  const pState = state.get('players')
  let filtered = pState.get('items')
  const search = pState.get('search')

  const watchlist = pState.get('watchlist')
  if (pState.get('watchlistOnly')) {
    filtered = filtered.filter((playerMap) =>
      watchlist.includes(playerMap.get('pid'))
    )
  }

  const positions = pState.get('positions')
  if (positions.size !== constants.positions.length) {
    filtered = filtered.filter((playerMap) =>
      positions.includes(playerMap.get('pos'))
    )
  }

  const nfl_draft_rounds = pState.get('nfl_draft_rounds')
  if (nfl_draft_rounds.size !== constants.nfl_draft_rounds.length) {
    filtered = filtered.filter((playerMap) =>
      nfl_draft_rounds.includes(playerMap.get('round'))
    )
  }

  const experience = pState.get('experience')
  if (experience.size < 3) {
    const veterans = experience.includes(-1)
    filtered = filtered.filter((playerMap) => {
      // exclude defenses
      const draft_year = playerMap.get('start')
      if (!draft_year) {
        return false
      }

      const exp = constants.year - draft_year
      if (veterans && exp > 1) {
        return true
      }

      return experience.includes(exp)
    })
  }

  const nflTeams = pState.get('nflTeams')
  if (nflTeams.size !== constants.nflTeams.length) {
    filtered = filtered.filter((playerMap) =>
      nflTeams.includes(playerMap.get('team'))
    )
  }

  const colleges = pState.get('colleges')
  if (colleges.size !== constants.colleges.length) {
    filtered = filtered.filter((playerMap) =>
      colleges.includes(playerMap.get('col'))
    )
  }

  const collegeDivisions = pState.get('collegeDivisions')
  if (collegeDivisions.size !== constants.collegeDivisions.length) {
    filtered = filtered.filter((playerMap) =>
      collegeDivisions.includes(playerMap.get('dv'))
    )
  }

  const age = pState.get('age')
  const allAges = pState.get('allAges')
  if (age.size !== allAges.size) {
    const now = dayjs()
    filtered = filtered.filter((playerMap) => {
      const playerAge = parseInt(
        now.diff(dayjs(playerMap.get('dob')), 'years'),
        10
      )
      return age.includes(playerAge)
    })
  }

  if (search) {
    filtered = filtered.filter((playerMap) =>
      fuzzySearch(search, playerMap.get('name'))
    )
  }

  const stat = pState.get('orderBy').split('.').pop()
  const qualifier = qualifiers.get(stat)
  if (qualifier) {
    filtered = filtered.filter(
      (playerMap) =>
        playerMap.getIn(['stats', qualifier.type]) >= qualifier.value
    )
  }

  const availability = pState.get('availability')
  if (availability.size !== constants.availability.length) {
    const activeRosterPlayerIds =
      getActiveRosterPlayerIdsForCurrentLeague(state)
    const rosteredPlayerIds = getRosteredPlayerIdsForCurrentLeague(state)
    const practiceSquadPlayerIds =
      getPracticeSquadPlayerIdsForCurrentLeague(state)
    const injuredReservePlayerIds =
      getInjuredReservePlayerIdsForCurrentLeague(state)
    filtered = filtered.filter((playerMap) => {
      if (
        availability.includes('ACTIVE ROSTER') &&
        activeRosterPlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('FREE AGENT') &&
        !rosteredPlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('PRACTICE SQUAD') &&
        practiceSquadPlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('INJURED RESERVE') &&
        injuredReservePlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('RESTRICTED FREE AGENT') &&
        playerMap.get('tag') === constants.tags.TRANSITION
      ) {
        return true
      }

      if (
        availability.includes('POTENTIAL FREE AGENT') &&
        playerMap.get('tid')
      ) {
        const salary = playerMap.get('value')
        const market_salary_adj = playerMap.get('market_salary_adj', 0)
        const tag = playerMap.get('tag')
        const slot = playerMap.get('slot')
        const isRestrictedOrFranchised =
          tag === constants.tags.TRANSITION || tag === constants.tags.FRANCHISE
        if (
          !constants.ps_slots.includes(slot) &&
          !isRestrictedOrFranchised &&
          salary - market_salary_adj * 0.85 > 0
        ) {
          return true
        }
      }

      return false
    })
  }

  const status = pState.get('status')
  if (status.size !== Object.keys(constants.status).length) {
    filtered = filtered.filter((playerMap) =>
      status.includes(playerMap.get('status'))
    )
  }

  const teamIds = pState.get('teamIds')
  if (teamIds.size) {
    filtered = filtered.filter((playerMap) =>
      teamIds.includes(playerMap.get('tid'))
    )
  }

  const player_view_fields = getPlayerFields(state)
  const order_by = pState.get('orderBy')
  const order_by_key_path = player_view_fields[order_by].key_path
  const order_by_value_func = player_view_fields[order_by].getValue
  const sorted = filtered.sort(
    getComparator(pState.get('order'), order_by_key_path, order_by_value_func)
  )
  return sorted.toList()
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
  playerMaps.filter((pMap) => pMap.get('start') === constants.year).toList()
)

export function getPlayerById(state, { pid, playerMap }) {
  if (playerMap) return playerMap
  const playerMaps = get_player_maps(state)
  return playerMaps.get(pid) || new Map()
}

export function getGamesByYearForSelectedPlayer(state) {
  const pid = state.get('players').get('selected')
  const playerMap = getPlayerById(state, { pid })
  const gamelogs = getPlayerGamelogs(state)
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

  const params = {
    status: playerMap.get('status'),
    injury_status: playerMap.get('injury_status')
  }

  if (isReserveEligible(params)) {
    reserve.ir = true
  }

  if (isReserveCovEligible(params)) {
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

  if (playerMap.get('status') === 'Inactive') {
    return false
  }

  const game = getGameByTeam(state, { nfl_team: playerMap.get('team') })
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
      transition: false,
      franchise: false
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
      transitionTag: false,
      transitionBid: false
    },
    reserve: {
      ir: false,
      covid: false
    }
  }

  if (!playerMap.get('pid')) {
    return status
  }

  const league = getCurrentLeague(state)
  const playerTag = playerMap.get('tag')
  const playerSlot = playerMap.get('slot')
  const playerId = playerMap.get('pid')
  status.bid = playerMap.get('bid')
  status.tagged.rookie = playerTag === constants.tags.ROOKIE
  status.tagged.transition = playerTag === constants.tags.TRANSITION
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
    } else if (isFreeAgentPeriod(state)) {
      status.waiver.active = true
      status.waiver.practice = true
    } else {
      const onReleaseWaivers = isPlayerOnReleaseWaivers(state, {
        pid: playerId
      })
      const draft = isAfterDraft(state)
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
    const now = dayjs()

    if (status.tagged.transition && now.isBefore(dayjs.unix(league.tran_end))) {
      status.eligible.transitionBid = true
    }

    if (roster.has(playerId)) {
      status.rostered = true

      // if before extension deadline
      //     was player a rookie last year
      //     otherwise are they a rookie now
      const isBeforeExtension = isBeforeExtensionDeadline(state)
      const isBeforeRestrictedFreeAgency = isBeforeTransitionStart(state)
      const draft_year = playerMap.get('start')
      if (isBeforeExtension && draft_year === constants.year - 1) {
        status.eligible.rookieTag = true
      } else if (draft_year === constants.year) {
        status.eligible.rookieTag = true
      }

      if (constants.week > 0 || isBeforeExtension) {
        status.eligible.franchiseTag = true
      }

      status.eligible.transitionTag = isBeforeRestrictedFreeAgency

      const isActive = Boolean(
        roster.active.find(({ pid }) => pid === playerId)
      )
      if (!isActive) {
        status.eligible.activate = true

        // is regular season and is on practice squad && has no poaching claims
        const leaguePoaches = getPoachesForCurrentLeague(state)
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
        if (reserve.ir && playerSlot !== constants.slots.IR) {
          status.reserve.ir = true
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
      // make sure player is unprotected and it is not a santuary period
      if (
        (playerSlot === constants.slots.PS ||
          playerSlot === constants.slots.PSD) &&
        !isSantuaryPeriod(league)
      ) {
        const rosterInfo = getRosterInfoForPlayerId(state, {
          pid: playerId
        })
        const sanctuaryEnd = dayjs.unix(rosterInfo.timestamp).add('24', 'hours')
        const cutoff = dayjs.unix(rosterInfo.timestamp).add('48', 'hours')

        // check if player has existing poaching claim and is after sanctuary period
        const leaguePoaches = getPoachesForCurrentLeague(state)
        if (!leaguePoaches.has(playerId) && dayjs().isAfter(sanctuaryEnd)) {
          status.eligible.poach = true
        }

        if (
          (rosterInfo.type === constants.transactions.ROSTER_DEACTIVATE ||
            rosterInfo.type === constants.transactions.DRAFT ||
            rosterInfo.type === constants.transactions.PRACTICE_ADD) &&
          dayjs().isBefore(cutoff)
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
    playerMap.get('start') !== constants.year && // not a rookie
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

  const rosterRec = getCurrentTeamRosterRecord(state)
  const rosterPlayers = rosterRec.get('players')
  const rosterPlayer = rosterPlayers.find((p) => p.pid === pid)

  if (!rosterPlayer) {
    return true
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

export const getPlayersForWatchlist = createSelector(getPlayers, (players) => {
  return players
    .get('watchlist')
    .toList()
    .map((pid) => players.get('items').get(pid) || new Map())
})

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

export function getPlaysForPlayer(state, { playerMap, week }) {
  const plays = getPlays(state, { week })
  const formatted = plays.valueSeq().toList()

  const playerTeam = playerMap.get('team')
  if (playerMap.get('pos') === 'DST') {
    return formatted.filter((p) => {
      if (fixTeam(p.h) !== playerTeam && fixTeam(p.v) !== playerTeam) {
        return false
      }

      return (
        (Boolean(p.pos_team) && fixTeam(p.pos_team) !== playerMap.get('pid')) ||
        p.type_nfl === 'PUNT' ||
        p.type_nfl === 'KICK_OFF' ||
        p.type_nfl === 'XP_KICK'
      )
    })
  }

  let filtered = new List()
  for (const play of formatted.valueSeq()) {
    const pos = play.pos_team
    if (
      !pos ||
      (fixTeam(pos) !== playerTeam &&
        play.type_nfl !== 'PUNT' &&
        play.type_nfl !== 'KICK_OFF' &&
        play.type_nfl !== 'XP_KICK')
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
  getPoachesForCurrentLeague,
  (state, { poachId }) => poachId,
  (poaches, poachId) => {
    return poaches.find((p) => p.uid === poachId) || new Poach()
  }
)

export function getPoachReleasePlayers(state, { poachId }) {
  const poach = getPoachById(state, { poachId })
  return poach.release.map((pid) => getPlayerById(state, { pid }))
}

export function getActivePoachesAgainstMyPlayers(state) {
  const poaches = getPoachesForCurrentLeague(state)
  const players = getCurrentPlayers(state)
  const pids = players.practice.map((pMap) => pMap.get('pid'))
  return poaches.filter((p) => pids.includes(p.pid))
}

export function getPoachPlayersForCurrentTeam(state) {
  const poaches = getPoachesForCurrentLeague(state)
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

export function getPoachPlayersForCurrentLeague(state) {
  let poaches = getPoachesForCurrentLeague(state)

  for (const poach of poaches.values()) {
    const pid = poach.pid
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
  const props = getProps(state)

  // filter props

  const items = props.toJS()

  for (const prop of items) {
    const playerMap = getPlayerById(state, { pid: prop.pid })
    const proj = playerMap.getIn(['projection', `${prop.week}`], {})
    switch (prop.prop_type) {
      case constants.player_prop_types.GAME_PASSING_YARDS:
        prop.proj = proj.py
        break

      case constants.player_prop_types.GAME_RECEIVING_YARDS:
        prop.proj = proj.recy
        break

      case constants.player_prop_types.GAME_RUSHING_YARDS:
        prop.proj = proj.ry
        break

      case constants.player_prop_types.GAME_PASSING_COMPLETIONS:
        prop.proj = proj.pc
        break

      case constants.player_prop_types.GAME_PASSING_TOUCHDOWNS:
        prop.proj = proj.tdp
        break

      case constants.player_prop_types.GAME_RECEPTIONS:
        prop.proj = proj.rec
        break

      case constants.player_prop_types.GAME_PASSING_INTERCEPTIONS:
        prop.proj = proj.ints
        break

      case constants.player_prop_types.GAME_RUSHING_ATTEMPTS:
        prop.proj = proj.ra
        break

      case constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS:
        prop.proj = proj.tdr + proj.tdrec
        break

      case constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS:
        prop.proj = proj.ry + proj.recy
        break

      case constants.player_prop_types.GAME_PASSING_ATTEMPTS:
        prop.proj = proj.pa
        break

      case constants.player_prop_types.GAME_RUSHING_TOUCHDOWNS:
        prop.proj = proj.tdr
        break

      case constants.player_prop_types.GAME_RECEIVING_TOUCHDOWNS:
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
  getRosters,
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
  getCurrentLeague,
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
  const rosters = getRostersForCurrentLeague(state)
  const league = getCurrentLeague(state)
  let available_salary_space = 0
  for (const roster of rosters.valueSeq()) {
    const r = new Roster({ roster: roster.toJS(), league })
    available_salary_space += r.availableCap
  }

  return available_salary_space
}

export function getAvailablePlayersForCurrentLeague(state) {
  const rostered_pids = getRosteredPlayerIdsForCurrentLeague(state)
  const playerMaps = get_player_maps(state)
  return playerMaps.filter((pMap) => !rostered_pids.includes(pMap.get('pid')))
}

export function getActivePlayersByRosterForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const league = getCurrentLeague(state)
  let result = new Map()
  for (const ros of rosters.valueSeq()) {
    if (!ros) continue
    const r = new Roster({ roster: ros.toJS(), league })
    const active = r.active.map(({ pid }) => getPlayerById(state, { pid }))
    result = result.set(ros.get('tid'), new List(active))
  }

  return result
}

export function getRosteredPlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const pids = []
  for (const roster of rosters.values()) {
    roster.players.forEach(({ pid }) => pids.push(pid))
  }
  return new List(pids)
}

export function getRosterInfoForPlayerId(
  state,
  { pid, playerMap = new Map() }
) {
  pid = pid || playerMap.get('pid')
  if (!pid) {
    return {}
  }

  const rosters = getRostersForCurrentLeague(state)
  for (const roster of rosters.values()) {
    for (const rosterPlayer of roster.players) {
      if (rosterPlayer.pid === pid) {
        return { tid: roster.tid, ...rosterPlayer }
      }
    }
  }
  return {}
}

export const getPracticeSquadPlayerIdsForCurrentLeague = createSelector(
  getRostersForCurrentLeague,
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

export const getInjuredReservePlayerIdsForCurrentLeague = createSelector(
  getRostersForCurrentLeague,
  (rosters) => {
    const pids = []
    for (const roster of rosters.values()) {
      roster.players.forEach(({ slot, pid }) => {
        if (slot === constants.slots.IR) {
          pids.push(pid)
        }
      })
    }
    return new List(pids)
  }
)

export function isPlayerFreeAgent(state, { playerMap }) {
  const rostered = getRosteredPlayerIdsForCurrentLeague(state)
  return !rostered.includes(playerMap.get('pid'))
}

export function isPlayerOnPracticeSquad(state, { playerMap }) {
  const practiceSquads = getPracticeSquadPlayerIdsForCurrentLeague(state)
  return practiceSquads.includes(playerMap.get('pid'))
}

export const getCurrentTeamRoster = createSelector(
  getCurrentTeamRosterRecord,
  getCurrentLeague,
  (roster, league) => {
    return new Roster({ roster: roster.toJS(), league })
  }
)

export function getRosterPositionalValueByTeamId(state, { tid }) {
  const rosterRecords = getRostersForCurrentLeague(state)
  const league = getCurrentLeague(state)
  const teams = getTeamsForCurrentLeague(state)
  const team = getTeamById(state, { tid })
  const divTeamIds = teams.filter((t) => t.div === team.div).map((t) => t.uid)

  const values = {
    league_avg: {},
    league: {},
    div_avg: {},
    div: {},
    team: {},
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
    const league = []
    const div = []
    for (const roster of rosters) {
      const rosterPlayers = roster.active.filter((p) => p.pos === position)
      const playerMaps = rosterPlayers.map(({ pid }) =>
        getPlayerById(state, { pid })
      )
      const vorps = playerMaps.map((pMap) =>
        Math.max(pMap.getIn(['vorp', seasonType], 0), 0)
      )
      const sum = vorps.reduce((s, i) => s + i, 0)
      league.push(sum)
      values.rosters[roster.tid][position] = sum
      if (divTeamIds.includes(roster.tid)) div.push(sum)
      if (roster.tid === team.uid) values.team[position] = sum
      values.total[roster.tid] = (values.total[roster.tid] ?? 0) + sum
    }
    values.league_avg[position] =
      league.reduce((s, i) => s + i, 0) / league.length
    values.league[position] = league
    values.div_avg[position] = div.reduce((s, i) => s + i, 0) / div.length
    values.div[position] = div
  }

  const league_draft_value = []
  const div_draft_value = []
  for (const [tid, team_i] of teams) {
    const draft_value = team_i.picks.reduce(
      (sum, pick) => sum + getDraftPickValueByPick(state, { pick }),
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

  const team_values = Object.entries(values.total).map(([key, value]) => ({
    tid: key,
    value
  }))
  values.sorted_tids = team_values.sort((a, b) => b.value - a.value)
  values.team_total = values.total[team.uid]

  return values
}

export const getGroupedPlayersByTeamId = createSelector(
  getRosters,
  getCurrentLeague,
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
    const cov = new List(
      r.cov.map(({ pid }) => player_items.get(pid, new Map()))
    )

    const players = active.concat(practice).concat(ir).concat(cov)

    return {
      active,
      practice,
      practice_signed,
      practice_drafted,
      players,
      ir,
      cov,
      roster: r
    }
  }
)

export function getCurrentPlayers(state) {
  const { teamId } = get_app(state)
  return getGroupedPlayersByTeamId(state, { tid: teamId })
}

export function getGameByPlayerId(state, { pid, week }) {
  const playerMap = getPlayerById(state, { pid })
  return getGameByTeam(state, { nfl_team: playerMap.get('team'), week })
}

export function getByeByTeam(state, { nfl_team }) {
  return state.getIn(['schedule', 'teams', nfl_team, 'bye'])
}

export function getGameByTeam(
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
  const matchup = getSelectedMatchup(state)
  return matchup.tids.map((tid) => getScoreboardByTeamId(state, { tid }))
}

export function getPointsByTeamId(state, { tid, week }) {
  let points = 0
  const starterMaps = getStartersByTeamId(state, { tid, week })
  starterMaps.forEach((playerMap) => {
    const gamelog = getGamelogForPlayer(state, { playerMap, week })
    if (gamelog) points += gamelog.total
  })
  return points
}

export function getScoreboardByTeamId(state, { tid }) {
  const year = state.getIn(['app', 'year'])
  const week = state.getIn(['scoreboard', 'week'])
  const matchup = getMatchupByTeamId(state, { tid, year, week })

  let minutes = 0

  // TODO - set flag for processed matchup
  if (matchup.ap) {
    return new Scoreboard({
      tid,
      points: matchup.aid === tid ? matchup.ap : matchup.hp,
      projected: 0,
      minutes
    })
  }

  const isChampRound = week === constants.season.finalWeek
  let points = isChampRound
    ? getPointsByTeamId(state, { tid, week: constants.season.finalWeek - 1 })
    : 0
  const previousWeek = points

  // TODO - instead use matchup projected value
  const isFuture = year === constants.year && week > constants.week
  const starterMaps = getStartersByTeamId(state, {
    tid,
    week: isFuture ? constants.week : week
  })
  const projected = starterMaps.reduce((sum, playerMap) => {
    const gamelog = getGamelogForPlayer(state, { playerMap, week })
    if (gamelog) {
      points += gamelog.total
      const gameStatus = getGameStatusByPlayerId(state, {
        pid: playerMap.get('pid'),
        week
      })
      if (gameStatus && gameStatus.lastPlay) {
        const lp = gameStatus.lastPlay
        const quarterMinutes =
          lp.desc === 'END GAME'
            ? 0
            : parseInt((lp.game_clock_start || '').split(':').pop(), 10) // TODO - double check
        const quartersRemaining = lp.qtr === 5 ? 0 : 4 - lp.qtr
        minutes += quartersRemaining * 15 + quarterMinutes
      }
    } else {
      minutes += 60
    }
    const add = gamelog
      ? gamelog.total
      : playerMap.getIn(['points', `${week}`, 'total'], 0)
    return add + sum
  }, 0)

  return new Scoreboard({
    tid,
    points,
    projected: projected + previousWeek,
    minutes
  })
}

export const getScoreboardUpdated = createSelector(getPlays, (plays) => {
  const play = plays.maxBy((x) => x.updated)
  return play ? play.updated : 0
})

export function getStartersByMatchupId(state, { mid }) {
  const matchup = getSelectedMatchup(state)
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
    const game = getGameByTeam(state, {
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
  return getGamelogForPlayer(state, { playerMap, week, year })
}

export function getPlaysByMatchupId(state, { mid }) {
  const matchup = getSelectedMatchup(state)
  if (!matchup) return new List()

  const playerMaps = matchup.tids.reduce((arr, tid) => {
    const starters = getStartersByTeamId(state, { tid, week: matchup.week })
    return arr.concat(starters)
  }, [])
  const gsisids = playerMaps.map((pMap) => pMap.get('gsisid')).filter(Boolean)
  if (!gsisids.length) return new List()

  const gsispids = playerMaps.map((pMap) => pMap.get('gsispid')).filter(Boolean)

  const plays = getPlays(state, { week: matchup.week })
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

  const league = getCurrentLeague(state)
  let result = new List()
  for (const play of filteredPlays) {
    const game = getGameByTeam(state, {
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
    const date = dayjs.tz(
      `${game.date} ${game.time_est}`,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )
    const time = dayjs.utc(
      `${date.utc().format('YYYY-MM-DD')} ${play.timestamp}`,
      'YYYY-MM-DD HH:mm:ss'
    )
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

  const plays = getPlays(state, { week })
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
  getPlayerGamelogs,
  (playerMap, gamelogs) => {
    const pid = playerMap.get('pid')
    const games = gamelogs
      .filter((p) => p.pid === pid)
      .sort((a, b) => b.timestamp - a.timestamp)
    return games.toJS()
  }
)

export function getGamelogForPlayer(
  state,
  { playerMap, week, year = constants.year }
) {
  if (!playerMap || !playerMap.get('pid')) return null

  const league = getCurrentLeague(state)

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
  const gamelog = getGamelogByPlayerId(state, { pid, week, year })
  if (gamelog) return process(gamelog)

  // TODO should handle year
  const plays = getPlaysForPlayer(state, { playerMap, week }).toJS()
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

export function getDraftPickById(state, { pickId }) {
  const teams = state.get('teams')
  for (const team of teams.valueSeq()) {
    const picks = team.get('picks')
    const pick = picks.find((p) => p.uid === pickId)
    if (pick) {
      return pick
    }
  }

  return {}
}

// TODO update to use info in team_stats
export function getOverallStandings(state) {
  const { year } = get_app(state)
  const teams = getTeamsForCurrentLeague(state)
  const divisionTeams = teams.groupBy((x) => x.getIn(['stats', year, 'div'], 0))
  let divisionLeaders = new List()
  for (const teams of divisionTeams.values()) {
    const sorted = teams.sort(
      (a, b) =>
        b.getIn(['stats', year, 'wins'], 0) -
          a.getIn(['stats', year, 'wins'], 0) ||
        b.getIn(['stats', year, 'ties'], 0) -
          a.getIn(['stats', year, 'ties'], 0) ||
        b.getIn(['stats', year, 'pf'], 0) - a.getIn(['stats', year, 'pf'], 0)
    )
    divisionLeaders = divisionLeaders.push(sorted.first())
  }

  const sortedDivisionLeaders = divisionLeaders.sort(
    (a, b) =>
      b.getIn(['stats', year, 'apWins'], 0) -
        a.getIn(['stats', year, 'apWins'], 0) ||
      b.getIn(['stats', year, 'apTies'], 0) -
        a.getIn(['stats', year, 'apTies'], 0) ||
      b.getIn(['stats', year, 'pf'], 0) - a.getIn(['stats', year, 'pf'], 0)
  )

  const playoffTeamTids = divisionLeaders.map((p) => p.uid)
  const wildcardTeams = teams
    .filter((t) => !playoffTeamTids.includes(t.uid))
    .toList()
  const sortedWildcardTeams = wildcardTeams.sort(
    (a, b) =>
      b.getIn(['stats', year, 'pf'], 0) - a.getIn(['stats', year, 'pf'], 0)
  )

  return {
    teams,
    divisionTeams,
    divisionLeaders: sortedDivisionLeaders,
    wildcardTeams: sortedWildcardTeams
  }
}

export const getTeamsForCurrentLeague = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  getTeams,
  (leagueId, teams) => teams.filter((t) => t.lid === leagueId)
)

export const getTeamEvents = createSelector(
  getNextPick,
  getActivePoachesAgainstMyPlayers,
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

export function getTradeIsValid(state) {
  const { teamId } = get_app(state)
  const trade = getCurrentTrade(state)
  const isProposer = trade.propose_tid === teamId

  const rosterRecord = isProposer
    ? getProposingTeamRoster(state)
    : getAcceptingTeamRoster(state)
  const add_pids = isProposer
    ? trade.acceptingTeamPlayers
    : trade.proposingTeamPlayers
  const release_pids = isProposer
    ? trade.proposingTeamReleasePlayers
    : trade.acceptingTeamReleasePlayers
  const remove_pids = isProposer
    ? trade.proposingTeamPlayers
    : trade.acceptingTeamPlayers

  const league = getCurrentLeague(state)
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

export function getTradeSelectedTeamId(state) {
  let { teamId } = getTrade(state)
  if (!teamId) {
    const myTeamId = get_app(state).teamId
    teamId = getCurrentLeagueTeamIds(state).find(
      (teamId) => teamId !== myTeamId
    )
  }

  return teamId
}

export function getCurrentTrade(state) {
  const { teamId } = get_app(state)
  const {
    selectedTradeId,
    items,
    proposingTeamPlayers,
    acceptingTeamPlayers,
    acceptingTeamPicks,
    proposingTeamPicks,
    releasePlayers
  } = getTrade(state)

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
    const accept_tid = getTradeSelectedTeamId(state)
    return createTrade({
      accept_tid,
      propose_tid: teamId,
      proposingTeamReleasePlayers: releasePlayers,
      acceptingTeamPlayers,
      proposingTeamPlayers,
      acceptingTeamPicks: acceptingTeamPicks.map((pickId) =>
        getDraftPickById(state, { pickId })
      ),
      proposingTeamPicks: proposingTeamPicks.map((pickId) =>
        getDraftPickById(state, { pickId })
      )
    })
  }
}

export function getCurrentTradePlayers(state) {
  const trade = getCurrentTrade(state)

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

export function getProposingTeamTradedPicks(state) {
  const trade = getCurrentTrade(state)
  const team = getTeamById(state, { tid: trade.propose_tid })

  return calculateTradedPicks({
    picks: team.picks,
    add: trade.acceptingTeamPicks,
    remove: trade.proposingTeamPicks
  })
}

export function getAcceptingTeamTradedPicks(state) {
  const trade = getCurrentTrade(state)
  const team = getTeamById(state, { tid: trade.accept_tid })

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

export function getProposingTeamTradedRosterPlayers(state) {
  const trade = getCurrentTrade(state)
  const roster = getRosterByTeamId(state, { tid: trade.propose_tid })

  return calculateTradedRosterPlayers({
    state,
    roster,
    add: trade.acceptingTeamPlayers,
    release: trade.proposingTeamReleasePlayers,
    remove: trade.proposingTeamPlayers
  })
}

export function getAcceptingTeamTradedRosterPlayers(state) {
  const trade = getCurrentTrade(state)
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
  const vorpType = constants.isOffseason ? '0' : 'ros'
  const draft_value = picks.reduce(
    (sum, pick) => sum + getDraftPickValueByPick(state, { pick }),
    0
  )
  const player_value = playerMaps.reduce(
    (sum, pMap) => sum + Math.max(pMap.getIn(['vorp', vorpType]), 0),
    0
  )
  const values = {
    points: lineups.reduce((sum, l) => sum + l.baseline_total, 0),
    value: player_value + draft_value,
    player_value,
    draft_value,
    value_adj: playerMaps.reduce(
      (sum, pMap) => sum + Math.max(pMap.getIn(['vorp_adj', vorpType]), 0),
      0
    ),
    salary: playerMaps.reduce((sum, pMap) => sum + pMap.get('value', 0), 0)
  }

  return values
}

export function getCurrentTradeAnalysis(state) {
  const trade = getCurrentTrade(state)

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

  const proposingTeamTradedPicks = getProposingTeamTradedPicks(state)
  const acceptingTeamTradedPicks = getAcceptingTeamTradedPicks(state)

  const proposingTeamTradedPlayers = getProposingTeamTradedRosterPlayers(state)
  const acceptingTeamTradedPlayers = getAcceptingTeamTradedRosterPlayers(state)

  const proposingTeamPlayers = getActivePlayersByTeamId(state, {
    tid: trade.propose_tid
  })
  const acceptingTeamPlayers = getActivePlayersByTeamId(state, {
    tid: trade.accept_tid
  })

  const proposingTeamRecord = getTeamById(state, { tid: trade.propose_tid })
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

  const acceptingTeamRecord = getTeamById(state, { tid: trade.accept_tid })
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

export function getProposingTeamPlayers(state) {
  const trade = getCurrentTrade(state)
  return getPlayersByTeamId(state, { tid: trade.propose_tid })
}

export function getAcceptingTeamPlayers(state) {
  const trade = getCurrentTrade(state)
  return getPlayersByTeamId(state, { tid: trade.accept_tid })
}

export function getProposingTeam(state) {
  const trade = getCurrentTrade(state)
  return getTeamById(state, { tid: trade.propose_tid })
}

export function getAcceptingTeam(state) {
  const trade = getCurrentTrade(state)
  return getTeamById(state, { tid: trade.accept_tid })
}

export function getProposingTeamRoster(state) {
  const trade = getCurrentTrade(state)
  return getRosterRecordByTeamId(state, { tid: trade.propose_tid })
}

export function getAcceptingTeamRoster(state) {
  const trade = getCurrentTrade(state)
  return getRosterRecordByTeamId(state, { tid: trade.accept_tid })
}

export function getReleaseTransactions(state) {
  return getTransactions(state).get('release')
}

export function getReserveTransactionsByPlayerId(state, { pid }) {
  return getTransactions(state)
    .get('reserve')
    .filter((t) => t.pid === pid)
    .sort((a, b) => b.timestamp - a.timestamp)
}

export function getWaiverById(state, { waiverId }) {
  const waivers = getWaiversForCurrentTeam(state)
  return waivers.get(waiverId)
}

export function getWaiverReportItems(state) {
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

export const getWaiverPlayersForCurrentTeam = createSelector(
  getWaiversForCurrentTeam,
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

// category - required
// column_header - required
// csv_header - required

// load - optional

// component - optional
// header_className - optional

// getValue - optional
// player_value_path - optional

// getPercentileKey - optional
// percentile_key - optional
// percentile_field - optional

// fixed - optional
function PlayerFields({ week, state }) {
  const opponent_field = (stat_field) => {
    return {
      getPercentileKey: (playerMap) => {
        const pos = playerMap.get('pos')
        return `${pos}_AGAINST_ADJ`
      },
      fixed: 1,
      show_positivity: true,
      load: () => {
        const positions = state.getIn(['players', 'positions'])
        positions.forEach((pos) => {
          const percentile_key = `${pos}_AGAINST_ADJ`
          store.dispatch(percentileActions.loadPercentiles(percentile_key))
        })
        store.dispatch(seasonlogsActions.load_nfl_team_seasonlogs())
      },
      getValue: (playerMap) => {
        const nfl_team = playerMap.get('team')
        const pos = playerMap.get('pos')
        const game = getGameByTeam(state, { nfl_team, week })
        const seasonlogs = get_seasonlogs(state)
        if (!game) {
          return null
        }

        const isHome = game.h === nfl_team
        const opp = isHome ? game.v : game.h
        const value = seasonlogs.getIn(
          ['nfl_teams', opp, `${pos}_AGAINST_ADJ`, stat_field],
          0
        )

        return value
      }
    }
  }

  const fields = {
    opponent: {
      category: 'matchup',
      column_header: 'Opponent',
      csv_header: 'Opponent',
      component: PlayerRowOpponent,
      header_className: 'player__row-opponent',
      getValue: (playerMap) => {
        const nfl_team = playerMap.get('team')
        const game = getGameByTeam(state, { nfl_team, week })
        if (!game) {
          return null
        }

        const isHome = game.h === nfl_team
        const opp = isHome ? game.v : game.h
        return opp
      }
    },
    opponent_strength: {
      category: 'matchup',
      column_header: 'Strength',
      csv_header: 'Opponent Strength',
      getPercentileKey: (playerMap) => {
        const pos = playerMap.get('pos')
        return `${pos}_AGAINST_ADJ`
      },
      percentile_field: 'pts',
      fixed: 1,
      show_positivity: true,
      load: () => {
        const positions = state.getIn(['players', 'positions'])
        positions.forEach((pos) => {
          const percentile_key = `${pos}_AGAINST_ADJ`
          store.dispatch(percentileActions.loadPercentiles(percentile_key))
        })
        store.dispatch(seasonlogsActions.load_nfl_team_seasonlogs())
      },
      getValue: (playerMap) => {
        const nfl_team = playerMap.get('team')
        const pos = playerMap.get('pos')
        const game = getGameByTeam(state, { nfl_team, week })
        const seasonlogs = get_seasonlogs(state)
        if (!game) {
          return null
        }

        const isHome = game.h === nfl_team
        const opp = isHome ? game.v : game.h
        const pts = seasonlogs.getIn(
          ['nfl_teams', opp, `${pos}_AGAINST_ADJ`, 'pts'],
          0
        )

        return pts
      }
    },
    value: {
      category: 'management',
      column_header: 'Salary',
      csv_header: 'Projected Salary',
      player_value_path: 'value'
    },
    'vorp_adj.week': {
      category: 'management',
      column_header: 'Value',
      csv_header: 'Projected Value',
      player_value_path: `vorp_adj.${week}`
    },
    'market_salary.week': {
      category: 'management',
      column_header: 'Market',
      csv_header: 'Projected Market Salary',
      player_value_path: `market_salary.${week}`
    },
    market_salary_adj: {
      category: 'management',
      column_header: 'Adjusted',
      csv_header: 'Projected Adjusted Market Salary',
      player_value_path: 'market_salary_adj'
    },

    'vorp.ros': {
      category: 'fantasy',
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Rest-Of-Season)',
      player_value_path: 'vorp.ros',
      fixed: 1
    },
    'vorp.0': {
      category: 'fantasy',
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Season)',
      player_value_path: 'vorp.0'
    },
    'vorp.week': {
      category: `Week ${week}`,
      column_header: 'Pts+',
      csv_header: 'Projected Points Added (Week)',
      player_value_path: `vorp.${week}`,
      fixed: 1
    },

    'points.week.total': {
      category: `Week ${week}`,
      column_header: 'Proj',
      csv_header: 'Projected Points (Week)',
      player_value_path: `points.${week}.total`,
      fixed: 1
    },
    'points.ros.total': {
      category: 'fantasy',
      column_header: 'Proj',
      csv_header: 'Projected Points (Rest-Of-Season)',
      player_value_path: 'points.ros.total',
      fixed: 1
    },
    'points.0.total': {
      category: 'fantasy',
      column_header: 'Proj',
      csv_header: 'Projected Points (Season)',
      player_value_path: 'points.0.total',
      fixed: 1
    },

    'projection.week.py': {
      category: 'passing',
      column_header: 'YDS',
      csv_header: 'Projected Passing Yards (Week)',
      player_value_path: `projection.${week}.py`
    },
    'projection.week.tdp': {
      category: 'passing',
      column_header: 'TD',
      csv_header: 'Projected Passing Touchdowns (Week)',
      player_value_path: `projection.${week}.tdp`,
      fixed: 1
    },
    'projection.week.ints': {
      category: 'passing',
      column_header: 'INT',
      csv_header: 'Projected Interceptions (Week)',
      player_value_path: `projection.${week}.ints`,
      fixed: 1
    },

    'projection.0.py': {
      category: 'passing',
      column_header: 'YDS',
      csv_header: 'Projected Passing Yards (Season)',
      player_value_path: 'projection.0.py'
    },
    'projection.0.tdp': {
      category: 'passing',
      column_header: 'TD',
      csv_header: 'Projected Passing Touchdowns (Season)',
      player_value_path: 'projection.0.tdp',
      fixed: 1
    },
    'projection.0.ints': {
      category: 'passing',
      column_header: 'INT',
      csv_header: 'Projected Interceptions (Season)',
      player_value_path: 'projection.0.ints',
      fixed: 1
    },

    'projection.ros.py': {
      column_header: 'YDS',
      csv_header: 'Projected Passing Yards (Rest-Of-Season)',
      player_value_path: 'projection.ros.py',
      category: 'passing'
    },
    'projection.ros.tdp': {
      category: 'passing',
      column_header: 'TD',
      csv_header: 'Projected Passing Touchdowns (Rest-Of-Season)',
      player_value_path: 'projection.ros.tdp',
      fixed: 1
    },
    'projection.ros.ints': {
      category: 'passing',
      column_header: 'INT',
      csv_header: 'Projected Interceptions (Rest-Of-Season)',
      player_value_path: 'projection.ros.ints',
      fixed: 1
    },

    'projection.week.ra': {
      category: 'rushing',
      column_header: 'ATT',
      csv_header: 'Projected Rushing Attempts (Week)',
      player_value_path: `projection.${week}.ra`
    },
    'projection.week.ry': {
      category: 'rushing',
      column_header: 'YDS',
      csv_header: 'Projected Rushing Yards (Week)',
      player_value_path: `projection.${week}.ry`
    },
    'projection.week.tdr': {
      category: 'rushing',
      column_header: 'TD',
      csv_header: 'Projected Rushing Touchdowns (Week)',
      player_value_path: `projection.${week}.tdr`,
      fixed: 1
    },
    'projection.week.fuml': {
      category: 'rushing',
      column_header: 'FUM',
      csv_header: 'Projected Fumbles (Week)',
      player_value_path: `projection.${week}.fuml`,
      fixed: 1
    },

    'projection.0.ra': {
      category: 'rushing',
      column_header: 'ATT',
      csv_header: 'Projected Rushing Attempts (Season)',
      player_value_path: 'projection.0.ra'
    },
    'projection.0.ry': {
      category: 'rushing',
      column_header: 'YDS',
      csv_header: 'Projected Rushing Yards (Season)',
      player_value_path: 'projection.0.ry'
    },
    'projection.0.tdr': {
      category: 'rushing',
      column_header: 'TD',
      csv_header: 'Projected Rushing Touchdowns (Season)',
      player_value_path: 'projection.0.tdr',
      fixed: 1
    },
    'projection.0.fuml': {
      category: 'rushing',
      column_header: 'FUM',
      csv_header: 'Projected Fumbles (Season)',
      player_value_path: 'projection.0.fuml',
      fixed: 1
    },

    'projection.ros.ra': {
      category: 'rushing',
      column_header: 'ATT',
      csv_header: 'Projected Rushing Attempts (Rest-Of-Season)',
      player_value_path: 'projection.ros.ra'
    },
    'projection.ros.ry': {
      category: 'rushing',
      column_header: 'YDS',
      csv_header: 'Projected Rushing Yards (Rest-Of-Season)',
      player_value_path: 'projection.ros.ry'
    },
    'projection.ros.tdr': {
      category: 'rushing',
      column_header: 'TD',
      csv_header: 'Projected Rushing Touchdowns (Rest-Of-Season)',
      player_value_path: 'projection.ros.tdr',
      fixed: 1
    },
    'projection.ros.fuml': {
      category: 'rushing',
      column_header: 'FUM',
      csv_header: 'Projected Fumbles (Rest-Of-Season)',
      player_value_path: 'projection.ros.fuml',
      fixed: 1
    },

    'projection.week.trg': {
      category: 'receiving',
      column_header: 'TAR',
      csv_header: 'Projected Targets (Week)',
      player_value_path: `projection.${week}.trg`,
      fixed: 1
    },
    'projection.week.rec': {
      category: 'receiving',
      column_header: 'REC',
      csv_header: 'Projected Receptions (Week)',
      player_value_path: `projection.${week}.rec`,
      fixed: 1
    },
    'projection.week.recy': {
      category: 'receiving',
      column_header: 'YDS',
      csv_header: 'Projected Receiving Yards (Week)',
      player_value_path: `projection.${week}.recy`
    },
    'projection.week.tdrec': {
      category: 'receiving',
      column_header: 'TD',
      csv_header: 'Projected Receiving Touchdowns (Week)',
      player_value_path: `projection.${week}.tdrec`,
      fixed: 1
    },

    'projection.0.trg': {
      category: 'receiving',
      column_header: 'TAR',
      csv_header: 'Projected Targets (Season)',
      player_value_path: 'projection.0.trg',
      fixed: 1
    },
    'projection.0.rec': {
      category: 'receiving',
      column_header: 'REC',
      csv_header: 'Projected Receptions (Season)',
      player_value_path: 'projection.0.rec',
      fixed: 1
    },
    'projection.0.recy': {
      category: 'receiving',
      column_header: 'YDS',
      csv_header: 'Projected Receiving Yards (Season)',
      player_value_path: 'projection.0.recy'
    },
    'projection.0.tdrec': {
      category: 'receiving',
      column_header: 'TD',
      csv_header: 'Projected Receiving Touchdowns (Season)',
      player_value_path: 'projection.0.tdrec',
      fixed: 1
    },

    'projection.ros.trg': {
      category: 'receiving',
      column_header: 'TAR',
      csv_header: 'Projected Targets (Rest-Of-Season)',
      player_value_path: 'projection.ros.trg',
      fixed: 1
    },
    'projection.ros.rec': {
      category: 'receiving',
      column_header: 'REC',
      csv_header: 'Projected Receptions (Rest-Of-Season)',
      player_value_path: 'projection.ros.rec',
      fixed: 1
    },
    'projection.ros.recy': {
      category: 'receiving',
      column_header: 'YDS',
      csv_header: 'Projected Receiving Yards (Rest-Of-Season)',
      player_value_path: 'projection.ros.recy'
    },
    'projection.ros.tdrec': {
      category: 'receiving',
      column_header: 'TD',
      csv_header: 'Projected Receiving Touchdowns (Rest-Of-Season)',
      player_value_path: 'projection.ros.tdrec',
      fixed: 1
    },

    'stats.pts': {
      category: 'fantasy',
      column_header: 'PTS',
      csv_header: 'Fantasy Points',
      player_value_path: 'stats.pts',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pts'
    },

    'stats.py': {
      category: 'passing',
      column_header: 'YDS',
      csv_header: 'Passing Yards',
      player_value_path: 'stats.py',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'py'
    },
    'stats.tdp': {
      category: 'passing',
      column_header: 'TD',
      csv_header: 'Passing Touchdowns',
      player_value_path: 'stats.tdp',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tdp'
    },
    'stats.ints': {
      category: 'passing',
      column_header: 'INT',
      csv_header: 'Interceptions',
      player_value_path: 'stats.ints',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ints'
    },
    'stats.drppy': {
      category: 'passing',
      column_header: 'DRP YDS',
      csv_header: 'Dropped Passing Yards',
      player_value_path: 'stats.drppy',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'drppy'
    },
    'stats.pc_pct': {
      category: 'efficiency',
      column_header: 'COMP%',
      csv_header: 'Passing Completion Percentage',
      player_value_path: 'stats.pc_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pc_pct'
    },
    'stats.tdp_pct': {
      category: 'efficiency',
      column_header: 'TD%',
      csv_header: 'Passing Touchdown Percentage',
      player_value_path: 'stats.tdp_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tdp_pct'
    },
    'stats.ints_pct': {
      category: 'efficiency',
      column_header: 'INT%',
      csv_header: 'Passing Interception Percentage',
      player_value_path: 'stats.ints_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ints_pct'
    },
    'stats.intw_pct': {
      category: 'efficiency',
      column_header: 'BAD%',
      csv_header: 'Passing Interception Worthy Percentage',
      player_value_path: 'stats.intw_pct',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'intw_pct'
    },
    'stats.pyac': {
      category: 'passing',
      column_header: 'YAC',
      csv_header: 'Passing Yards After Catch',
      player_value_path: 'stats.pyac',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pyac'
    },
    'stats.pyac_pc': {
      category: 'efficiency',
      column_header: 'YAC/C',
      csv_header: 'Passing Yards After Catch Per Completion',
      player_value_path: 'stats.pyac_pc',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pyac_pc'
    },
    'stats._ypa': {
      category: 'efficiency',
      column_header: 'Y/A',
      csv_header: 'Passing Yards Per Pass Attempt',
      player_value_path: 'stats._ypa',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_ypa'
    },
    'stats.pdot_pa': {
      category: 'efficiency',
      column_header: 'DOT',
      csv_header: 'Passing Depth of Target per Pass Attempt',
      player_value_path: 'stats.pdot_pa',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pdot_pa'
    },
    'stats.pdot': {
      category: 'air yards',
      column_header: 'AY',
      csv_header: 'Passing Air Yards',
      player_value_path: 'stats.pdot',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pdot'
    },
    'stats.pcay_pc': {
      category: 'air yards',
      column_header: 'CAY/C',
      csv_header: 'Completed Air Yards Per Completion',
      player_value_path: 'stats.pcay_pc',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'pcay_pc'
    },
    'stats._pacr': {
      category: 'air yards',
      column_header: 'PACR',
      csv_header: 'Passing Air Conversion Ratio (PACR)',
      player_value_path: 'stats._pacr',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_pacr'
    },
    'stats.sk': {
      category: 'pressure',
      column_header: 'SK',
      csv_header: 'Sacks',
      player_value_path: 'stats.sk',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'sk'
    },
    'stats.sky': {
      category: 'pressure',
      column_header: 'SKY',
      csv_header: 'Sack Yards',
      player_value_path: 'stats.sky',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'sky'
    },
    'stats.sk_pct': {
      category: 'pressure',
      column_header: 'SK%',
      csv_header: 'Sack Percentage',
      player_value_path: 'stats.sk_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'sk_pct'
    },
    'stats.qbhi_pct': {
      category: 'pressure',
      column_header: 'HIT%',
      csv_header: 'QB Hit Percentage',
      player_value_path: 'stats.qbhi_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qbhi_pct'
    },
    'stats.qbp_pct': {
      category: 'pressure',
      column_header: 'PRSS%',
      csv_header: 'QB Pressure Percentage',
      player_value_path: 'stats.qbp_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qbp_pct'
    },
    'stats.qbhu_pct': {
      category: 'pressure',
      column_header: 'HRRY%',
      csv_header: 'QB Hurry Percentage',
      player_value_path: 'stats.qbhu_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'qbhu_pct'
    },
    'stats._nygpa': {
      category: 'pressure',
      column_header: 'NY/A',
      csv_header: 'Net Yards Per Pass Attempt',
      player_value_path: 'stats._nygpa',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_nygpa'
    },

    'stats.ry': {
      category: 'rushing',
      column_header: 'YDS',
      csv_header: 'Rushing Yards',
      player_value_path: 'stats.ry',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ry'
    },
    'stats.tdr': {
      category: 'rushing',
      column_header: 'TD',
      csv_header: 'Rushing Touchdowns',
      player_value_path: 'stats.tdr',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tdr'
    },
    'stats.ry_pra': {
      category: 'efficiency',
      column_header: 'YPC',
      csv_header: 'Rushing Yards Per Rush Attempt',
      player_value_path: 'stats.ry_pra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ry_pra'
    },
    'stats.ra': {
      category: 'rushing',
      column_header: 'ATT',
      csv_header: 'Rushing Attempts',
      player_value_path: 'stats.ra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ra'
    },
    'stats.rfd': {
      category: 'rushing',
      column_header: 'FD',
      csv_header: 'Rushing First Downs',
      player_value_path: 'stats.rfd',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rfd'
    },
    'stats.posra': {
      category: 'efficiency',
      column_header: 'POS',
      csv_header: 'Positive Yardage Rush Attempts',
      player_value_path: 'stats.posra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'posra'
    },
    'stats.ryaco': {
      category: 'after contact',
      column_header: 'YDS',
      csv_header: 'Rushing Yards After Contact',
      player_value_path: 'stats.ryaco',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ryaco'
    },
    'stats.ryaco_pra': {
      category: 'after contact',
      column_header: 'AVG',
      csv_header: 'Rushing Yards After Contact Per Rush Attempt',
      player_value_path: 'stats.ryaco_pra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'ryaco_pra'
    },
    'stats._stra': {
      category: 'team share',
      column_header: 'ATT%',
      csv_header: 'Share of Team Rushing Attempts',
      player_value_path: 'stats._stra',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_stra'
    },
    'stats._stry': {
      category: 'team share',
      column_header: 'YDS%',
      csv_header: 'Share of Team Rushing Yardage',
      player_value_path: 'stats._stry',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_stry'
    },
    'stats._fumlpra': {
      category: 'efficiency',
      column_header: 'FUM%',
      csv_header: 'Fumble Percentage',
      player_value_path: 'stats._fumlpra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_fumlpra'
    },
    'stats.posra_pra': {
      category: 'efficiency',
      column_header: 'POS%',
      csv_header: 'Positive Rushing Yardage Percentage',
      player_value_path: 'stats.posra_pra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'posra_pra'
    },
    'stats.rasucc_pra': {
      category: 'efficiency',
      column_header: 'SUCC%',
      csv_header: 'Successful Rush Percentage',
      player_value_path: 'stats.rasucc_pra',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rasucc_pra'
    },
    'stats.mbt': {
      category: 'broken tackles',
      column_header: 'BT',
      csv_header: 'Broken Tackles',
      player_value_path: 'stats.mbt',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'mbt'
    },
    'stats.mbt_pt': {
      category: 'broken tackles',
      column_header: 'BT/T',
      csv_header: 'Broken Tackles Per Rush Attempt',
      player_value_path: 'stats.mbt_pt',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'mbt_pt'
    },

    'stats.rec': {
      category: 'receiving',
      column_header: 'REC',
      csv_header: 'Receptions',
      player_value_path: 'stats.rec',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rec'
    },
    'stats.recy': {
      category: 'receiving',
      column_header: 'YDS',
      csv_header: 'Receiving Yards',
      player_value_path: 'stats.recy',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'recy'
    },
    'stats.tdrec': {
      category: 'receiving',
      column_header: 'TD',
      csv_header: 'Receiving Touchdowns',
      player_value_path: 'stats.tdrec',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'tdrec'
    },
    'stats.drp': {
      category: 'receiving',
      column_header: 'DRP',
      csv_header: 'Drops',
      player_value_path: 'stats.drp',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'drp'
    },
    'stats.dryprecy': {
      category: 'receiving',
      column_header: 'DRP YDS',
      csv_header: 'Dropped Receiving Yards',
      player_value_path: 'stats.dryprecy',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'dryprecy'
    },
    'stats.trg': {
      category: 'oppurtunity',
      column_header: 'TAR',
      csv_header: 'Targets',
      player_value_path: 'stats.trg',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'trg'
    },
    'stats.dptrg_pct': {
      category: 'oppurtunity',
      column_header: 'DEEP%',
      csv_header: 'Percentage of Targets Traveling >= 20 Air Yards',
      player_value_path: 'stats.dptrg_pct',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'dptrg_pct'
    },
    'stats._ayptrg': {
      category: 'oppurtunity',
      column_header: 'DOT',
      csv_header: 'Depth Of Target',
      player_value_path: 'stats._ayptrg',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_ayptrg'
    },
    'stats.rdot': {
      category: 'oppurtunity',
      column_header: 'AY',
      csv_header: 'Air Yards',
      player_value_path: 'stats.rdot',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: 'rdot'
    },
    'stats._stray': {
      category: 'oppurtunity',
      column_header: 'AY%',
      csv_header: "Share of Team's Air Yards",
      player_value_path: 'stats._stray',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_stray'
    },
    'stats._sttrg': {
      category: 'oppurtunity',
      column_header: 'TAR%',
      csv_header: "Share of Team's Targets",
      player_value_path: 'stats._sttrg',
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_sttrg'
    },
    'stats._wopr': {
      category: 'oppurtunity',
      column_header: 'WOPR',
      csv_header: 'Weighted Opportunity Rating',
      player_value_path: 'stats._wopr',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_wopr'
    },
    'stats._recypay': {
      category: 'efficiency',
      column_header: 'RACR',
      csv_header: 'Receiver Air Conversion Ratio (RACR)',
      player_value_path: 'stats._recypay',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_recypay'
    },
    'stats._recyprec': {
      category: 'efficiency',
      column_header: 'Y/R',
      csv_header: 'Receiving Yards Per Reception',
      player_value_path: 'stats._recyprec',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_recyprec'
    },
    'stats._recyptrg': {
      category: 'efficiency',
      column_header: 'Y/T',
      csv_header: 'Receiving Yards Per Target',
      player_value_path: 'stats._recyptrg',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_recyptrg'
    },
    'stats._ryacprec': {
      category: 'efficiency',
      column_header: 'YAC/R',
      csv_header: 'Yards After Catch Per Reception',
      player_value_path: 'stats._ryacprec',
      fixed: 1,
      percentile_key: 'PLAYER_PLAY_BY_PLAY_STATS',
      percentile_field: '_ryacprec'
    },

    opponent_pass_pa: {
      category: 'passing matchup',
      column_header: 'ATT',
      csv_header: 'Opponent pass atts over average',
      percentile_field: 'pa',
      ...opponent_field('pa')
    },
    opponent_pass_pc: {
      category: 'passing matchup',
      column_header: 'COMP',
      csv_header: 'Opponent pass comps over average',
      percentile_field: 'pc',
      ...opponent_field('pc')
    },
    opponent_pass_py: {
      category: 'passing matchup',
      column_header: 'YDS',
      csv_header: 'Opponent pass yds over average',
      percentile_field: 'py',
      ...opponent_field('py')
    },
    opponent_pass_tdp: {
      category: 'passing matchup',
      column_header: 'TD',
      csv_header: 'Opponent pass tds over average',
      percentile_field: 'tdp',
      ...opponent_field('tdp')
    },
    opponent_pass_ints: {
      category: 'passing matchup',
      column_header: 'INTS',
      csv_header: 'Opponent pass ints over average',
      percentile_field: 'ints',
      ...opponent_field('ints')
    },

    opponent_rush_ra: {
      category: 'rushing matchup',
      column_header: 'ATT',
      csv_header: 'Opponent rush atts over average',
      percentile_field: 'ra',
      ...opponent_field('ra')
    },
    opponent_rush_ry: {
      category: 'rushing matchup',
      column_header: 'YDS',
      csv_header: 'Opponent rush yds over average',
      percentile_field: 'ry',
      ...opponent_field('ry')
    },
    opponent_rush_tdr: {
      category: 'rushing matchup',
      column_header: 'TD',
      csv_header: 'Opponent rush tds over average',
      percentile_field: 'tdr',
      ...opponent_field('tdr')
    },

    opponent_recv_trg: {
      category: 'receiving matchup',
      column_header: 'TRG',
      csv_header: 'Opponent targets over average',
      percentile_field: 'trg',
      ...opponent_field('trg')
    },
    opponent_recv_rec: {
      category: 'receiving matchup',
      column_header: 'REC',
      csv_header: 'Opponent recs over average',
      percentile_field: 'rec',
      ...opponent_field('rec')
    },
    opponent_recv_recy: {
      category: 'receiving matchup',
      column_header: 'YDS',
      csv_header: 'Opponent recv yds over average',
      percentile_field: 'recy',
      ...opponent_field('recy')
    },
    opponent_recv_tdrec: {
      category: 'receiving matchup',
      column_header: 'TD',
      csv_header: 'Opponent recv tds over average',
      percentile_field: 'tdrec',
      ...opponent_field('tdrec')
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    fields[key].key = key
    fields[key].key_path = value.player_value_path
      ? value.player_value_path.split('.')
      : []
  }

  return fields
}
