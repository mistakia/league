import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import TextField from '@mui/material/TextField'

import Button from '@components/button'
import PageLayout from '@layouts/page'

import './forgot-password.styl'

// The entry point of the password reset flow: collects an email or username
// and asks POST /auth/reset-password to send the link that /reset-password
// consumes.
//
// POST /auth/reset-password deliberately answers identically whether or not
// the account exists, so this page must not leak the difference either. It
// renders ONE acknowledgement for every successful request and never reports
// "no such account" — a per-account message here would reopen the user
// enumeration oracle the API closed.
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

  let body

  if (is_submitted && is_password_reset_requested) {
    body = (
      <div className='forgot-password'>
        <div className='forgot-password__main'>
          <div className='forgot-password__message'>
            If an account exists, a password reset email has been sent. The link
            expires in one hour.
          </div>
          <Link to='/login'>Back to login</Link>
        </div>
      </div>
    )
  } else {
    body = (
      <div className='forgot-password'>
        <div className='forgot-password__main'>
          <form id='forgot-password' onSubmit={handle_submit}>
            <div className='forgot-password__message'>
              Enter your email or username and we will send you a link to reset
              your password.
            </div>
            {auth_error && (
              <div className='forgot-password__error'>
                Something went wrong sending the reset email. Please try again.
              </div>
            )}
            <TextField
              error={Boolean(auth_error)}
              id='email_or_username'
              label='Email/Username'
              type='text'
              inputRef={email_or_username_ref}
              variant='outlined'
              required
            />
            <Button
              type='submit'
              isLoading={is_updating}
              className='forgot-password__button'
            >
              Send Reset Link
            </Button>
          </form>
          <div className='forgot-password__toggle'>
            <Link to='/login'>Back to login</Link>
          </div>
        </div>
      </div>
    )
  }

  return <PageLayout body={body} />
}

ForgotPasswordPage.propTypes = {
  request_password_reset: PropTypes.func,
  is_updating: PropTypes.bool,
  is_password_reset_requested: PropTypes.bool,
  auth_error: PropTypes.string
}

export default ForgotPasswordPage
