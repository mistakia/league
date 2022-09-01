import React, { useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Switch from '@mui/material/Switch'
import Grid from '@mui/material/Grid'

export default function EditableTeamSwitch({
  team,
  field,
  label,
  description,
  onchange
}) {
  const [checked, set_checked] = useState(Boolean(team[field]))

  const handleChange = (event) => {
    const { checked } = event.target
    set_checked(checked)
    onchange({ field, value: checked ? 1 : 0 })
  }

  return (
    <Grid item xs='12' className='settings__switch'>
      <div className='settings__switch-body'>
        <div className='settings__switch-body-label'>{label}</div>
        <div className='settings__switch-body-description'>{description}</div>
      </div>
      <Switch checked={checked} onChange={handleChange} color='primary' />
    </Grid>
  )
}

EditableTeamSwitch.propTypes = {
  team: ImmutablePropTypes.record,
  field: PropTypes.string,
  onchange: PropTypes.func,
  label: PropTypes.string,
  description: PropTypes.string
}
