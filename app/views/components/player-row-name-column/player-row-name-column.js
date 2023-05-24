import React from 'react'
import { Map } from 'immutable'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants, get_string_from_object } from '@libs-shared'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import Position from '@components/position'
import PlayerLabel from '@components/player-label'
import PlayerTag from '@components/player-tag'
import NFLTeam from '@components/nfl-team'
import IconButton from '@components/icon-button'

import './player-row-name-column.styl'

export default function PlayerRowNameColumn({
  row,
  player_maps,
  is_logged_in,
  is_league_hosted,
  select_player,
  show_context_menu
}) {
  const player_map = player_maps.get(row.original.pid, new Map())
  const name =
    window.innerWidth < 600 ? player_map.get('pname') : player_map.get('name')
  const nfl_team = player_map.get('team')
  const pos = player_map.get('pos')
  const pid = player_map.get('pid')
  const tag = player_map.get('tag')

  const handle_click = () => select_player(pid)
  const handle_context_click = (event) => {
    event.stopPropagation()
    show_context_menu({
      id: 'player',
      data: { pid },
      clickX: event.clientX,
      clickY: event.clientY
    })
  }

  return (
    <div
      className={get_string_from_object({
        'player__row-name-column': true,
        border_right: is_logged_in
      })}
    >
      <div className='player__row-name-column-action watchlist'>
        <PlayerWatchlistAction pid={pid} />
      </div>
      <div className='player__row-name-column-pos'>
        <Position pos={pos} />
      </div>
      <div
        className='player__row-name-column-name cursor'
        onClick={handle_click}
      >
        <span>{name}</span>
        {constants.year === player_map.get('start') && (
          <PlayerLabel label='R' type='rookie' description='Rookie' />
        )}
        <NFLTeam team={nfl_team} />
      </div>
      {is_logged_in && tag && <PlayerTag tag={tag} />}
      {is_logged_in && (
        <div className='player__row-name-column-action actions'>
          {Boolean(is_league_hosted) && (
            <IconButton small text onClick={handle_context_click} icon='more' />
          )}
        </div>
      )}
    </div>
  )
}

PlayerRowNameColumn.propTypes = {
  is_logged_in: PropTypes.bool,
  is_league_hosted: PropTypes.bool,
  select_player: PropTypes.func,
  show_context_menu: PropTypes.func,
  row: PropTypes.object,
  player_maps: ImmutablePropTypes.map
}
