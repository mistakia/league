import moment from 'moment'
import { createSelector } from 'reselect'

import { constants } from '@common'
import { getTeams } from '@core/teams'
import { getApp } from '@core/app'
import { League } from './league'

export function getLeagues (state) {
  return state.get('leagues').toList()
}

export function getCurrentLeague (state) {
  const { leagueId } = getApp(state)
  return state.get('leagues').get(leagueId).toJS()
}

export function getCurrentLeagueTeamIds (state) {
  const { leagueId } = getApp(state)
  return state.get('leagues').get(leagueId).teams
}

export function getLeagueById (state, { lid }) {
  const leagues = state.get('leagues')
  return leagues.get(lid) || new League()
}

export function getLeagueEvents (state) {
  const league = getCurrentLeague(state)
  const events = []
  const now = moment()
  if (league.ddate) {
    const totalPicks = league.nteams * 3
    const date = moment(league.ddate, 'X').add(totalPicks, 'days')
    if (now.isBefore(date)) {
      events.push({
        detail: 'Sign Rookie FAs',
        date
      })
    }
  }

  const firstDayOfWaivers = constants.season.start.clone().add('1', 'week')
  if (now.isBefore(firstDayOfWaivers)) {
    events.push({
      detail: 'Sign Veteran FAs',
      date: firstDayOfWaivers
    })
  }

  if (now.isBefore(constants.season.openingDay)) {
    events.push({
      detail: 'Opening day',
      date: constants.season.openingDay.clone()
    })
  }

  if (league.adate) {
    const date = moment(league.adate, 'X')
    if (now.isBefore(date)) {
      events.push({
        detail: 'Auction',
        date
      })
    }
  }

  if (league.tddate) {
    const date = moment(league.tddate, 'X')
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
      date: constants.season.end.clone()
    })
  }

  return events.sort((a, b) => a.date.unix() - b.date.unix())
}

export const getTeamsForCurrentLeague = createSelector(
  getCurrentLeagueTeamIds,
  getTeams,
  (teamIds, teams) => {
    return teamIds.map(tid => teams.get(tid))
  }
)
