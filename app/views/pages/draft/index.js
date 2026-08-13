import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { current_season } from '@constants'
import {
  getDraftWindow,
  getDraftDates,
  is_within_daily_window,
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
  get_rookie_draft_last_pick,
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
  get_rookie_draft_last_pick,
  (
    players,
    selectedPlayerMap,
    nextPick,
    draft,
    picks,
    league,
    app,
    last_pick
  ) => {
    // Every clock on this page reads one value, so a pause freezes all of them
    // together. It is also the credit's upper bound, without which a paused
    // team's remaining time would grow rather than hold.
    const is_paused = Boolean(league.paused_at)
    const draft_clock_now = get_draft_clock_now({
      paused_at: league.paused_at,
      now: current_season.now
    })

    const windowEnd = nextPick
      ? getDraftWindow({
          ...get_draft_window_config(league),
          draft_picks: picks.toJS(),
          pick_number: nextPick.pick + 1,
          until: draft_clock_now
        })
      : null

    const isWindowOpen =
      nextPick &&
      draft_clock_now.isAfter(nextPick.draftWindow) &&
      is_within_daily_window(draft_clock_now, get_draft_window_config(league))

    let is_draft_complete = false
    if (last_pick) {
      const draftDates = getDraftDates({
        ...get_draft_window_config(league),
        total_picks: last_pick.pick, // TODO — should be total number of picks in case some picks are missing due to decommissoned teams
        last_selection_timestamp: last_pick.selection_timestamp
      })

      is_draft_complete = draft_clock_now.isAfter(draftDates.draftEnd)
    }

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
