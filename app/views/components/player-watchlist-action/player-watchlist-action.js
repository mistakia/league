import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Tooltip from '@mui/material/Tooltip'

import Icon from '@components/icon'

import './player-watchlist-action.styl'

export default class PlayerWatchlistAction extends React.Component {
  handleClick = (event) => {
    event.stopPropagation()
    this.props.toggle(this.props.pid)
  }

  render = () => {
    const { watchlist, pid, userId } = this.props
    if (!userId) {
      return null
    }
    const selected = watchlist.has(pid)
    const classNames = ['player__watchlist-action']
    if (selected) classNames.push('selected')
    return (
      <Tooltip title={selected ? 'Remove from watchlist' : 'Add to watchlist'}>
        <div className={classNames.join(' ')} onClick={this.handleClick}>
          {selected ? <Icon name='star-solid' /> : <Icon name='star-outline' />}
        </div>
      </Tooltip>
    )
  }
}

PlayerWatchlistAction.propTypes = {
  toggle: PropTypes.func,
  pid: PropTypes.string,
  watchlist: ImmutablePropTypes.set,
  userId: PropTypes.number
}
