/* global fetch */
import React from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'

import PageLayout from '@layouts/page'
import { get_app } from '@core/selectors'
import { API_URL } from '@core/constants'

import {
  contact_fields,
  questions
} from '@libs-shared/manager-waitlist-questions.mjs'

import './waitlist-submissions.styl'

// What the league's managers read before the Article IV waiting-list ranking
// vote. Restricted to managers of the league by GET /api/waitlist-submissions,
// which mounts below the blanket auth guard.
//
// ONE CANDIDATE PER CARD, EVERY ANSWER SHOWN. This is not a data view and must
// not become one: the vote is a judgement about people, and a sortable table of
// truncated cells is the shape that makes ten paragraphs of prose unreadable.
// There are a handful of candidates, so the whole set fits on one page.
//
// It reads its prompts from the questionnaire's own definition, so a question
// reworded on the form cannot drift from the label it is read under.
//
// Answers live in the `responses` jsonb keyed by question id, so a submission
// recorded under an EARLIER question set simply has no key for a question added
// since -- which renders as an absent block rather than as an error. That is
// the intended behaviour and the reason `questionnaire_version` is shown.
const seat_field = contact_fields.find(
  (field) => field.column === 'requested_seat'
)

const Submission = ({ submission }) => (
  <article className='waitlist-submissions__card'>
    <header className='waitlist-submissions__card-header'>
      <h2 className='waitlist-submissions__name'>
        {submission.candidate_name}
      </h2>
      <div className='waitlist-submissions__meta'>
        {dayjs(submission.submitted_at).format('MMM D, YYYY')}
        {' — '}
        {submission.timezone_name}
      </div>
      <div className='waitlist-submissions__meta'>
        <a href={`mailto:${submission.contact_email}`}>
          {submission.contact_email}
        </a>
        {submission.contact_handle && ` — ${submission.contact_handle}`}
      </div>
      {/* The API refuses a submission that does not affirm the commitment, so
          this can only read yes today. It is shown anyway because it is the one
          thing on the card that is a statement of intent rather than an
          opinion, and because a future round that softens the requirement would
          otherwise silently stop displaying it. */}
      <div className='waitlist-submissions__meta'>
        {submission.has_affirmed_commitment
          ? 'Affirmed the commitment'
          : 'DID NOT affirm the commitment'}
      </div>
    </header>

    {submission.requested_seat && (
      <div className='waitlist-submissions__answer'>
        <h3 className='waitlist-submissions__question'>{seat_field.label}</h3>
        <p className='waitlist-submissions__response'>
          {submission.requested_seat}
        </p>
      </div>
    )}

    {questions.map((question) => {
      const answer = submission.responses?.[question.id]
      // An unanswered optional question is rendered as nothing rather than as
      // an empty heading, so a short card reads as short rather than as broken.
      if (!answer) {
        return null
      }
      return (
        <div className='waitlist-submissions__answer' key={question.id}>
          <h3 className='waitlist-submissions__question'>{question.label}</h3>
          <p className='waitlist-submissions__response'>
            {/* A url answer is rendered as a link because it exists to be
                followed -- a Manager reading a card should not have to select
                and paste a video link to watch it. `rel` is set because the
                target is a candidate-supplied address: `noopener` denies it a
                handle on this window, and this page is behind the auth guard,
                so `noreferrer` keeps a member-only url out of its logs. */}
            {question.type === 'url' ? (
              <a href={answer} target='_blank' rel='noopener noreferrer'>
                {answer}
              </a>
            ) : (
              answer
            )}
          </p>
        </div>
      )
    })}
  </article>
)

Submission.propTypes = {
  submission: PropTypes.object
}

export default function WaitlistSubmissionsPage() {
  const { lid } = useParams()
  const app = useSelector(get_app)
  const { token } = app

  const [submissions, set_submissions] = React.useState([])
  const [is_loading, set_is_loading] = React.useState(true)
  const [error_message, set_error_message] = React.useState(null)

  // Keyed on the route's league and on the token, not on mount. A page whose
  // fetch runs once at mount renders the league the app happened to hold when
  // it was first constructed, which is the defect that made the landing page's
  // only call to action open the wrong league.
  React.useEffect(() => {
    if (!token || !lid) {
      return
    }

    let is_current = true
    set_is_loading(true)

    const load = async () => {
      try {
        const response = await fetch(
          `${API_URL}/waitlist-submissions?league_id=${lid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? 'Only this league’s managers can read the applications.'
              : 'Could not load the applications.'
          )
        }
        const data = await response.json()
        if (is_current) {
          set_submissions(data)
          set_error_message(null)
        }
      } catch (error) {
        if (is_current) {
          set_error_message(error.message)
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
  }, [lid, token])

  let content

  if (is_loading) {
    content = <p>Loading.</p>
  } else if (error_message) {
    content = <p className='waitlist-submissions__error'>{error_message}</p>
  } else if (!submissions.length) {
    content = <p>No applications yet.</p>
  } else {
    content = submissions.map((submission) => (
      <Submission key={submission.submission_id} submission={submission} />
    ))
  }

  const body = (
    <div className='waitlist-submissions'>
      <h1 className='waitlist-submissions__title'>Waitlist applications</h1>
      <p className='waitlist-submissions__intro'>
        Everyone who has applied for the open seat, newest first. These feed the
        Article IV waiting list vote — read them, then rank.
      </p>
      {content}
    </div>
  )

  return <PageLayout body={body} scroll />
}
