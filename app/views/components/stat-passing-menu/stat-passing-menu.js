import React from 'react'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'

export default class StatPassingMenu extends React.Component {
  handleChange = (event) => {
    const { value } = event.target
    this.props.update(value)
  }

  render = () => {
    return (
      <FormControl
        size='small'
        variant='outlined'
        className='stat__passing-view-menu player__filter'
      >
        <InputLabel id='stat__passing-view-menu-label'>Passing</InputLabel>
        <Select
          labelId='stat__passing-view-menu-label'
          value={this.props.passing}
          onChange={this.handleChange}
          label='Passing'
        >
          <MenuItem value='advanced'>Advanced</MenuItem>
          <MenuItem value='pressure'>Pressure</MenuItem>
        </Select>
      </FormControl>
    )
  }
}

StatPassingMenu.propTypes = {
  update: PropTypes.func,
  passing: PropTypes.string
}
