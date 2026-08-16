/* global fetch */
import React from 'react'
import PropTypes from 'prop-types'
import { NavLink, useSearchParams } from 'react-router-dom'

import PageLayout from '@layouts/page'
import { API_URL } from '@core/constants'
import { league_name, site_name } from '@libs-shared/social-sharing.mjs'
import {
  commitment_affirmation_label,
  commitment_terms,
  contact_fields,
  honeypot_field_name,
  questions,
  what_we_look_for
} from '@libs-shared/manager-waitlist-questions.mjs'

import './waitlist.styl'

// The vetting questionnaire. Public, anonymous, and the one place a prospective
// manager can act on the landing page's pitch.
//
// IT OPENS ON THE COMMITMENT, NOT ON A PITCH. The landing page has already made
// the case and already told the reader the group has never taken in a stranger,
// so repeating any of that here costs the one thing this page is short of,
// which is the reader's patience. What it owes them instead is the thing the
// landing page cannot say in passing: exactly what they are signing up for,
// before they spend ten minutes writing.
//
// DELIBERATELY NOT WIRED THROUGH REDUX. Every other write in this app goes
// through app/core/api/service.js plus a domain's actions/reducer/sagas, which
// buys shared error handling and state that survives navigation. Neither is
// worth anything here: the caller is anonymous, submits once, and never reads
// the value back, so the whole apparatus would exist to move one boolean. It
// also carries three documented silent-failure modes -- a dispatch-map typo
// resolving to undefined, a nested `method` dropped by the flat merge in
// api_request, and action types exported without their creators -- none of
// which can fail a build or a test. A plain fetch with local state has none of
// them and is legible in one screen.
//
// EDITING. The same page renders the edit of a past application, reached by the
// `token` in the link the API emails on submit. It is one page rather than two
// because the form IS the application: a separate edit page would restate every
// question, every length cap and every control choice, and the two would drift
// the first time a question changed. What the token changes is where the values
// come from and which verb sends them back.
const submit_url = `${API_URL}/waitlist`
const edit_link_url = `${API_URL}/waitlist/edit-link`
const read_submission_url = (token) =>
  `${API_URL}/waitlist/submission?token=${encodeURIComponent(token)}`

const Field = ({
  name,
  label,
  help,
  type,
  required,
  multiline,
  options,
  value,
  on_change
}) => (
  <label className='waitlist__field' htmlFor={name}>
    <span className='waitlist__label'>
      {label}
      {!required && <span className='waitlist__optional'> (optional)</span>}
    </span>
    {help && <span className='waitlist__help'>{help}</span>}
    {options ? (
      <select
        id={name}
        name={name}
        className='waitlist__input waitlist__input--select'
        value={value}
        onChange={on_change}
        required={required}
      >
        {/* An empty first option so the control opens with nothing chosen.
            Without it the browser preselects the first real range, and a
            required select that is already satisfied collects a default rather
            than an answer. */}
        <option value=''>Pick one</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : multiline ? (
      <textarea
        id={name}
        name={name}
        className='waitlist__input waitlist__input--multiline'
        rows={4}
        value={value}
        onChange={on_change}
        required={required}
      />
    ) : (
      <input
        id={name}
        name={name}
        type={type || 'text'}
        className='waitlist__input'
        value={value}
        onChange={on_change}
        required={required}
      />
    )}
  </label>
)

Field.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
  help: PropTypes.string,
  type: PropTypes.string,
  required: PropTypes.bool,
  multiline: PropTypes.bool,
  options: PropTypes.array,
  value: PropTypes.string,
  on_change: PropTypes.func
}

