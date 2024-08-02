import React from 'react'
import queryString from 'query-string'
import PropTypes from 'prop-types'
import { useLocation } from 'react-router-dom'
import TextField from '@mui/material/TextField'

import Button from '@components/button'
import Loading from '@components/loading'
import PageLayout from '@layouts/page'

import './auth.styl'

const AuthPageWrapper = (Component) => {
  return function WrappedAuthPage(props) {
    const location = useLocation()
    return <Component location={location} {...props} />
  }
}

const AuthPage = ({ location, login, register, is_pending, auth_error }) => {
  const [menu, set_menu] = React.useState(
    queryString.parse(location.search).leagueId ? 'register' : 'login'
  )
  const [password_error, set_password_error] = React.useState(false)

  const password_ref = React.useRef()
  const password2_ref = React.useRef()

  const handle_submit = (event) => {
    event.preventDefault()
    const { leagueId, teamId } = queryString.parse(location.search)
    const data = {
      password: event.target.password.value,
      leagueId,
      teamId
    }
    if (menu === 'login') {
      data.email_or_username = event.target.email_or_username.value
      login(data)
    } else if (
      password2_ref.current.value &&
      password_ref.current.value === password2_ref.current.value
    ) {
      data.email = event.target.email.value
      data.username = event.target.username.value
      register(data)
    }
  }

  const handle_click = () => {
    set_password_error(false)
    set_menu(menu === 'login' ? 'register' : 'login')
  }

  const handle_change = () => {
    if (menu === 'login') return
    set_password_error(
      password_ref.current.value !== password2_ref.current.value
    )
  }

  if (is_pending) {
    return <Loading loading={is_pending} />
  }

  const { leagueId, teamId } = queryString.parse(location.search)

  const body = (
    <div className='auth'>
      <div className='auth__side' />
      <div className='auth__main'>
        <form id='auth' onSubmit={handle_submit}>
          {auth_error}
          {leagueId && (
            <TextField
              disabled
              label='League Id'
              variant='outlined'
              value={leagueId}
            />
          )}
          {teamId && (
            <TextField
              disabled
              label='Team Id'
              variant='outlined'
              value={teamId}
            />
          )}
          {menu === 'login' ? (
            <TextField
              id='email_or_username'
              label='Email/Username'
              type='text'
              error={Boolean(auth_error)}
              variant='outlined'
            />
          ) : (
            <>
              <TextField
                id='username'
                label='Username'
                type='text'
                error={Boolean(auth_error)}
                variant='outlined'
              />
              <TextField
                id='email'
                label='Email'
                type='email'
                error={Boolean(auth_error)}
                variant='outlined'
                helperText='Used for account recovery (Optional)'
              />
            </>
          )}
          <TextField
            error={Boolean(auth_error || password_error)}
            helperText={password_error && 'Password does not match'}
            id='password'
            label='Password'
            type='password'
            inputRef={password_ref}
            onChange={handle_change}
            variant='outlined'
          />
          {menu === 'register' && (
            <TextField
              error={Boolean(auth_error || password_error)}
              helperText={password_error && 'Password does not match'}
              id='password2'
              label='Confirm Password'
              type='password'
              inputRef={password2_ref}
              onChange={handle_change}
              variant='outlined'
            />
          )}
          <Button type='submit' is_loading={is_pending}>
            {menu}
          </Button>
        </form>
        <Button className='auth__toggle' text onClick={handle_click}>
          {menu === 'register' ? 'login' : 'register'}
        </Button>
      </div>
    </div>
  )

  return <PageLayout body={body} />
}

AuthPage.propTypes = {
  location: PropTypes.object,
  login: PropTypes.func,
  is_pending: PropTypes.bool,
  auth_error: PropTypes.string,
  register: PropTypes.func
}

export default AuthPageWrapper(AuthPage)
