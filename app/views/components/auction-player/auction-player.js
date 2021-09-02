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

    if (this.props.nominatedPlayer) {
      return
    }

    this.props.select(this.props.player.player)
  }

  render = () => {
    const {
      index,
      player,
      isFreeAgent,
      isEligible,
      watchlist,
      style,
      valueType,
      selected,
      nominatedPlayer
    } = this.props

    const classNames = ['auction__player']
    if (!isFreeAgent) {
      classNames.push('signed')
    } else if (watchlist.has(player.player)) {
      classNames.push('watchlist')
    }

    if (selected === player.player || nominatedPlayer === player.player) {
      classNames.push('selected')
    }

    if (!isEligible) {
      classNames.push('ineligible')
    }

    return (
      <div style={style}>
        <div className={classNames.join(' ')} onClick={this.handleClick}>
          <div className='auction__player-action'>
            <PlayerWatchlistAction playerId={player.player} />
          </div>
          <div className='auction__player-index'>{index + 1}.</div>
          <div className='auction__player-name'>
            <PlayerName playerId={player.player} />
          </div>
          <div className='auction__player-metric'>
            ${Math.round(player.getIn(['market_salary', valueType])) || '--'}
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
  nominatedPlayer: PropTypes.string,
  select: PropTypes.func,
  player: ImmutablePropTypes.record,
  index: PropTypes.number,
  isEligible: PropTypes.bool,
  watchlist: ImmutablePropTypes.set,
  style: PropTypes.object,
  valueType: PropTypes.string,
  selected: PropTypes.string
}
