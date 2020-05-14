import React from 'react'

class Player extends React.Component {
  render () {
    const { player, style } = this.props

    return (
      <article style={style}>
        <div>{player.pname}</div>
      </article>
    )
  }
}

export default Player
