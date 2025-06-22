import { createSelector } from 'reselect'
import { connect } from 'react-redux'

import { isDrafted, getDraft, getPlayers } from '@core/selectors'
import { draft_actions } from '@core/draft'

import DraftPlayer from './draft-player'

const mapStateToProps = createSelector(
  getDraft,
  isDrafted,
  getPlayers,
  (draft, isDrafted, players) => ({
    selected: draft.selected,
    isDrafted,
    watchlist: players.get('watchlist')
  })
)

const mapDispatchToProps = {
  select: draft_actions.select_player
}

export default connect(mapStateToProps, mapDispatchToProps)(DraftPlayer)
