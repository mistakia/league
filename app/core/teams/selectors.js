import moment from 'moment'
import { Map } from 'immutable'

import { getApp } from '@core/app'
import { getNextPick } from '@core/draft'
import { getActivePoachesAgainstMyPlayers } from '@core/poaches'
import { getCurrentLeague } from '@core/leagues'

import { Team } from './team'

export function getTeams (state) {
  return state.get('teams')
}

export function getTeamById (state, { tid }) {
  const teams = state.get('teams')
  return teams.get(tid) || new Team()
}

export function getDraftPickById (state, { pickId }) {
  const teams = state.get('teams')
  for (const team of teams.valueSeq()) {
    const picks = team.get('picks')
    const pick = picks.find(p => p.uid === pickId)
    if (pick) {
      return pick
    }
  }

  return new Map()
}

export function getTeamsForCurrentLeague (state) {
  const { leagueId } = getApp(state)
  const teams = getTeams(state)
  return teams.filter(t => t.lid === leagueId)
}

export function getCurrentTeam (state) {
  const { teamId } = getApp(state)
  return getTeams(state).get(teamId)
}

export function getTeamEvents (state) {
  const league = getCurrentLeague(state)
  const nextPick = getNextPick(state)
  const activePoaches = getActivePoachesAgainstMyPlayers(state)

  const events = []

  for (const poach of activePoaches.valueSeq()) {
    const date = moment(poach.submitted, 'X').add('48', 'hours')
    events.push({
      detail: 'Claim Expires',
      date
    })
  }

  if (nextPick) {
    const date = moment(league.ddate, 'X').add((nextPick.pick - 1), 'days')
    events.push({
      detail: 'Draft Pick',
      date
    })
  }

  return events.sort((a, b) => a.date.unix() - b.date.unix())
}
