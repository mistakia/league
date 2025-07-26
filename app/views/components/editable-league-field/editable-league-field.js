import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'

import TextField from '@mui/material/TextField'

export default function EditableLeagueField({
  type,
  league,
  field,
  length,
  max,
  min,
  onchange,
  isCommish,
  isDefault,
  label,
  grid = { xs: 6, sm: 3 },
  disabled
}) {
  const initialValue = league[field] === null ? '' : league[field]
  const [value, set_value] = useState(initialValue)
  const [helper_text, set_helper_text] = useState('')
  const [error, set_error] = useState(false)

  const handleBlur = (event) => {
    let { value } = event.target
    let defaultValue = league[field] === null ? '' : league[field]

    if (!value) {
      return set_value(defaultValue)
    }

    if (type === 'int') {
      if (isNaN(value) || value % 1 !== 0) {
        set_helper_text('not a number')
        set_error(true)
        return set_value(defaultValue)
      }

      value = Number(value)
      defaultValue = Number(defaultValue)
    } else if (type === 'float') {
      if (isNaN(value)) {
        set_helper_text('not a number')
        set_error(true)
        return set_value(defaultValue)
      }

      value = parseFloat(value)
      defaultValue = parseFloat(defaultValue)
    }

    if (value !== defaultValue && !error) {
      onchange({ value, field })
    }
  }

  const handleChange = (event) => {
    const { value } = event.target
    set_value(value)

    if (length && value.length > length) {
      set_helper_text('too long')
      set_error(true)
      return
    }

    if (typeof max !== 'undefined' && value > max) {
      set_helper_text(`Max: ${max}`)
      set_error(true)
      return
    }

    if (typeof min !== 'undefined' && value < min) {
      set_helper_text(`Min: ${min}`)
      set_error(true)
      return
    }

    set_helper_text('')
    set_error(false)
  }

  return (
    <Grid item container {...grid}>
      <TextField
        disabled={(!isCommish && !isDefault) || disabled}
        label={label}
        helperText={helper_text}
        error={error}
        value={value}
        onBlur={handleBlur}
        onChange={handleChange}
        size='small'
        variant='outlined'
        sx={{ flex: 1 }}
      />
    </Grid>
  )
}

EditableLeagueField.propTypes = {
  disabled: PropTypes.bool,
  league: PropTypes.object,
  field: PropTypes.string,
  type: PropTypes.string,
  onchange: PropTypes.func,
  length: PropTypes.number,
  max: PropTypes.number,
  min: PropTypes.number,
  isCommish: PropTypes.bool,
  isDefault: PropTypes.bool,
  label: PropTypes.string,
  grid: PropTypes.object
}
