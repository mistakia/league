import React from 'react'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'

export default function ScoreboardSelectWeek({ selectWeek, week, weeks }) {
  if (!week) return null
  if (!weeks.length) return null

  const handleChange = (event) => selectWeek(event.target.value)
  const menuItems = []
  weeks.forEach((week, index) => {
    menuItems.push(
      <MenuItem key={index} value={week}>
        {week}
      </MenuItem>
    )
  })

  return (
    <FormControl
      size='small'
      variant='outlined'
      className='scoreboard__select-week'
    >
      <InputLabel id='scoreboard-select-week'>Week</InputLabel>
      <Select
        labelId='scoreboard-select-week'
        value={week}
        onChange={handleChange}
        label='Week'
      >
        {menuItems}
      </Select>
    </FormControl>
  )
}

ScoreboardSelectWeek.propTypes = {
  selectWeek: PropTypes.func,
  week: PropTypes.number,
  weeks: PropTypes.array
}
