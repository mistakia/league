import dayjs from 'dayjs'
import { createSelector } from 'reselect'
import { List } from 'immutable'

import { constants, getDraftDates, getFreeAgentPeriod } from '@common'
import { getTeams } from '@core/teams'
import { getApp } from '@core/app'
import { League } from './league'
import { getLastPick } from '@core/draft'

export function getLeagues(state) {
  return state.get('leagues').toList()
}

export const getCurrentLeague = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  (leagueId, leagues) => {
    return leagues.get(leagueId, new League()).toJS()
  }
)

export function getCurrentLeagueTeamIds(state) {
  const { leagueId } = getApp(state)
  return state.getIn(['leagues', leagueId, 'teams'], new List())
}

export function getLeagueById(state, { lid }) {
  const leagues = state.get('leagues')
  return leagues.get(lid) || new League()
}

export function isBeforeExtensionDeadline(state) {
  const league = getCurrentLeague(state)
  if (!league.ext_date) {
    return true
  }

  const deadline = dayjs.unix(league.ext_date)
  return constants.season.now.isBefore(deadline)
}

export function isBeforeTransitionStart(state) {
  const league = getCurrentLeague(state)
  const deadline = dayjs.unix(league.tran_start)
  return constants.season.now.isBefore(deadline)
}

export function isBeforeTransitionEnd(state) {
  const league = getCurrentLeague(state)
  const deadline = dayjs.unix(league.tran_end)
  return constants.season.now.isBefore(deadline)
}

export function isRestrictedFreeAgencyPeriod(state) {
  return !isBeforeTransitionStart(state) && isBeforeTransitionEnd(state)
}

export const getTeamsForCurrentLeague = createSelector(
  getCurrentLeagueTeamIds,
  getTeams,
  (teamIds, teams) => {
    return teamIds.map((tid) => teams.get(tid))
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
