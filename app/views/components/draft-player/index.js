import { createSelector } from 'reselect'
import { connect } from 'react-redux'

import { isDrafted, getDraft, getPlayers } from '@core/selectors'
import { draftActions } from '@core/draft'

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
  select: draftActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(DraftPlayer)
