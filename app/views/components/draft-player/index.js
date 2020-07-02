import { createSelector } from 'reselect'
import { connect } from 'react-redux'

import { getApp } from '@core/app'
import { draftActions, getDraft, isDrafted } from '@core/draft'
import { getPlayers } from '@core/players'

import DraftPlayer from './draft-player'

const mapStateToProps = createSelector(
  getDraft,
  isDrafted,
  getApp,
  getPlayers,
  (draft, isDrafted, app, players) => ({
    selected: draft.selected,
    isDrafted,
    vbaseline: app.vbaseline,
    watchlist: players.get('watchlist')
  })
)

const mapDispatchToProps = {
  select: draftActions.selectPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DraftPlayer)
