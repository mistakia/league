import dayjs from 'dayjs'

import { getCurrentLeague } from '@core/leagues'
import { getPlayerById } from '@core/players'
import { getApp } from '@core/app'
import { getDraftWindow } from '@common'

export function getDraft(state) {
  return state.get('draft')
}

export function getPicks(state) {
  const { picks } = getDraft(state)
  const { teamId } = getApp(state)

  return picks.filter((p) => p.tid === teamId).sort((a, b) => a.pick - b.pick)
}

export function getNextPick(state) {
  const picks = getPicks(state)
  return picks.filter((p) => p.pick).find((p) => !p.player)
}

export function getLastPick(state) {
  const { picks } = getDraft(state)
  return picks.filter((p) => p.pick).max((a, b) => a.pick > b.pick)
}

export function getSelectedDraftPlayer(state) {
  const draft = state.get('draft')
  return getPlayerById(state, { playerId: draft.selected })
}

export function isDrafted(state, { playerId, player }) {
  const id = playerId || player.player
  const { drafted } = state.get('draft')
  return drafted.includes(id)
}

export function getDraftEnd(state) {
  const league = getCurrentLeague(state)
  const lastPick = getLastPick(state)
  if (!lastPick) {
    return null
  }

  const draftEnd = getDraftWindow({
    start: league.ddate,
    pickNum: lastPick.pick + 1
  })

  return draftEnd
}

export function isAfterDraft(state) {
  const league = getCurrentLeague(state)
  const draftEnd = getDraftEnd(state)
  const afterDraft = league.ddate && draftEnd && dayjs().isAfter(draftEnd)
  const afterWaivers =
    league.ddate && draftEnd && dayjs().isAfter(draftEnd.add(1, 'day'))
  return {
    afterDraft,
    afterWaivers
  }
}
