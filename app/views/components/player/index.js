import React from 'react'
import { connect as connectRedux } from 'react-redux'
import { createSelector } from 'reselect'

import { contextMenuActions, getContextMenuInfo } from '@core/context-menu'
import { getCurrentLeague } from '@core/leagues'
import { getApp } from '@core/app'

import './player.styl'

export class Player extends React.Component {
  handleContextClick = (event, waiverId) => {
    event.stopPropagation()
    this.props.showContext({
      id: 'player',
      data: { playerId: this.props.player.player, waiverId },
      clickX: event.clientX,
      clickY: event.clientY
    })
  }
}

const mapStateToProps = createSelector(
  getApp,
  getContextMenuInfo,
  getCurrentLeague,
  (app, contextMenu, league) => ({
    vbaseline: app.vbaseline,
    selected: contextMenu.data.playerId,
    isHosted: league.hosted
  })
)

const mapDispatchToProps = {
  showContext: contextMenuActions.show
}

export function connect (Component) {
  return connectRedux(
    mapStateToProps,
    mapDispatchToProps
  )(Component)
}
export default connect(Player)
