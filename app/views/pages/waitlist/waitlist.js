/* global fetch */
import React from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

import PageLayout from '@layouts/page'
import { API_URL } from '@core/constants'
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
const submit_url = `${API_URL}/waitlist`

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

export default function WaitlistPage() {
  const [values, set_values] = React.useState({})
  const [has_affirmed, set_has_affirmed] = React.useState(false)
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
        // The affirmation is sent as a real boolean because the API checks it
        // with `!== true` — a checkbox serialized as a string would be refused.
        body: JSON.stringify({
          ...values,
          has_affirmed_commitment: has_affirmed
        })
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

        {/* Two sections, in this order on purpose: what the league requires
            comes before what it hopes for, so a reader who is out on the
            commitment never has to read the pitch. */}
        <section className='waitlist__intro-section'>
          <h2 className='waitlist__intro-title'>What you are signing up for</h2>
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
