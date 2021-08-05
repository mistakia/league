import dayjs from 'dayjs'
import { createSelector } from 'reselect'

import { constants } from '@common'
import { getTeams } from '@core/teams'
import { getApp } from '@core/app'
import { League } from './league'

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
    const totalPicks = league.nteams * 3
    const date = dayjs.unix(league.ddate).add(totalPicks, 'days')
    if (now.isBefore(date)) {
      events.push({
        detail: 'Sign Rookie FAs',
        date
      })
    }
  }

  const firstDayOfRegularSeason = constants.season.start.add('1', 'week')
  if (now.isBefore(firstDayOfRegularSeason)) {
    events.push({
      detail: 'Start of Regular Season',
      date: firstDayOfRegularSeason
    })
  }

  const firstWaiverDate = constants.season.start
    .add('1', 'week')
    .day(3)
    .hour(14)
  if (now.isBefore(firstWaiverDate)) {
    events.push({
      detail: 'Waivers Processed',
      date: firstWaiverDate
    })
  } else if (constants.season.isRegularSeason) {
    const waiverDate = dayjs.tz('America/New_York').day(3).hour(15)
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
    const date = dayjs.unix(league.adate)
    if (now.isBefore(date)) {
      events.push({
        detail: 'Auction',
        date
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
      detail: 'Offseason',
      date: constants.season.end
    })
  }

  return events.sort((a, b) => a.date.unix() - b.date.unix())
}

export function isBeforeExtensionDeadline(state) {
  const league = getCurrentLeague(state)
  const deadline = dayjs().unix(league.ext_date)
  return constants.season.now.isBefore(deadline)
}

export const getTeamsForCurrentLeague = createSelector(
  getCurrentLeagueTeamIds,
  getTeams,
  (teamIds, teams) => {
    return teamIds.map((tid) => teams.get(tid))
  }
)
