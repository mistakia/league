import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  constants,
  getDraftWindow,
  getDraftDates,
  get_last_consecutive_pick
} from '@libs-shared'
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
    const last_consecutive_pick = get_last_consecutive_pick(picks.toJS())
    const windowEnd = nextPick
      ? getDraftWindow({
          last_consecutive_pick,
          start: league.draft_start,
          type: league.draft_type,
          min: league.draft_hour_min,
          max: league.draft_hour_max,
          pickNum: nextPick.pick + 1
        })
      : null

    const isWindowOpen =
      nextPick && constants.season.now.isAfter(nextPick.draftWindow)

    let is_draft_complete = false
    if (last_pick) {
      const draftDates = getDraftDates({
        start: league.draft_start,
        type: league.draft_type,
        min: league.draft_hour_min,
        max: league.draft_hour_max,
        picks: last_pick.pick, // TODO — should be total number of picks in case some picks are missing due to decommissoned teams
        last_selection_timestamp: last_pick.selection_timestamp
      })

      is_draft_complete = constants.season.now.isAfter(draftDates.draftEnd)
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
      is_draft_complete
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
