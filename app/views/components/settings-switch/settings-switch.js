import React, { useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Switch from '@mui/material/Switch'

import './settings-switch.styl'

export default function SettingsSwitch({
  field,
  data,
  on_change,
  label,
  description
}) {
  const [checked, set_checked] = useState(Boolean(data[field]))

  const handle_change = (event) => {
    const { checked } = event.target
    set_checked(checked)
    on_change({ type: field, value: checked })
  }

  return (
    <div className='settings__switch'>
      <div className='settings__switch-body'>
        <div className='settings__switch-body-label'>{label}</div>
        <div className='settings__switch-body-description'>{description}</div>
      </div>
      <Switch checked={checked} onChange={handle_change} color='primary' />
    </div>
  )
}

SettingsSwitch.propTypes = {
  data: PropTypes.oneOfType([ImmutablePropTypes.record, PropTypes.object]),
  field: PropTypes.string,
  label: PropTypes.string,
  description: PropTypes.string,
  on_change: PropTypes.func
}
