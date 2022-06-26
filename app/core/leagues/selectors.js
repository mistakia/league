import dayjs from 'dayjs'
import { createSelector } from 'reselect'

import { constants, getDraftDates, getFreeAgentPeriod } from '@common'
import { getTeams } from '@core/teams'
import { getApp } from '@core/app'
import { League } from './league'
import { getLastPick } from '@core/draft'

export function getLeagues(state) {
  return state.get('leagues').toList()
}

export function getCurrentLeague(state) {
  const { leagueId } = getApp(state)
  return state.get('leagues').get(leagueId).toJS()
}

export function getCurrentLeagueTeamIds(state) {
  const { leagueId } = getApp(state)
  return state.get('leagues').get(leagueId).teams
}

export function getLeagueById(state, { lid }) {
  const leagues = state.get('leagues')
  return leagues.get(lid) || new League()
}

export function getLeagueEvents(state) {
  const league = getCurrentLeague(state)
  const events = []
  const now = dayjs()
  if (league.ddate) {
    const ddate = dayjs.unix(league.ddate)
    if (now.isBefore(ddate)) {
      events.push({
        detail: 'Rookie Draft Begins',
        date: ddate
      })
    }

    const lastPick = getLastPick(state)
    if (lastPick) {
      const draftDates = getDraftDates({
        start: league.ddate,
        picks: lastPick.pick
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
      detail: 'Veteran Waivers Clear',
      date: firstWaiverDate
    })
  } else if (constants.season.isRegularSeason) {
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
    const faPeriod = getFreeAgentPeriod(league.adata)
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
        data: faPeriod.end
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

export function isBeforeExtensionDeadline(state) {
  const league = getCurrentLeague(state)
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

export function isRestrictedFreeAgencyPeriond(state) {
  return !isBeforeTransitionStart(state) && isBeforeTransitionEnd(state)
}

export const getTeamsForCurrentLeague = createSelector(
  getCurrentLeagueTeamIds,
  getTeams,
  (teamIds, teams) => {
    return teamIds.map((tid) => teams.get(tid))
  }
)
