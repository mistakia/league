import React from 'react'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'

export default class StandingsSelectYear extends React.Component {
  handleChange = (event) => {
    const year = event.target.value
    this.props.selectYear(year)
  }

  render = () => {
    const selectItems = []
    this.props.league.years.forEach((year, idx) => {
      selectItems.push(
        <MenuItem key={idx} value={year}>
          {year}
        </MenuItem>
      )
    })

    return (
      <FormControl size='small' variant='outlined'>
        <InputLabel id='standings__view-menu-label'>Year</InputLabel>
        <Select
          labelId='standings__view-menu-label'
          value={this.props.year}
          onChange={this.handleChange}
          label='Year'
        >
          {selectItems}
        </Select>
      </FormControl>
    )
  }
}

StandingsSelectYear.propTypes = {
  league: PropTypes.object,
  year: PropTypes.number,
  selectYear: PropTypes.func
}
