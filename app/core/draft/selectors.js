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

export function getCurrentPick (state) {
  const { picks } = getDraft(state)

  for (const pick of picks.values()) {
    if (!pick.player) {
      return pick
    }
  }

  return {}
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
