import React, { useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'

import TextField from '@mui/material/TextField'

export default function EditableTeamField({
  team,
  field,
  onchange,
  limit,
  label,
  grid = { xs: 6, sm: 3 }
}) {
  const [value, set_value] = useState(team[field])
  const [invalid, set_invalid] = useState(false)
  const [helper_text, set_helper_text] = useState('')

  const handleBlur = (event) => {
    const { value } = event.target
    const defaultValue = team[field]

    if (!value) {
      return set_value(defaultValue)
    }

    if (value !== defaultValue && !invalid) {
      onchange({ field, value })
    }
  }

  const handleChange = (event) => {
    const { value } = event.target
    set_value(value)

    if (limit && value.length > limit) {
      set_invalid(true)
      set_helper_text(`limit: ${limit}`)
      return
    }

    set_invalid(false)
    set_helper_text('')
  }

  return (
    <Grid item container {...grid}>
      <TextField
        label={label}
        value={value}
        onBlur={handleBlur}
        error={invalid}
        helperText={helper_text}
        onChange={handleChange}
        size='small'
        variant='outlined'
        sx={{ flex: 1 }}
      />
    </Grid>
  )
}

EditableTeamField.propTypes = {
  team: ImmutablePropTypes.record,
  field: PropTypes.string,
  onchange: PropTypes.func,
  limit: PropTypes.number,
  label: PropTypes.string,
  grid: PropTypes.object
}
