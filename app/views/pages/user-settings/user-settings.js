import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@mui/material/Grid'

import PageLayout from '@layouts/page'
import EditableSettingField from '@components/editable-setting-field'
import UserSettingsNotifications from '@components/user-settings-notifications'

import './user-settings.styl'

const validate_username = (value) => {
  const username_regex = /^[a-zA-Z0-9_]+$/
  const is_valid = username_regex.test(value)
  return {
    is_valid,
    error_message: is_valid
      ? ''
      : "The 'username' field must contain only alphanumeric characters and underscores"
  }
}

const validate_email = (value) => {
  const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const is_valid = email_regex.test(value)
  return {
    is_valid,
    error_message: is_valid ? '' : 'Invalid email address'
  }
}

export default function UserSettingsPage({ user, update }) {
  const handle_change = ({ field, value }) => {
    update({ type: field, value })
  }

  const props = { data: user, on_change: handle_change }

  const body = (
    <div className='league-container'>
      <div className='setting-section'>
        <h2>Account</h2>
        <Grid container spacing={2}>
          <EditableSettingField
            label='Username'
            field='username'
            limit={20}
            grid={{ xs: 8 }}
            validation={validate_username}
            {...props}
          />
          <EditableSettingField
            label='Email'
            field='email'
            limit={20}
            grid={{ xs: 8 }}
            default_helper_text='Used to recover your account'
            validation={validate_email}
            {...props}
          />
        </Grid>
      </div>
      <UserSettingsNotifications />
    </div>
  )

  return <PageLayout body={body} scroll />
}

UserSettingsPage.propTypes = {
  user: ImmutablePropTypes.record,
  update: PropTypes.func
}
