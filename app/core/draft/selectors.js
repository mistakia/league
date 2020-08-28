import moment from 'moment'

import { getCurrentLeague } from '@core/leagues'
import { getPlayerById } from '@core/players'
import { getApp } from '@core/app'

export function getDraft (state) {
  return state.get('draft')
}

export function getPicks (state) {
  const { picks } = getDraft(state)
  const { teamId } = getApp(state)

  return picks.filter(p => p.tid === teamId)
}

export function getNextPick (state) {
  const picks = getPicks(state)
  return picks.find(p => !p.player)
}

export function getSelectedDraftPlayer (state) {
  const draft = state.get('draft')
  return getPlayerById(state, { playerId: draft.selected })
}

export function isDrafted (state, { playerId, player }) {
  const id = playerId || player.player
  const { drafted } = state.get('draft')
  return drafted.includes(id)
}

export function isAfterDraft (state) {
  const league = getCurrentLeague(state)
  const totalPicks = league.nteams * 3
  const afterDraft = league.ddate && moment().isAfter(moment(league.ddate, 'X').add(totalPicks, 'day'))
  const afterWaivers = league.ddate && moment().isAfter(moment(league.ddate, 'X').add(totalPicks + 1, 'day'))
  return {
    afterDraft,
    afterWaivers
  }
}
