import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

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
      <div className={classNames.join(' ')} onClick={this.handleClick}>
        {selected ? <Icon name='star-solid' /> : <Icon name='star-outline' />}
      </div>
    )
  }
}

PlayerWatchlistAction.propTypes = {
  toggle: PropTypes.func,
  pid: PropTypes.string,
  watchlist: ImmutablePropTypes.set,
  userId: PropTypes.number
}
