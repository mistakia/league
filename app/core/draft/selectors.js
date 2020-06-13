import { getPlayerById } from '@core/players'

export function getDraft (state) {
  return state.get('draft')
}

export function getDraftPicks (state) {
  return state.get('draft').get('picks')
}

export function getCurrentPick (state) {
  const picks = getDraftPicks(state)

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
