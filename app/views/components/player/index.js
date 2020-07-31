import React from 'react'
import { connect as connectRedux } from 'react-redux'
import { createSelector } from 'reselect'

import { contextMenuActions, getContextMenuInfo } from '@core/context-menu'
import { getApp } from '@core/app'

import './player.styl'

export class Player extends React.Component {
  handleContextClick = (event) => {
    event.stopPropagation()
    this.props.showContext({
      id: 'player',
      data: { playerId: this.props.player.player },
      clickX: event.clientX,
      clickY: event.clientY
    })
  }
}

const mapStateToProps = createSelector(
  getApp,
  getContextMenuInfo,
  (app, contextMenu) => ({ vbaseline: app.vbaseline, selected: contextMenu.data.playerId })
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
