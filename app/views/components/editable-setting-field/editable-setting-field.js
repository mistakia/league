import React, { useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Grid from '@mui/material/Grid'

import TextField from '@mui/material/TextField'

export default function EditableSettingField({
  data,
  field,
  onchange,
  limit,
  label,
  grid = { xs: 6, sm: 3 },
  default_helper_text = '',
  validation = null
}) {
  const [value, set_value] = useState(data[field])
  const [invalid, set_invalid] = useState(false)
  const [helper_text, set_helper_text] = useState(default_helper_text)

  const validate_value = (value) => {
    if (validation) {
      const { is_valid, error_message } = validation(value)
      set_invalid(!is_valid)
      set_helper_text(is_valid ? default_helper_text : error_message)
      return is_valid
    }

    set_invalid(false)
    set_helper_text(default_helper_text)
    return true
  }

  const handleBlur = (event) => {
    const { value } = event.target
    const defaultValue = data[field]

    if (!value) {
      return set_value(defaultValue)
    }

    if (value !== defaultValue && validate_value(value)) {
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

    validate_value(value)
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

EditableSettingField.propTypes = {
  data: PropTypes.oneOfType([ImmutablePropTypes.record, PropTypes.object]),
  field: PropTypes.string,
  onchange: PropTypes.func,
  limit: PropTypes.number,
  label: PropTypes.string,
  grid: PropTypes.object,
  validation: PropTypes.func,
  default_helper_text: PropTypes.string
}
