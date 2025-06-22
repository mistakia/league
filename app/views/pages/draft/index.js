import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  constants,
  getDraftWindow,
  getDraftDates,
  get_last_consecutive_pick
} from '@libs-shared'
import { draftActions } from '@core/draft'
import {
  get_app,
  getCurrentLeague,
  getSelectedDraftPlayer,
  getDraft,
  getPicks,
  getNextPick,
  getLastPick,
  getRookiePlayers
} from '@core/selectors'
import { playerActions } from '@core/players'
import { confirmationActions } from '@core/confirmations'
import { leagueActions } from '@core/leagues'
import { teamActions } from '@core/teams'

import DraftPage from './draft'

const mapStateToProps = createSelector(
  getRookiePlayers,
  getSelectedDraftPlayer,
  getNextPick,
  getDraft,
  getPicks,
  getCurrentLeague,
  get_app,
  getLastPick,
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

const mapDispatchToProps = {
  loadDraft: draftActions.load_draft,
  draftPlayer: draftActions.draft_player,
  showConfirmation: confirmationActions.show,
  loadAllPlayers: playerActions.load_all_players,
  load_league: leagueActions.load_league,
  loadTeams: teamActions.loadTeams
}

export default connect(mapStateToProps, mapDispatchToProps)(DraftPage)
