import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { connect as connectRedux } from 'react-redux'
import { createSelector } from 'reselect'

import { contextMenuActions, getContextMenuInfo } from '@core/context-menu'
import { getCurrentLeague } from '@core/leagues'
import { playerActions } from '@core/players'

import './player.styl'

export class Player extends React.Component {
  handleContextClick = (event) => {
    const { waiverId, player, poachId } = this.props
    event.stopPropagation()
    this.props.showContext({
      id: 'player',
      data: { playerId: player.player, waiverId, poachId },
      clickX: event.clientX,
      clickY: event.clientY
    })
  }

  handleClick = () => {
    this.props.select(this.props.player.player)
  }
}

Player.propTypes = {
  waiverId: PropTypes.number,
  poachId: PropTypes.number,
  player: ImmutablePropTypes.record,
  showContext: PropTypes.func,
  select: PropTypes.func
}

const mapStateToProps = createSelector(
  getContextMenuInfo,
  getCurrentLeague,
  (contextMenu, league) => ({
    selected: contextMenu.data.playerId,
    league,
    isHosted: !!league.hosted
  })
)

const mapDispatchToProps = {
  showContext: contextMenuActions.show,
  select: playerActions.selectPlayer
}

export function connect(Component) {
  return connectRedux(mapStateToProps, mapDispatchToProps)(Component)
}
export default connect(Player)