// The way back for somebody who has applied and lost the link. It asks for the
// address and says nothing about whether one was found, because the API
// deliberately answers the same either way — an "unknown address" message here
// would put the leak back on the page after the route was written to avoid it.
const EditLinkRequest = () => {
  const [contact_email, set_contact_email] = React.useState('')
  const [is_sending, set_is_sending] = React.useState(false)
  const [is_sent, set_is_sent] = React.useState(false)
  const [error_message, set_error_message] = React.useState(null)

  const handle_submit = async (event) => {
    event.preventDefault()
    set_is_sending(true)
    set_error_message(null)

    try {
      const response = await fetch(edit_link_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_email })
      })

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? 'That is several link requests from your connection today. Email the commissioner instead.'
            : 'Something went wrong sending that. Please try again.'
        )
      }

      set_is_sent(true)
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_is_sending(false)
    }
  }

  if (is_sent) {
    return (
      <section className='waitlist__intro-section'>
        <h2 className='waitlist__intro-title'>Already applied?</h2>
        <p>
          If we have an application under that address, the link to it is on its
          way.
        </p>
      </section>
    )
  }

  return (
    <section className='waitlist__intro-section'>
      <h2 className='waitlist__intro-title'>Already applied?</h2>
      <p>
        You can change your answers up until the managers start voting. Give us
        the address you applied with and we will email you the link.
      </p>
      <form className='waitlist__form' onSubmit={handle_submit}>
        <Field
          name='edit_link_contact_email'
          label='Email'
          type='email'
          required
          value={contact_email}
          on_change={(event) => set_contact_email(event.target.value)}
        />
        {error_message && (
          <div className='waitlist__error'>{error_message}</div>
        )}
        <button
          className='waitlist__submit'
          type='submit'
          disabled={is_sending}
        >
          {is_sending ? 'Sending' : 'Email me the link'}
        </button>
      </form>
    </section>
  )
}

// The stored row, as the form's own value map. Contact details are columns and
// answers live under their question id, and a null column becomes an empty
// string because a controlled input given null is an uncontrolled input.
const values_from_submission = (submission) => {
  const values = { ...(submission.responses || {}) }

  for (const field of contact_fields) {
    values[field.column] = submission[field.column] || ''
  }

  return values
}

