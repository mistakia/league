import React from 'react'
import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'

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
        size='small'>
        {items}
      </ToggleButtonGroup>
    )
  }
}
