import React from 'react'

import Icon from '@components/icon'

export default class PlayerWatchlistAction extends React.Component {
  handleClick = (event) => {
    event.stopPropagation()
    this.props.toggle(this.props.playerId)
  }

  render = () => {
    const { watchlist, playerId } = this.props
    console.log(watchlist.toArray())
    console.log(playerId)
    console.log(watchlist.has(playerId))
    const selected = watchlist.has(playerId)
    const classNames = ['player__watchlist-action']
    if (selected) classNames.push('selected')
    return (
      <div className={classNames.join(' ')} onClick={this.handleClick}>
        {selected ? <Icon name='star-solid' /> : <Icon name='star-outline' />}
      </div>
    )
  }
}
