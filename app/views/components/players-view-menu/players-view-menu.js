import React from 'react'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'

export default class PlayersViewMenu extends React.Component {
  handleChange = (event) => {
    const { value } = event.target
    this.props.update(value)
  }

  render = () => {
    return (
      <FormControl size='small' variant='outlined' className='players__view-menu player__filter'>
        <InputLabel id='players__view-menu-label'>View</InputLabel>
        <Select
          labelId='players__view-menu-label'
          value={this.props.view}
          onChange={this.handleChange}
          label='View'
        >
          <MenuItem value='seasproj'>Season Projection</MenuItem>
          <MenuItem value='stats'>Stats</MenuItem>
          <MenuItem value='ros'>Rest Of Season</MenuItem>
        </Select>
      </FormControl>
    )
  }
}
