import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { connect as connectRedux } from 'react-redux'
import { createSelector } from 'reselect'

import { contextMenuActions } from '@core/context-menu'
import { get_context_menu_info, getCurrentLeague } from '@core/selectors'
import { player_actions } from '@core/players'

import './player.styl'

export class Player extends React.Component {
  handleContextClick = (event) => {
    const { waiverId, playerMap, poachId } = this.props
    event.stopPropagation()
    this.props.showContext({
      id: 'player',
      data: { pid: playerMap.get('pid'), waiverId, poachId },
      clickX: event.clientX,
      clickY: event.clientY
    })
  }

  handleClick = () => {
    this.props.select(this.props.playerMap.get('pid'))
  }
}

Player.propTypes = {
  waiverId: PropTypes.number,
  poachId: PropTypes.number,
  playerMap: ImmutablePropTypes.map,
  showContext: PropTypes.func,
  select: PropTypes.func
}

const mapStateToProps = createSelector(
  get_context_menu_info,
  getCurrentLeague,
  (contextMenu, league) => ({
    selected: contextMenu.getIn(['data', 'pid']),
    league,
    is_hosted: Boolean(league.hosted)
  })
)

const mapDispatchToProps = {
  showContext: contextMenuActions.show,
  select: player_actions.select_player
}

export function connect(Component) {
  return connectRedux(mapStateToProps, mapDispatchToProps)(Component)
}
export default connect(Player)
