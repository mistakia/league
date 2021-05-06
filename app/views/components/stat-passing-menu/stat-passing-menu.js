import React from 'react'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'

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
        className='stat__passing-view-menu player__filter'>
        <InputLabel id='stat__passing-view-menu-label'>Passing</InputLabel>
        <Select
          labelId='stat__passing-view-menu-label'
          value={this.props.passing}
          onChange={this.handleChange}
          label='Passing'>
          <MenuItem value='advanced'>Advanced</MenuItem>
          <MenuItem value='pressure'>Pressure</MenuItem>
        </Select>
      </FormControl>
    )
  }
}
