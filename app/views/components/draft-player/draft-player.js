import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import NFLTeam from '@components/nfl-team'
import PlayerWatchlistAction from '@components/player-watchlist-action'

import './draft-player.styl'

export default class DraftPlayer extends React.Component {
  handleClick = () => {
    this.props.select(this.props.playerMap.get('pid'))
  }

  render = () => {
    const { playerMap, selected, isDrafted, index, watchlist, style } =
      this.props

    const pid = playerMap.get('pid')
    const classNames = ['player-draft__item']
    if (selected === pid) {
      classNames.push('selected')
    }

    if (isDrafted) {
      classNames.push('drafted')
    } else if (watchlist.has(pid)) {
      classNames.push('watchlist')
    }

    const value = playerMap.getIn(['market_salary', '0'])

    return (
      <div style={style}>
        <div className={classNames.join(' ')} onClick={this.handleClick}>
          <div className='player-draft__item-action'>
            <PlayerWatchlistAction pid={pid} />
          </div>
          <div className='player-draft__item-index'>{index + 1}.</div>
          <div className='player-draft__item-name'>
            <span>{playerMap.get('pname')}</span>
            <NFLTeam team={playerMap.get('team')} />
          </div>
          <div className='player-draft__item-metric'>
            {value
              ? `$${Math.round(playerMap.getIn(['market_salary', '0']))}`
              : null}
          </div>
        </div>
      </div>
    )
  }
}

DraftPlayer.propTypes = {
  select: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  selected: PropTypes.string,
  isDrafted: PropTypes.bool,
  index: PropTypes.number,
  watchlist: ImmutablePropTypes.set,
  style: PropTypes.object
}
