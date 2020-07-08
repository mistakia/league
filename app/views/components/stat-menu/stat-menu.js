import React from 'react'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'

export default class StatMenu extends React.Component {
  handleChange = (event) => {
    const { value } = event.target
    this.props.update(value)
  }

  render = () => {
    return (
      <FormControl size='small' variant='outlined' className='stat__view-menu player__filter'>
        <InputLabel id='stat__view-menu-label'>Stat</InputLabel>
        <Select
          labelId='stat__view-menu-label'
          value={this.props.view}
          onChange={this.handleChange}
          label='Stat'
        >
          <MenuItem value='passing'>Passing</MenuItem>
          <MenuItem value='rushing'>Rushing</MenuItem>
          <MenuItem value='receiving'>Receiving</MenuItem>
        </Select>
      </FormControl>
    )
  }
}
