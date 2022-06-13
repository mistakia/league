import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import IconButton from '@material-ui/core/IconButton'
import PersonAddIcon from '@material-ui/icons/PersonAdd'
import Tooltip from '@material-ui/core/Tooltip'

import PlayerName from '@components/player-name'
import PlayerWatchlistAction from '@components/player-watchlist-action'

import './auction-player.styl'

export default class AuctionPlayer extends React.Component {
  handleClick = () => {
    if (!this.props.isFreeAgent) {
      return
    }

    if (this.props.nominated_pid) {
      return
    }

    this.props.select(this.props.playerMap.get('pid'))
  }

  render = () => {
    const {
      index,
      playerMap,
      isFreeAgent,
      isEligible,
      watchlist,
      style,
      valueType,
      selected,
      nominated_pid
    } = this.props

    const pid = playerMap.get('pid')
    const classNames = ['auction__player']
    if (!isFreeAgent) {
      classNames.push('signed')
    } else if (watchlist.has(pid)) {
      classNames.push('watchlist')
    }

    if (selected === pid || nominated_pid === pid) {
      classNames.push('selected')
    }

    if (!isEligible) {
      classNames.push('ineligible')
    }

    return (
      <div style={style}>
        <div className={classNames.join(' ')} onClick={this.handleClick}>
          <div className='auction__player-action'>
            <PlayerWatchlistAction pid={pid} />
          </div>
          <div className='auction__player-index'>{index + 1}.</div>
          <div className='auction__player-name'>
            <PlayerName pid={pid} />
          </div>
          <div className='auction__player-metric'>
            ${Math.round(playerMap.getIn(['market_salary', valueType])) || '--'}
          </div>
          <div className='auction__player-nominate'>
            <Tooltip title='Nominate'>
              <IconButton size='small' onClick={this.handleClick}>
                <PersonAddIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>
    )
  }
}

AuctionPlayer.propTypes = {
  isFreeAgent: PropTypes.bool,
  nominated_pid: PropTypes.string,
  select: PropTypes.func,
  playerMap: ImmutablePropTypes.map,
  index: PropTypes.number,
  isEligible: PropTypes.bool,
  watchlist: ImmutablePropTypes.set,
  style: PropTypes.object,
  valueType: PropTypes.string,
  selected: PropTypes.string
}
