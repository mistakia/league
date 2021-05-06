import React from 'react'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'

import './editable-baseline.styl'

export default class EditableBaseline extends React.Component {
  constructor(props) {
    super(props)

    const { position, baselines, vbaseline } = this.props
    const baseline = baselines[position]
    this.state = { value: baseline[vbaseline] || '' }
  }

  static getDerivedStateFromProps(props, state) {
    const { position, baselines, vbaseline } = props
    const baseline = baselines[position]
    return { value: baseline[vbaseline] || '' }
  }

  handleChange = (event) => {
    const { value } = event.target
    const { position } = this.props
    this.props.update({ position, value })
    this.setState({ value })
  }

  render = () => {
    const { players } = this.props

    const menuItems = []
    for (const [index, player] of players.entries()) {
      menuItems.push(
        <MenuItem key={player.player} value={player.player}>
          {index + 1}. {player.fname} {player.lname} (
          {Math.round(player.getIn(['points', '0', 'total']))} pts)
        </MenuItem>
      )
    }

    return (
      <div className='editable__baseline'>
        <FormControl
          size='small'
          variant='outlined'
          className='editable__baseline-select'>
          <InputLabel id='baseline-label'>{`${this.props.position} Baseline`}</InputLabel>
          <Select
            labelId='baseline-label'
            value={this.state.value}
            onChange={this.handleChange}
            label={`${this.props.position} Baseline`}>
            {menuItems}
          </Select>
        </FormControl>
      </div>
    )
  }
}
