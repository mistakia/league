import React from 'react'
import queryString from 'query-string'
import PropTypes from 'prop-types'
import { useLocation, Link } from 'react-router-dom'
import TextField from '@mui/material/TextField'

import Button from '@components/button'
import PageLayout from '@layouts/page'

import './reset-password.styl'

const ResetPasswordPageWrapper = (Component) => {
  return function WrappedResetPasswordPage(props) {
    const location = useLocation()
    return <Component location={location} {...props} />
  }
}

const ResetPasswordPage = ({
  location,
  reset_password,
  is_updating,
  is_password_reset,
  auth_error
}) => {
  const { token } = queryString.parse(location.search)

  const [password_error, set_password_error] = React.useState(false)

  const password_ref = React.useRef()
  const password2_ref = React.useRef()

  const handle_submit = (event) => {
    event.preventDefault()

    if (password_ref.current.value !== password2_ref.current.value) {
      set_password_error(true)
      return
    }

    reset_password({ token, password: password_ref.current.value })
  }

  const handle_change = () => {
    set_password_error(
      password_ref.current.value !== password2_ref.current.value
    )
  }

  let body

  if (!token) {
    body = (
      <div className='reset-password'>
        <div className='reset-password__main'>
          <div className='reset-password__message'>
            This password reset link is missing its token. Request a new one
            from the login page.
          </div>
          <Link to='/login'>Back to login</Link>
        </div>
      </div>
    )
  } else if (is_password_reset) {
    body = (
      <div className='reset-password'>
        <div className='reset-password__main'>
          <div className='reset-password__message'>
            Your password has been reset.
          </div>
          <Link to='/login'>Login</Link>
        </div>
      </div>
    )
  } else {
    body = (
      <div className='reset-password'>
        <div className='reset-password__main'>
          <form id='reset-password' onSubmit={handle_submit}>
            {auth_error && (
              <div className='reset-password__error'>
                This reset link is invalid or has expired. Request a new one
                from the login page.
              </div>
            )}
            <TextField
              error={Boolean(auth_error || password_error)}
              id='password'
              label='New Password'
              type='password'
              inputRef={password_ref}
              onChange={handle_change}
              variant='outlined'
              required
            />
            <TextField
              error={Boolean(auth_error || password_error)}
              helperText={password_error && 'Password does not match'}
              id='password2'
              label='Confirm New Password'
              type='password'
              inputRef={password2_ref}
              onChange={handle_change}
              variant='outlined'
              required
            />
            <Button
              type='submit'
              isLoading={is_updating}
              className='reset-password__button'
            >
              Reset Password
            </Button>
          </form>
          <div className='reset-password__toggle'>
            <Link to='/login'>Back to login</Link>
          </div>
        </div>
      </div>
    )
  }

  return <PageLayout body={body} />
}

ResetPasswordPage.propTypes = {
  location: PropTypes.object,
  reset_password: PropTypes.func,
  is_updating: PropTypes.bool,
  is_password_reset: PropTypes.bool,
  auth_error: PropTypes.string
}

export default ResetPasswordPageWrapper(ResetPasswordPage)
