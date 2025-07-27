import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import NFLTeam from '@components/nfl-team'
import PlayerWatchlistAction from '@components/player-watchlist-action'

import './draft-player.styl'

export default class DraftPlayer extends React.Component {
  handleClick = () => {
    this.props.select(this.props.player_map.get('pid'))
  }

  render = () => {
    const { player_map, selected, is_player_drafted, index, watchlist, style } =
      this.props

    const pid = player_map.get('pid')
    const classNames = ['player-draft__item']
    if (selected === pid) {
      classNames.push('selected')
    }

    if (is_player_drafted) {
      classNames.push('drafted')
    } else if (watchlist.has(pid)) {
      classNames.push('watchlist')
    }

    const value = player_map.getIn(['market_salary', '0'])

    return (
      <div style={style}>
        <div className={classNames.join(' ')} onClick={this.handleClick}>
          <div className='player-draft__item-action'>
            <PlayerWatchlistAction pid={pid} />
          </div>
          <div className='player-draft__item-index'>{index + 1}.</div>
          <div className='player-draft__item-name'>
            <span>{player_map.get('pname')}</span>
            <NFLTeam team={player_map.get('team')} />
          </div>
          <div className='player-draft__item-metric'>
            {value
              ? `$${Math.round(player_map.getIn(['market_salary', '0']))}`
              : null}
          </div>
        </div>
      </div>
    )
  }
}

DraftPlayer.propTypes = {
  select: PropTypes.func,
  player_map: ImmutablePropTypes.map,
  selected: PropTypes.string,
  is_player_drafted: PropTypes.bool,
  index: PropTypes.number,
  watchlist: ImmutablePropTypes.set,
  style: PropTypes.object
}
