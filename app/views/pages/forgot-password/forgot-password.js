import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

import PageLayout from '@layouts/page'

import '../auth/auth.styl'

// The entry point of the password reset flow: collects an email or username
// and asks POST /auth/reset-password to send the link that /reset-password
// consumes.
//
// POST /auth/reset-password deliberately answers identically whether or not
// the account exists, so this page must not leak the difference either. It
// renders ONE acknowledgement for every successful request and never reports
// "no such account" — a per-account message here would reopen the user
// enumeration oracle the API closed.
//
// Typeset in the shared auth vocabulary (../auth/auth.styl) rather than in its
// own: this page is reached FROM /login and returns TO it, so a reader crosses
// the seam twice in one sitting and would see the type change under them.
const ForgotPasswordPage = ({
  request_password_reset,
  is_updating,
  is_password_reset_requested,
  auth_error
}) => {
  const email_or_username_ref = React.useRef()

  // `is_password_reset_requested` lives in redux and is only cleared by the
  // next request's PENDING, so it survives navigating away and coming back.
  // Gating on a local submit flag as well is what stops the page rendering the
  // acknowledgement to someone who has not submitted anything and leaving them
  // no form to retry with — and retrying is the expected path here, since the
  // whole point of the page is a user waiting on an email that may not arrive.
  const [is_submitted, set_is_submitted] = React.useState(false)

  const handle_submit = (event) => {
    event.preventDefault()
    set_is_submitted(true)
    request_password_reset({
      email_or_username: email_or_username_ref.current.value
    })
  }

  let content

  if (is_submitted && is_password_reset_requested) {
    content = (
      <>
        <h1 className='auth__title'>Check your email</h1>
        <p className='auth__deck'>
          If an account exists for that email or username, a reset link is on
          its way. The link expires in one hour. If you do not see it within a
          few minutes, check your spam folder.
        </p>
        <div className='auth__footer'>
          <Link to='/login'>Back to sign in</Link>
        </div>
      </>
    )
  } else {
    content = (
      <>
        <h1 className='auth__title'>Reset your password</h1>
        <p className='auth__deck'>
          Enter your email or username and we will send you a link to set a new
          password.
        </p>
        <form
          className='auth__form'
          id='forgot-password'
          onSubmit={handle_submit}
        >
          {auth_error && (
            <div className='auth__error'>
              The reset email could not be sent. Try again in a moment.
            </div>
          )}
          <label className='auth__field' htmlFor='email_or_username'>
            <span className='auth__label'>Email or username</span>
            <input
              className='auth__input'
              id='email_or_username'
              name='email_or_username'
              type='text'
              ref={email_or_username_ref}
              autoComplete='username'
              required
            />
          </label>
          <button className='auth__submit' type='submit' disabled={is_updating}>
            {is_updating ? 'Sending link' : 'Send reset link'}
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

ForgotPasswordPage.propTypes = {
  request_password_reset: PropTypes.func,
  is_updating: PropTypes.bool,
  is_password_reset_requested: PropTypes.bool,
  auth_error: PropTypes.string
}

export default ForgotPasswordPage
