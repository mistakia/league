import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { connect as connectRedux } from 'react-redux'
import { createSelector } from 'reselect'

import { context_menu_actions } from '@core/context-menu'
import { get_context_menu_info, get_current_league } from '@core/selectors'
import { player_actions } from '@core/players'

import './player.styl'

export class Player extends React.Component {
  handleContextClick = (event) => {
    const { waiverId, player_map, poachId } = this.props
    event.stopPropagation()
    this.props.showContext({
      id: 'player',
      data: { pid: player_map?.get('pid'), waiverId, poachId },
      clickX: event.clientX,
      clickY: event.clientY
    })
  }

  handleClick = () => {
    this.props.select(this.props.player_map?.get('pid'))
  }
}

Player.propTypes = {
  waiverId: PropTypes.number,
  poachId: PropTypes.number,
  player_map: ImmutablePropTypes.map,
  showContext: PropTypes.func,
  select: PropTypes.func
}

const map_state_to_props = createSelector(
  get_context_menu_info,
  get_current_league,
  (contextMenu, league) => ({
    selected: contextMenu.getIn(['data', 'pid']),
    league,
    is_hosted: Boolean(league.hosted)
  })
)

const map_dispatch_to_props = {
  showContext: context_menu_actions.show,
  select: player_actions.select_player
}

export function connect(Component) {
  return connectRedux(map_state_to_props, map_dispatch_to_props)(Component)
}
export default connect(Player)
