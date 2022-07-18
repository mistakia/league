import dayjs from 'dayjs'
import { Map } from 'immutable'

import { getCurrentLeague } from '@core/leagues'
import { getPlayerById } from '@core/players'
import { getApp } from '@core/app'
import { getDraftWindow, constants } from '@common'

export function getDraft(state) {
  return state.get('draft')
}

export function getPicks(state) {
  const { picks, draft_start, draft_type, draft_hour_min, draft_hour_max } =
    getDraft(state)
  const { teamId } = getApp(state)
  return picks.map((p) => {
    if (p.tid !== teamId) {
      return p
    }

    p.draftWindow = getDraftWindow({
      start: draft_start,
      type: draft_type,
      min: draft_hour_min,
      max: draft_hour_max,
      pickNum: p.pick
    })

    return p
  })
}

export function getNextPick(state) {
  const { draft_start, draft_type, draft_hour_min, draft_hour_max, picks } =
    getDraft(state)
  const { teamId } = getApp(state)
  const team_picks = picks
    .filter((p) => p.tid === teamId)
    .sort((a, b) => a.pick - b.pick)
  const pick = team_picks.filter((p) => p.pick).find((p) => !p.pid)
  if (!pick) return null

  pick.draftWindow = getDraftWindow({
    start: draft_start,
    type: draft_type,
    min: draft_hour_min,
    max: draft_hour_max,
    pickNum: pick.pick
  })
  return pick
}

export function getLastPick(state) {
  const { picks } = getDraft(state)
  return picks.filter((p) => p.pick).max((a, b) => a.pick > b.pick)
}

export function getSelectedDraftPlayer(state) {
  const draft = state.get('draft')
  return getPlayerById(state, { pid: draft.selected })
}

export function isDrafted(state, { pid, playerMap = new Map() }) {
  pid = pid || playerMap.get('pid')
  if (!pid) {
    return false
  }

  const { drafted } = state.get('draft')
  return drafted.includes(pid)
}

export function getDraftEnd(state) {
  const league = getCurrentLeague(state)
  const lastPick = getLastPick(state)
  if (!lastPick) {
    return null
  }

  const draftEnd = getDraftWindow({
    start: league.draft_start,
    pickNum: lastPick.pick + 1,
    type: league.draft_type,
    min: league.draft_hour_min,
    max: league.draft_hour_max
  })

  return draftEnd
}

export function isAfterDraft(state) {
  if (constants.season.isRegularSeason) {
    return {
      afterDraft: true,
      afterWaivers: true
    }
  }

  const league = getCurrentLeague(state)
  const draftEnd = getDraftEnd(state)
  const afterDraft = league.draft_start && draftEnd && dayjs().isAfter(draftEnd)
  const afterWaivers =
    league.draft_start &&
    draftEnd &&
    dayjs().isAfter(draftEnd.endOf('day').add(1, 'day'))
  return {
    afterDraft,
    afterWaivers
  }
}
