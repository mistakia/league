import React from 'react'
import queryString from 'query-string'
import PropTypes from 'prop-types'
import { useLocation, Link } from 'react-router-dom'

import PageLayout from '@layouts/page'

import '../auth/auth.styl'

// The far end of the password reset flow: consumes the token /forgot-password
// emailed and sets a new password.
//
// Typeset in the shared auth vocabulary (../auth/auth.styl); see the note in
// forgot-password.js for why all three auth pages share one stylesheet.
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

  let content

  if (!token) {
    content = (
      <>
        <h1 className='auth__title'>This link is incomplete</h1>
        <p className='auth__deck'>
          The reset link is missing its token, which usually means it was cut
          short by an email client. Request a new one and open it directly.
        </p>
        <div className='auth__footer'>
          <Link to='/forgot-password'>Request a new link</Link>
          <Link to='/login'>Back to sign in</Link>
        </div>
      </>
    )
  } else if (is_password_reset) {
    content = (
      <>
        <h1 className='auth__title'>Password set</h1>
        <p className='auth__deck'>
          Your new password is active. Sign in with it.
        </p>
        <div className='auth__footer'>
          <Link to='/login'>Sign in</Link>
        </div>
      </>
    )
  } else {
    content = (
      <>
        <h1 className='auth__title'>Set a new password</h1>
        <p className='auth__deck'>
          Choose a new password for your account. You will be signed in with it
          from now on.
        </p>
        <form
          className='auth__form'
          id='reset-password'
          onSubmit={handle_submit}
        >
          {auth_error && (
            <div className='auth__error'>
              This reset link is invalid or has expired. Request a new one.
            </div>
          )}
          <label className='auth__field' htmlFor='password'>
            <span className='auth__label'>New password</span>
            <input
              className='auth__input'
              id='password'
              name='password'
              type='password'
              ref={password_ref}
              onChange={handle_change}
              autoComplete='new-password'
              required
            />
          </label>
          <label className='auth__field' htmlFor='password2'>
            <span className='auth__label'>Confirm new password</span>
            <input
              className='auth__input'
              id='password2'
              name='password2'
              type='password'
              ref={password2_ref}
              onChange={handle_change}
              autoComplete='new-password'
              required
            />
          </label>
          {password_error && (
            <div className='auth__error'>The two passwords do not match.</div>
          )}
          <button className='auth__submit' type='submit' disabled={is_updating}>
            {is_updating ? 'Setting password' : 'Set password'}
          </button>
        </form>
        <div className='auth__footer'>
          <Link to='/login'>Back to sign in</Link>
        </div>
      </>
    )
  }

  const body = (
    <div className='auth-surface'>
      <div className='auth'>
        <p className='auth__eyebrow'>Genesis League &middot; xo.football</p>
        {content}
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}

ResetPasswordPage.propTypes = {
  location: PropTypes.object,
  reset_password: PropTypes.func,
  is_updating: PropTypes.bool,
  is_password_reset: PropTypes.bool,
  auth_error: PropTypes.string
}

export default ResetPasswordPageWrapper(ResetPasswordPage)
