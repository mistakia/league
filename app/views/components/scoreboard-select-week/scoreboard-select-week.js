import React from 'react'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'

import { constants } from '@common'

export default class ScoreboardSelectWeek extends React.Component {
  handleChange = (event) => {
    this.props.select(event.target.value)
  }

  render = () => {
    if (!constants.season.week) return null

    const menuItems = []
    for (let wk = constants.season.week; wk > 0; wk--) {
      menuItems.push(
        <MenuItem key={wk} value={wk}>Week {wk}</MenuItem>
      )
    }

    return (
      <FormControl size='small' variant='outlined' className='scoreboard__select-week'>
        <InputLabel id='players__view-menu-label'>Week</InputLabel>
        <Select
          labelId='players__view-menu-label'
          value={this.props.week}
          onChange={this.handleChange}
          label='Week'
        >
          {menuItems}
        </Select>
      </FormControl>
    )
  }
}
