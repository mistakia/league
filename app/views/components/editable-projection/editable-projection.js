import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Editable from '@components/editable'

export default class EditableProjection extends React.Component {
  onchange = (value) => {
    this.props.save({
      value,
      week: parseInt(this.props.week, 10),
      userId: this.props.userId,
      type: this.props.type,
      playerId: this.props.player.player
    })
  }

  render = () => {
    const { player, type, week } = this.props

    const value = parseFloat(
      player.projection.getIn([`${week}`, type], 0).toFixed(1)
    )
    const disabled = week !== '0'

    return (
      <Editable
        type='number'
        value={value}
        onchange={this.onchange}
        max={10000}
        disabled={disabled}
      />
    )
  }
}

EditableProjection.propTypes = {
  save: PropTypes.func,
  week: PropTypes.number,
  userId: PropTypes.number,
  type: PropTypes.string,
  player: ImmutablePropTypes.record
}