export default function WaitlistPage() {
  const [search_params] = useSearchParams()
  const token = search_params.get('token')

  const [values, set_values] = React.useState({})
  const [has_affirmed, set_has_affirmed] = React.useState(false)
  const [is_submitting, set_is_submitting] = React.useState(false)
  const [is_submitted, set_is_submitted] = React.useState(false)
  const [is_edit_link_sent, set_is_edit_link_sent] = React.useState(false)
  const [error_message, set_error_message] = React.useState(null)
  const [is_loading, set_is_loading] = React.useState(Boolean(token))
  const [load_error_message, set_load_error_message] = React.useState(null)
  const [is_locked, set_is_locked] = React.useState(false)

  // Keyed on the token rather than on mount, so a candidate who opens a second
  // link in the same tab reads the application that link names.
  React.useEffect(() => {
    if (!token) {
      return
    }

    let is_current = true
    set_is_loading(true)

    const load = async () => {
      try {
        const response = await fetch(read_submission_url(token))

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'That application is closed — the round it belongs to is over.'
              : 'That link does not work any more. Ask for a new one below.'
          )
        }

        const submission = await response.json()

        if (is_current) {
          set_values(values_from_submission(submission))
          set_has_affirmed(Boolean(submission.has_affirmed_commitment))
          set_is_locked(Boolean(submission.is_locked))
          set_load_error_message(null)
        }
      } catch (error) {
        if (is_current) {
          set_load_error_message(error.message)
        }
      } finally {
        if (is_current) {
          set_is_loading(false)
        }
      }
    }

    load()

    return () => {
      is_current = false
    }
  }, [token])

  const handle_change = (event) => {
    const { name, value } = event.target
    set_values((previous) => ({ ...previous, [name]: value }))
  }

  const handle_submit = async (event) => {
    event.preventDefault()
    set_is_submitting(true)
    set_error_message(null)

    try {
      const response = await fetch(submit_url, {
        // PUT with a token REPLACES the named application; POST creates one.
        // The body is otherwise identical, because the API validates an edit
        // exactly as it validates a new submission.
        method: token ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The affirmation is sent as a real boolean because the API checks it
        // with `!== true` — a checkbox serialized as a string would be refused.
        body: JSON.stringify({
          ...values,
          ...(token ? { token } : {}),
          has_affirmed_commitment: has_affirmed
        })
      })

      if (!response.ok) {
        // Each of these is worth naming, because the generic message would
        // otherwise read as the form being broken: 429 is the rate limiter, 409
        // is the vote having started, and 401 is a link that no longer works.
        if (response.status === 409) {
          set_is_locked(true)
        }

        throw new Error(
          response.status === 429
            ? 'That is several attempts from your connection today. Email the commissioner instead and we will sort it out.'
            : response.status === 409
              ? 'The managers have started voting on your application, so it can no longer be changed.'
              : response.status === 401
                ? 'That link does not work any more. Ask for a new one from the waitlist page.'
                : 'Something went wrong sending that. Please try again.'
        )
      }

      // What the thank-you screen says about the emailed link is what the
      // server actually did, not what it intended. The answers are stored
      // either way, so a link that never went out changes the copy rather than
      // the outcome.
      const result = await response.json()
      set_is_edit_link_sent(Boolean(result.is_edit_link_sent))
      set_is_submitted(true)
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_is_submitting(false)
    }
  }

  const is_editing = Boolean(token)

  let body

  if (is_editing && is_loading) {
    body = (
      <div className='waitlist-surface'>
        <div className='waitlist'>
          <p className='waitlist__deck'>Loading your application.</p>
        </div>
      </div>
    )
  } else if (is_editing && load_error_message) {
    body = (
      <div className='waitlist-surface'>
        <div className='waitlist'>
          <p className='waitlist__eyebrow'>
            {league_name} <span aria-hidden='true'>&middot;</span> {site_name}
          </p>
          <h1 className='waitlist__title'>That link did not open</h1>
          <p className='waitlist__deck'>{load_error_message}</p>
          <EditLinkRequest />
        </div>
      </div>
    )
  } else if (is_editing && is_locked) {
    // Read-only rather than a form that would be refused on send. A candidate
    // who has been put on a ballot is past the point where his answers are his
    // to change, and finding that out after rewriting five of them is worse
    // than being told first.
    body = (
      <div className='waitlist-surface'>
        <div className='waitlist'>
          <p className='waitlist__eyebrow'>
            {league_name} <span aria-hidden='true'>&middot;</span> {site_name}
          </p>
          <h1 className='waitlist__title'>
            Your application is with the managers
          </h1>
          <p className='waitlist__deck'>
            They are voting on it as it stands, so it can no longer be changed.
            If something in it is wrong, email the commissioner and he will sort
            it out.
          </p>
          <p>
            <NavLink to='/leagues/1'>Look at the league</NavLink> in the
            meantime.
          </p>
        </div>
      </div>
    )
  } else if (is_submitted) {
    body = (
      <div className='waitlist-surface'>
        <div className='waitlist'>
          <p className='waitlist__eyebrow'>
            {league_name} <span aria-hidden='true'>&middot;</span> {site_name}
          </p>
          <h1 className='waitlist__title'>
            {is_editing ? 'Saved' : 'Thank you'}
          </h1>
          <p className='waitlist__deck'>
            {is_editing
              ? 'The managers will read this version. You can come back to the same link and change it again until they start voting.'
              : 'That is everything we need. The current managers read the answers and vote, so a reply takes days rather than hours — you will hear back either way.'}
          </p>
          {!is_editing &&
            (is_edit_link_sent ? (
              <p>
                We have emailed {values.contact_email} a link back to your
                answers — keep it, and use it if you want to change anything
                before the managers vote.
              </p>
            ) : (
              // Said plainly rather than dressed up: the answers are safe and
              // the link is not coming, so the one useful thing is what to do
              // instead. Promising mail that the server knows it failed to send
              // costs the candidate the wait plus the route back.
              <p>
                We could not email you the link back to your answers just now.
                Your application is saved — ask for the link again from the
                waitlist page in a while, or email the commissioner.
              </p>
            ))}
          <p>
            <NavLink to='/leagues/1'>Look at the league</NavLink> in the
            meantime.
          </p>
        </div>
      </div>
    )
  } else {
    body = (
      <div className='waitlist-surface'>
        <div className='waitlist'>
          <p className='waitlist__eyebrow'>
            {league_name} <span aria-hidden='true'>&middot;</span> {site_name}
          </p>
          <h1 className='waitlist__title'>
            {is_editing ? 'Your application' : 'Join the waitlist'}
          </h1>
          <p className='waitlist__deck'>
            {is_editing
              ? 'Change whatever you want and send it again. What you save here is what the managers read.'
              : 'The current managers read every answer and vote on it. Allow about ten minutes, and read the two sections below before you begin.'}
          </p>

          {/* Two sections, in this order on purpose: what the league requires
              comes before what it hopes for, so a reader who is out on the
              commitment never has to read the pitch. */}
          <section className='waitlist__intro-section'>
            <h2 className='waitlist__intro-title'>
              What you are signing up for
            </h2>
            {commitment_terms.map((term) => (
              <p key={term}>{term}</p>
            ))}
          </section>

          <section className='waitlist__intro-section'>
            <h2 className='waitlist__intro-title'>What we are looking for</h2>
            {what_we_look_for.map((quality) => (
              <p key={quality}>{quality}</p>
            ))}
          </section>

          <form className='waitlist__form' onSubmit={handle_submit}>
            <label
              className='waitlist__affirmation'
              htmlFor='has_affirmed_commitment'
            >
              <input
                id='has_affirmed_commitment'
                name='has_affirmed_commitment'
                type='checkbox'
                checked={has_affirmed}
                onChange={(event) => set_has_affirmed(event.target.checked)}
                required
              />
              <span>{commitment_affirmation_label}</span>
            </label>

            {contact_fields.map((field) => (
              <Field
                key={field.column}
                name={field.column}
                label={field.label}
                help={field.help}
                type={field.type}
                required={Boolean(field.required)}
                value={values[field.column] || ''}
                on_change={handle_change}
              />
            ))}

            {questions.map((question) => (
              <Field
                key={question.id}
                name={question.id}
                label={question.label}
                help={question.help}
                required={Boolean(question.required)}
                options={question.options}
                type={question.type}
                // A textarea is the default because most questions here want
                // paragraphs, but a question carrying an explicit `type` is
                // asking for a one-line control of that type -- a url in a
                // four-row box invites a paragraph nobody wants to write.
                multiline={!question.options && !question.type}
                value={values[question.id] || ''}
                on_change={handle_change}
              />
            ))}

            {/* Hidden from people, visible to form-filling bots. Positioned off
                screen rather than `display: none`, which some bots skip --
                which also means a password manager can reach it, and answering
                it silently discards the application. `aria-hidden` keeps it away
                from assistive technology and from the autofill heuristics that
                read a field's accessible name. */}
            <input
              className='waitlist__honeypot'
              type='text'
              name={honeypot_field_name}
              tabIndex={-1}
              aria-hidden='true'
              autoComplete='off'
              value={values[honeypot_field_name] || ''}
              onChange={handle_change}
            />

            {error_message && (
              <div className='waitlist__error'>{error_message}</div>
            )}

            <button
              className='waitlist__submit'
              type='submit'
              disabled={is_submitting}
            >
              {is_submitting
                ? 'Sending'
                : is_editing
                  ? 'Save changes'
                  : 'Send it'}
            </button>
          </form>

          {/* Only on the blank form. Somebody who arrived on a working link is
              already holding the thing this section hands out. */}
          {!is_editing && <EditLinkRequest />}
        </div>
      </div>
    )
  }

  return <PageLayout body={body} scroll />
}
