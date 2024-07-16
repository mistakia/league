import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { contextMenuActions } from '@core/context-menu'
import { rosterActions } from '@core/rosters'
import { confirmationActions } from '@core/confirmations'
import { waiverActions } from '@core/waivers'
import { playerActions } from '@core/players'
import {
  getPlayerStatus,
  getPlayers,
  getPlayerById,
  getAuction,
  get_app,
  getCurrentLeague
} from '@core/selectors'
import { auctionActions } from '@core/auction'

import PlayerContextMenu from './player-context-menu'

const mapStateToProps = createSelector(
  getPlayerById,
  getPlayerStatus,
  getPlayers,
  getAuction,
  get_app,
  getCurrentLeague,
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

const mapDispatchToProps = {
  hide: contextMenuActions.hide,
  showConfirmation: confirmationActions.show,
  cancelClaim: waiverActions.cancel,
  reserve: rosterActions.reserve,
  release: rosterActions.release,
  protect: rosterActions.protect,
  toggleCutlist: playerActions.toggleCutlist,
  nominate_pid: auctionActions.select,
  nominate_restricted_free_agent: rosterActions.nominate_restricted_free_agent,
  unnominate_restricted_free_agent:
    rosterActions.unnominate_restricted_free_agent
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerContextMenu)
