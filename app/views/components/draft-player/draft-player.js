import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Team from '@components/team'
import PlayerWatchlistAction from '@components/player-watchlist-action'

import './draft-player.styl'

export default class DraftPlayer extends React.Component {
  handleClick = () => {
    this.props.select(this.props.player.player)
  }

  render = () => {
    const {
      player,
      selected,
      isDrafted,
      index,
      vbaseline,
      watchlist,
      style
    } = this.props

    const classNames = ['player-draft__item']
    if (selected === player.player) {
      classNames.push('selected')
    }

    if (isDrafted) {
      classNames.push('drafted')
    } else if (watchlist.has(player.player)) {
      classNames.push('watchlist')
    }

    const value = player.getIn(['values', '0', vbaseline])

    return (
      <div style={style}>
        <div className={classNames.join(' ')} onClick={this.handleClick}>
          <div className='player-draft__item-action'>
            <PlayerWatchlistAction playerId={player.player} />
          </div>
          <div className='player-draft__item-index'>{index + 1}.</div>
          <div className='player-draft__item-name'>
            <span>{player.pname}</span>
            <Team team={player.team} />
          </div>
          <div className='player-draft__item-metric'>
            {value
              ? `$${Math.round(player.getIn(['values', '0', vbaseline]))}`
              : null}
          </div>
        </div>
      </div>
    )
  }
}

DraftPlayer.propTypes = {
  select: PropTypes.func,
  player: ImmutablePropTypes.record,
  selected: PropTypes.string,
  isDrafted: PropTypes.bool,
  index: PropTypes.number,
  vbaseline: PropTypes.string,
  watchlist: ImmutablePropTypes.set,
  style: PropTypes.object
}
