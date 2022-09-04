import dayjs from 'dayjs'
import { List } from 'immutable'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getNextPick } from '@core/draft'
import { getActivePoachesAgainstMyPlayers } from '@core/poaches'

import { Team } from './team'

export function getTeams(state) {
  return state.get('teams')
}

export function getTeamById(state, { tid }) {
  const teams = state.get('teams')
  return teams.get(tid) || new Team()
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

export function getOverallStandings(state) {
  const { year } = getApp(state)
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

export function getTeamsForCurrentLeague(state) {
  const { leagueId } = getApp(state)
  const teams = getTeams(state)
  return teams.filter((t) => t.lid === leagueId)
}

export function getCurrentTeam(state) {
  const { teamId } = getApp(state)
  return getTeams(state).get(teamId, new Team())
}

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
