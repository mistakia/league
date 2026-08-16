import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { current_season } from '@constants'
import {
  get_draft_pass_window,
  getDraftDates,
  get_draft_clock_now
} from '@libs-shared'
import get_draft_window_config from '@libs-shared/get-draft-window-config.mjs'
import { draft_actions } from '@core/draft'
import {
  get_app,
  get_current_league,
  get_selected_draft_player,
  get_draft_state,
  getPicks,
  get_rookie_draft_next_pick,
  getRookiePlayers
} from '@core/selectors'
import { player_actions } from '@core/players'
import { confirmation_actions } from '@core/confirmations'
import { league_actions } from '@core/leagues'
import { team_actions } from '@core/teams'

import DraftPage from './draft'

const map_state_to_props = createSelector(
  getRookiePlayers,
  get_selected_draft_player,
  get_rookie_draft_next_pick,
  get_draft_state,
  getPicks,
  get_current_league,
  get_app,
  (players, selectedPlayerMap, nextPick, draft, picks, league, app) => {
    // Every clock on this page reads one value, so a pause freezes all of them
    // together, and every publication boundary resolves against that same
    // frozen clock rather than wall time.
    const is_paused = Boolean(league.paused_at)
    const draft_clock_now = get_draft_clock_now({
      paused_at: league.paused_at,
      now: current_season.now
    })

    // When the pick on the clock becomes passable: the slot of the SECOND
    // outstanding pick. Asking for `nextPick.pick + 1` is what this used to
    // do, and on a board with a gap that names a pick that is already MADE,
    // for which the calculator correctly returns null.
    const windowEnd = get_draft_pass_window({
      ...get_draft_window_config(league),
      draft_picks: picks.toJS(),
      until: draft_clock_now
    })

    // No daily-band check: every window is a slot inside the band, so the
    // band could no longer change the answer. A null window -- between a
    // resume and the next publication -- is not after anything, which is what
    // "no pick can be passed yet" means.
    const isWindowOpen = Boolean(
      nextPick && draft_clock_now.isAfter(nextPick.draftWindow)
    )

    const { draftEnd } = getDraftDates({
      rookie_draft_end_at: league.rookie_draft_end_at,
      rookie_draft_completed_at: league.rookie_draft_completed_at
    })
    const is_draft_complete = Boolean(
      draftEnd && draft_clock_now.isAfter(draftEnd)
    )

    return {
      windowEnd,
      isDraftWindowOpen: isWindowOpen,
      players,
      nextPick,
      selectedPlayerMap,
      teamId: app.teamId,
      picks,
      drafted: draft.drafted,
      league,
      is_draft_complete,
      is_paused,
      draft_clock_now
    }
  }
)

const map_dispatch_to_props = {
  load_draft: draft_actions.load_draft,
  draft_player: draft_actions.draft_player,
  showConfirmation: confirmation_actions.show,
  load_all_players: player_actions.load_all_players,
  load_league: league_actions.load_league,
  load_teams: team_actions.load_teams
}

export default connect(map_state_to_props, map_dispatch_to_props)(DraftPage)
