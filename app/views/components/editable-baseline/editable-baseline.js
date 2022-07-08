import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'

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
    for (const [index, playerMap] of players.entries()) {
      const pid = playerMap.get('pid')
      menuItems.push(
        <MenuItem key={pid} value={pid}>
          {index + 1}. {playerMap.get('fname')} {playerMap.get('lname')} (
          {Math.round(playerMap.getIn(['points', '0', 'total']))} pts)
        </MenuItem>
      )
    }

    return (
      <div className='editable__baseline'>
        <FormControl
          size='small'
          variant='outlined'
          className='editable__baseline-select'
        >
          <InputLabel id='baseline-label'>{`${this.props.position} Baseline`}</InputLabel>
          <Select
            labelId='baseline-label'
            value={this.state.value}
            onChange={this.handleChange}
            label={`${this.props.position} Baseline`}
          >
            {menuItems}
          </Select>
        </FormControl>
      </div>
    )
  }
}

EditableBaseline.propTypes = {
  position: PropTypes.string,
  baselines: PropTypes.object,
  vbaseline: PropTypes.string,
  update: PropTypes.func,
  players: ImmutablePropTypes.map
}
