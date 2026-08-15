/* global fetch */
import React from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

import PageLayout from '@layouts/page'
import { API_URL } from '@core/constants'

import {
  contact_fields,
  honeypot_field_name,
  intro,
  questions,
  seat_field
} from './waitlist-content'

import './waitlist.styl'

// The vetting questionnaire. Public, anonymous, and the one place a prospective
// manager can act on the landing page's pitch.
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
const submit_url = `${API_URL}/waitlist`

const Field = ({ field, value, on_change, multiline }) => (
  <label className='waitlist__field' htmlFor={field.name}>
    <span className='waitlist__label'>
      {field.label}
      {field.required === false && (
        <span className='waitlist__optional'> (optional)</span>
      )}
    </span>
    {field.help && <span className='waitlist__help'>{field.help}</span>}
    {multiline ? (
      <textarea
        id={field.name}
        name={field.name}
        className='waitlist__input waitlist__input--multiline'
        rows={4}
        value={value}
        onChange={on_change}
        required={field.required !== false}
      />
    ) : (
      <input
        id={field.name}
        name={field.name}
        type={field.type || 'text'}
        className='waitlist__input'
        value={value}
        onChange={on_change}
        required={field.required !== false}
      />
    )}
  </label>
)

Field.propTypes = {
  field: PropTypes.object,
  value: PropTypes.string,
  on_change: PropTypes.func,
  multiline: PropTypes.bool
}

export default function WaitlistPage() {
  const [values, set_values] = React.useState({})
  const [is_submitting, set_is_submitting] = React.useState(false)
  const [is_submitted, set_is_submitted] = React.useState(false)
  const [error_message, set_error_message] = React.useState(null)

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      })

      if (!response.ok) {
        // 429 is the rate limiter and is worth naming, because a candidate who
        // hits it after a failed first attempt would otherwise read the generic
        // message as the form being broken.
        throw new Error(
          response.status === 429
            ? 'That is several submissions from your connection today. Email the commissioner instead and we will sort it out.'
            : 'Something went wrong sending that. Please try again.'
        )
      }

      set_is_submitted(true)
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_is_submitting(false)
    }
  }

  let body

  if (is_submitted) {
    body = (
      <div className='waitlist'>
        <h1 className='waitlist__title'>Thank you</h1>
        <p>
          That is everything we need. The current managers read the answers and
          vote, so a reply takes days rather than hours — you will hear back
          either way.
        </p>
        <p>
          <NavLink to='/leagues/1'>Look at the league</NavLink> in the meantime.
        </p>
      </div>
    )
  } else {
    body = (
      <div className='waitlist'>
        <h1 className='waitlist__title'>Join the waitlist</h1>
        {intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        <form className='waitlist__form' onSubmit={handle_submit}>
          {contact_fields.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name] || ''}
              on_change={handle_change}
            />
          ))}

          {questions.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={values[field.name] || ''}
              on_change={handle_change}
              multiline
            />
          ))}

          <Field
            field={seat_field}
            value={values[seat_field.name] || ''}
            on_change={handle_change}
          />

          {/* Hidden from people, visible to form-filling bots. Positioned off
              screen rather than `display: none`, which some bots skip. */}
          <input
            className='waitlist__honeypot'
            type='text'
            name={honeypot_field_name}
            tabIndex={-1}
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
            {is_submitting ? 'Sending' : 'Send it'}
          </button>
        </form>
      </div>
    )
  }

  return <PageLayout body={body} scroll />
}
