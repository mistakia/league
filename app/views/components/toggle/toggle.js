import React from 'react'
import PropTypes from 'prop-types'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

export default class Toggle extends React.Component {
  render = () => {
    const { values, selected, onChange } = this.props
    const items = []
    for (const [index, item] of values.entries()) {
      items.push(
        <ToggleButton key={index} value={item.value}>
          {item.label}
        </ToggleButton>
      )
    }
    return (
      <ToggleButtonGroup
        value={selected}
        exclusive
        onChange={onChange}
        size='small'
      >
        {items}
      </ToggleButtonGroup>
    )
  }
}

Toggle.propTypes = {
  onChange: PropTypes.func,
  values: PropTypes.array,
  selected: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
}
