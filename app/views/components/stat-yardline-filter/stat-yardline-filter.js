import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Slider from '@mui/material/Slider'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

import StatFilter from '@components/stat-filter'

export default function StatYardlineFilter({
  yardline_start,
  yardline_end,
  filter_yardline
}) {
  const [value, setValue] = useState([yardline_start, yardline_end])

  const handleChange = (event, newValue) => {
    setValue(newValue)
  }

  const handleApply = () =>
    filter_yardline({ yardline_start: value[0], yardline_end: value[1] })

  const filter_options = {
    label: 'YARDLINE'
  }

  const marks = [
    {
      value: 80,
      label: '80'
    },
    {
      value: 50,
      label: '50'
    },
    {
      value: 20,
      label: '20'
    }
  ]

  const isChanged = value[0] !== yardline_start || value[1] !== yardline_end
  const body = (
    <Box sx={{ width: '100%', minWidth: 200, padding: 2 }}>
      <Typography gutterBottom>Yards from endzone</Typography>
      <Slider
        getAriaLabel={() => 'Yards from endzone range'}
        value={value}
        onChange={handleChange}
        valueLabelDisplay='auto'
        marks={marks}
      />
      {isChanged && (
        <Button variant='contained' size='small' onClick={handleApply}>
          Apply
        </Button>
      )}
    </Box>
  )

  const isAll = yardline_start === 0 && yardline_end === 100
  const selected_label = isAll ? 'ALL' : `${value[0]} yds to ${value[1]} yds`

  return <StatFilter {...{ selected_label, body, ...filter_options }} />
}

StatYardlineFilter.propTypes = {
  yardline_start: PropTypes.number,
  yardline_end: PropTypes.number,
  filter_yardline: PropTypes.func
}
