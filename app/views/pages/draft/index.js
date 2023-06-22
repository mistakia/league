import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants, getDraftWindow } from '@libs-shared'
import { draftActions } from '@core/draft'
import {
  get_app,
  getCurrentLeague,
  getSelectedDraftPlayer,
  getDraft,
  getPicks,
  getNextPick,
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
  (players, selectedPlayerMap, nextPick, draft, picks, league, app) => {
    const windowEnd = nextPick
      ? getDraftWindow({
          start: league.draft_start,
          type: league.draft_type,
          min: league.draft_hour_min,
          max: league.draft_hour_max,
          pickNum: nextPick.pick + 1
        })
      : null

    const isWindowOpen =
      nextPick && constants.season.now.isAfter(nextPick.draftWindow)

    return {
      windowEnd,
      isDraftWindowOpen: isWindowOpen,
      players,
      nextPick,
      selectedPlayerMap,
      teamId: app.teamId,
      picks,
      drafted: draft.drafted,
      league
    }
  }
)

const mapDispatchToProps = {
  loadDraft: draftActions.loadDraft,
  draftPlayer: draftActions.draftPlayer,
  showConfirmation: confirmationActions.show,
  loadAllPlayers: playerActions.loadAllPlayers,
  load_league: leagueActions.load_league,
  loadTeams: teamActions.loadTeams
}

export default connect(mapStateToProps, mapDispatchToProps)(DraftPage)
