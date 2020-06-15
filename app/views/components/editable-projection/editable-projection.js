import React from 'react'

import Editable from '@components/editable'

export default class EditableProjection extends React.Component {
  onchange = (value) => {
    // TODO week
    this.props.setProjection({
      value,
      userId: this.props.userId,
      type: this.props.type,
      playerId: this.props.player.player
    })
  }

  render = () => {
    const { player, type } = this.props

    const value = Math.round(player.projection[type]) || 0

    return (
      <Editable value={value} onchange={this.onchange} />
    )
  }
}
