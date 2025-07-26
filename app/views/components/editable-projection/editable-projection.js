import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Editable from '@components/editable'

export default class EditableProjection extends React.Component {
  onchange = (value) => {
    this.props.save({
      value,
      week: Number(this.props.week),
      userId: this.props.userId,
      type: this.props.type,
      pid: this.props.playerMap.get('pid')
    })
  }

  render = () => {
    const { playerMap, type, week } = this.props

    const decimal = week === 'ros' || week === '0' ? 0 : 1
    const value = parseFloat(
      playerMap.getIn(['projection', `${week}`, type], 0).toFixed(decimal)
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
  week: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  userId: PropTypes.number,
  type: PropTypes.string,
  playerMap: ImmutablePropTypes.map
}
