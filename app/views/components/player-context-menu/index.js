import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { context_menu_actions } from '@core/context-menu'
import { roster_actions } from '@core/rosters'
import { confirmation_actions } from '@core/confirmations'
import { waiver_actions } from '@core/waivers'
import { player_actions } from '@core/players'
import {
  getPlayerStatus,
  get_players_state,
  getPlayerById,
  get_auction_state,
  get_app,
  get_current_league
} from '@core/selectors'
import { auction_actions } from '@core/auction'

import PlayerContextMenu from './player-context-menu'

const map_state_to_props = createSelector(
  getPlayerById,
  getPlayerStatus,
  get_players_state,
  get_auction_state,
  get_app,
  get_current_league,
  (playerMap, status, players, auction, app, league) => ({
    playerMap,
    status,
    isOnCutlist: players.get('cutlist').includes(playerMap.get('pid')),
    isNominating:
      !auction.isPaused &&
      !auction.nominated_pid &&
      (auction.nominatingTeamId === app.teamId ||
        app.userId === league.commishid)
  })
)

const map_dispatch_to_props = {
  hide: context_menu_actions.hide,
  showConfirmation: confirmation_actions.show,
  cancelClaim: waiver_actions.cancel,
  reserve: roster_actions.reserve,
  release: roster_actions.release,
  protect: roster_actions.protect,
  toggle_cutlist: player_actions.toggle_cutlist,
  nominate_pid: auction_actions.select,
  nominate_restricted_free_agent: roster_actions.nominate_restricted_free_agent,
  unnominate_restricted_free_agent:
    roster_actions.unnominate_restricted_free_agent
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(PlayerContextMenu)
