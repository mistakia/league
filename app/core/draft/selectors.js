import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import { Map } from 'immutable'
import { createSelector } from 'reselect'

import { League } from '@core/leagues'
import { getPlayerById } from '@core/players'
import { getDraftWindow, constants } from '@common'

dayjs.extend(utc)

export function getDraft(state) {
  return state.get('draft')
}

export const getPicks = createSelector(
  getDraft,
  (state) => state.get('app'),
  (draft, app) => {
    const { picks, draft_start, draft_type, draft_hour_min, draft_hour_max } =
      draft
    const { teamId } = app
    let previousSelected = true
    let previousActive = true
    let previousNotActive = false
    return picks
      .sort((a, b) => a.pick - b.pick)
      .map((p) => {
        if (p.pid || (p.tid !== teamId && previousNotActive)) {
          return p
        }

        if (draft_start && draft_type) {
          p.draftWindow = getDraftWindow({
            start: draft_start,
            type: draft_type,
            min: draft_hour_min,
            max: draft_hour_max,
            pickNum: p.pick
          })
        }

        if (previousNotActive) {
          return p
        }

        const isActive =
          constants.season.now.isAfter(p.draftWindow) || previousSelected

        previousNotActive = !isActive && previousActive
        previousActive = isActive
        previousSelected = Boolean(p.pid)

        return p
      })
  }
)

export const getLastPick = createSelector(getDraft, (draft) => {
  return draft.picks.filter((p) => p.pick).max((a, b) => a.pick > b.pick)
})

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

export const getDraftEnd = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  getLastPick,
  (leagueId, leagues, lastPick) => {
    if (!lastPick) {
      return null
    }

    const league = leagues.get(leagueId, new League())
    if (lastPick.selection_timestamp) {
      return dayjs.unix(lastPick.selection_timestamp).endOf('day')
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
)

export const isAfterDraft = createSelector(
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.get('leagues'),
  getDraftEnd,
  (leagueId, leagues, draftEnd) => {
    if (constants.isRegularSeason) {
      return {
        afterDraft: true,
        afterWaivers: true
      }
    }

    const league = leagues.get(leagueId, new League())
    const afterDraft =
      league.draft_start && draftEnd && dayjs().isAfter(draftEnd)
    const afterWaivers =
      league.draft_start &&
      draftEnd &&
      dayjs().isAfter(draftEnd.endOf('day').add(1, 'day'))
    return {
      afterDraft,
      afterWaivers
    }
  }
)

export const getNextPick = createSelector(
  getDraft,
  (state) => state.get('app'),
  (draft, app) => {
    const { draft_start, draft_type, draft_hour_min, draft_hour_max, picks } =
      draft
    const { teamId } = app
    const team_picks = picks
      .filter((p) => p.tid === teamId)
      .sort((a, b) => a.pick - b.pick)
    const pick = team_picks.filter((p) => p.pick).find((p) => !p.pid)
    if (!pick) return null

    if (draft_start && draft_type) {
      pick.draftWindow = getDraftWindow({
        start: draft_start,
        type: draft_type,
        min: draft_hour_min,
        max: draft_hour_max,
        pickNum: pick.pick
      })
    }

    return pick
  }
)
