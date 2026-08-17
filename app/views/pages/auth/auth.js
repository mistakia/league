import React from 'react'
import queryString from 'query-string'
import PropTypes from 'prop-types'
import { useLocation, Link } from 'react-router-dom'

import Loading from '@components/loading'
import PageLayout from '@layouts/page'

import './auth.styl'

// The sign-in page, typeset in the shared prose language rather than in MUI.
//
// IT IS THE PAGE AFTER THE WAITING LIST. A manager who is admitted reads the
// landing page, then the questionnaire, then this — three pages in a row from
// the same site, so this one carries the same paper, the same measure and the
// same two fonts. It was a pair of default outlined MUI fields floating in the
// middle of the app's grey chrome, with no title saying what the page was.
//
// The controls are native `input` elements calling app/styles/prose-form.styl,
// not `@mui/material/TextField`. That is what makes the type, the focus ring
// and the error colour the same here as on every other prose page; a MUI field
// brings its own type scale, its own floating label and its own focus colour,
// none of which this page can override without fighting emotion specificity.

const AuthPageWrapper = (Component) => {
  return function WrappedAuthPage(props) {
    const location = useLocation()
    return <Component location={location} {...props} />
  }
}

// A field is a block: prompt, then the reason it is being asked, then the box.
// `name` is what makes `event.target.<name>.value` resolve in handle_submit —
// the previous MUI fields were reached by `id`, which also works, but a native
// form wants the name.
const Field = ({
  name,
  label,
  help,
  type = 'text',
  required,
  optional,
  input_ref,
  on_change,
  auto_complete
}) => (
  <label className='auth__field' htmlFor={name}>
    <span className='auth__label'>
      {label}
      {optional && <span className='auth__optional'> (optional)</span>}
    </span>
    {help && <span className='auth__help'>{help}</span>}
    <input
      className='auth__input'
      id={name}
      name={name}
      type={type}
      required={required}
      ref={input_ref}
      onChange={on_change}
      autoComplete={auto_complete}
    />
  </label>
)

Field.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.string,
  type: PropTypes.string,
  required: PropTypes.bool,
  optional: PropTypes.bool,
  input_ref: PropTypes.object,
  on_change: PropTypes.func,
  auto_complete: PropTypes.string
}

const AuthPage = ({
  location,
  login,
  register,
  is_pending,
  is_updating,
  auth_error
}) => {
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
      data.invite_code = event.target.invite_code.value
      register(data)
    }
  }

  // A button rather than the div this used to be: a div with an onClick is not
  // reachable by keyboard and announces nothing, and switching between signing
  // in and registering is the page's second action.
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

  // `is_pending` is the app's initial auth resolution, not this form's submit.
  // It starts true and is cleared by INIT_APP (to `Boolean(token)`, so false
  // for a logged-out visitor) and by AUTH_FULFILLED / AUTH_FAILED, so it
  // cannot latch on and lock a logged-out user out of the login form. The
  // submit button below spins on `is_updating` instead.
  if (is_pending) {
    return <Loading loading={is_pending} />
  }

  const { leagueId, teamId } = queryString.parse(location.search)
  const is_login = menu === 'login'

  // The invitation, stated as a sentence. These arrive in the query string of
  // a link a commissioner sends, and they used to render as two DISABLED MUI
  // text fields labelled `League Id` and `Team Id` — a database column shown
  // to a person, in a control that looks editable and is not. Neither is a
  // form value: handle_submit reads both straight off the query string.
  const invitation = leagueId && (
    <p className='auth__invitation'>
      {teamId
        ? `Invitation to league ${leagueId}, team ${teamId}.`
        : `Invitation to league ${leagueId}.`}
    </p>
  )

  const body = (
    <div className='auth-surface'>
      <div className='auth'>
        <p className='auth__eyebrow'>Genesis League &middot; xo.football</p>
        <h1 className='auth__title'>
          {is_login ? 'Sign in' : 'Create an account'}
        </h1>
        <p className='auth__deck'>
          {is_login
            ? 'If you do not have an account, an invitation is needed, join the discord server.'
            : 'Registration needs an invite code. Contributors and testers can request one on Discord.'}
        </p>

        {invitation}

        <form className='auth__form' id='auth' onSubmit={handle_submit}>
          {auth_error && <div className='auth__error'>{auth_error}</div>}

          {is_login ? (
            <Field
              name='email_or_username'
              label='Email or username'
              auto_complete='username'
              required
            />
          ) : (
            <>
              <Field
                name='invite_code'
                label='Invite code'
                help='Available to contributors and testers. Ask for one on Discord.'
                required
              />
              <Field
                name='username'
                label='Username'
                auto_complete='username'
                required
              />
              <Field
                name='email'
                label='Email'
                type='email'
                help='Used to recover the account if the password is lost.'
                auto_complete='email'
                optional
              />
            </>
          )}

          <Field
            name='password'
            label='Password'
            type='password'
            input_ref={password_ref}
            on_change={handle_change}
            auto_complete={is_login ? 'current-password' : 'new-password'}
            required
          />

          {!is_login && (
            <Field
              name='password2'
              label='Confirm password'
              type='password'
              input_ref={password2_ref}
              on_change={handle_change}
              auto_complete='new-password'
              required
            />
          )}

          {password_error && (
            <div className='auth__error'>The two passwords do not match.</div>
          )}

          <button className='auth__submit' type='submit' disabled={is_updating}>
            {is_updating
              ? is_login
                ? 'Signing in'
                : 'Creating account'
              : is_login
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <div className='auth__footer'>
          <button className='auth__switch' type='button' onClick={handle_click}>
            {is_login ? 'Create an account' : 'Sign in instead'}
          </button>
          {is_login && <Link to='/forgot-password'>Forgot your password?</Link>}
        </div>
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}

AuthPage.propTypes = {
  location: PropTypes.object,
  login: PropTypes.func,
  is_pending: PropTypes.bool,
  is_updating: PropTypes.bool,
  auth_error: PropTypes.string,
  register: PropTypes.func
}

export default AuthPageWrapper(AuthPage)
