import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Link, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'

import Loading from '@components/loading'
import Button from '@components/button'
import PageLayout from '@layouts/page'

import './contributions.styl'

// Named `contributions`, NOT `status`. /status and app/core/status are the
// existing system-status page for data imports and jobs, and they are a
// different thing entirely.

const STATUS_LABELS = {
  received: 'Received',
  awaiting_information: 'Needs your answer',
  accepted: 'Accepted',
  rejected: 'Not planned',
  duplicate: 'Duplicate',
  in_progress: 'In progress',
  shipped: 'Shipped',
  expired: 'Expired'
}

const read_status_label = (submission_status) =>
  STATUS_LABELS[submission_status] || submission_status

// The anonymous submitter's claim token rides in the URL FRAGMENT, which the
// browser never sends to the server -- it stays out of access logs, out of
// Referer headers on any outbound link, and out of the request entirely. The
// page lifts it from there and puts it in the x-contribution-claim-token
// header, which is where the route reads it.
const read_claim_token_from_fragment = () =>
  (typeof window !== 'undefined' && window.location.hash
    ? window.location.hash.slice(1)
    : '') || null

const SubmissionQuestion = ({
  question,
  submission_id,
  claim_token,
  is_answering,
  submit_contribution_answer
}) => {
  const [answer_body, set_answer_body] = useState('')
  const question_id = question.get('question_id')
  const answered_at = question.get('answered_at')

  if (answered_at) {
    return (
      <div className='contributions__question'>
        <div className='contributions__question-text'>
          {question.get('question_text')}
        </div>
        <div className='contributions__answer'>
          {question.get('answer_body')}
        </div>
      </div>
    )
  }

  const expires_at = question.get('expires_at')
  const is_expired = expires_at && dayjs(expires_at).isBefore(dayjs())

  return (
    <div className='contributions__question'>
      <div className='contributions__question-text'>
        {question.get('question_text')}
      </div>
      {is_expired ? (
        <Alert severity='warning'>
          This question expired and the report was closed.
        </Alert>
      ) : (
        <>
          <TextField
            fullWidth
            multiline
            minRows={3}
            margin='normal'
            label='Your answer'
            value={answer_body}
            onChange={(event) => set_answer_body(event.target.value)}
          />
          <Button
            disabled={!answer_body.trim().length || is_answering}
            onClick={() =>
              submit_contribution_answer({
                submission_id,
                question_id,
                answer_body: answer_body.trim(),
                claim_token
              })
            }
          >
            Send answer
          </Button>
        </>
      )}
    </div>
  )
}

SubmissionQuestion.propTypes = {
  question: ImmutablePropTypes.map,
  submission_id: PropTypes.string,
  claim_token: PropTypes.string,
  is_answering: PropTypes.bool,
  submit_contribution_answer: PropTypes.func
}

export default function ContributionsPage({
  contributions,
  is_logged_in,
  load_contributions,
  load_contribution,
  submit_contribution_answer,
  open_contribution_dialog
}) {
  const { submission_id } = useParams()
  const [claim_token] = useState(read_claim_token_from_fragment)

  const is_loading = contributions.get('is_loading')
  const is_answering = contributions.get('is_answering')

  useEffect(() => {
    if (submission_id) {
      load_contribution({ submission_id, claim_token })
    } else if (is_logged_in) {
      load_contributions()
    }
    // `navigate` is deliberately absent and so is anything that changes on an
    // in-page navigation -- an effect keyed on a fresh identity re-fires on
    // every navigation and drops the page back onto its spinner.
  }, [
    submission_id,
    claim_token,
    is_logged_in,
    load_contribution,
    load_contributions
  ])

  //= ==================================
  //  DETAIL
  // -----------------------------------

  if (submission_id) {
    const submission = contributions.getIn(['submission_detail', submission_id])

    if (is_loading && !submission) {
      return <PageLayout body={<Loading loading />} />
    }

    if (!submission) {
      // The route answers 404 for a submission that does not exist AND for one
      // the caller may not read -- deliberately indistinguishable, so this page
      // cannot become an oracle for enumerating other people's reports.
      return (
        <PageLayout
          body={
            <div className='contributions league-container'>
              <Alert severity='error'>
                This report could not be found. If you submitted it without an
                account, it opens only through the link shown once when you
                submitted it.
              </Alert>
            </div>
          }
        />
      )
    }

    const questions = submission.get('questions') || []
    const pull_request_number = submission.get('pull_request_number')

    return (
      <PageLayout
        body={
          <div className='contributions league-container'>
            <div className='contributions__breadcrumb'>
              <Link to='/contributions'>All reports</Link>
            </div>
            <h1 className='contributions__title'>
              {submission.get('submission_title')}
            </h1>
            <div className='contributions__meta'>
              <Chip
                size='small'
                label={read_status_label(submission.get('submission_status'))}
              />
              <span>
                Submitted{' '}
                {dayjs(submission.get('submitted_at')).format('MMM D, YYYY')}
              </span>
              {Boolean(pull_request_number) && (
                <a
                  href={`https://github.com/mistakia/league/pull/${pull_request_number}`}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {`Pull request #${pull_request_number}`}
                </a>
              )}
            </div>

            {Boolean(submission.get('purged_at')) && (
              <Alert severity='info'>
                The content of this report was deleted on request. Its status
                and history are kept.
              </Alert>
            )}

            <div className='contributions__body'>
              {submission.get('submission_body')}
            </div>

            {questions.size > 0 && (
              <div className='contributions__questions'>
                <h2>Questions</h2>
                {questions.map((question, index) => (
                  <SubmissionQuestion
                    key={question.get('question_id') || index}
                    {...{
                      question,
                      submission_id,
                      claim_token,
                      is_answering,
                      submit_contribution_answer
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        }
      />
    )
  }

  //= ==================================
  //  LIST
  // -----------------------------------
  //
  // Scoped to the authenticated author. An anonymous submitter has no account
  // to scope a list to, so their receipt is the claim-token link and this page
  // has nothing to show them.

  if (!is_logged_in) {
    return (
      <PageLayout
        body={
          <div className='contributions league-container'>
            <Alert severity='info'>
              Sign in to see reports filed with your account. A report submitted
              without an account opens only through the link shown once when you
              submitted it.
            </Alert>
            <Button onClick={() => open_contribution_dialog()}>
              Report a problem
            </Button>
          </div>
        }
      />
    )
  }

  if (is_loading) {
    return <PageLayout body={<Loading loading />} />
  }

  const submissions = contributions.get('submissions')

  return (
    <PageLayout
      body={
        <div className='contributions league-container'>
          <h1 className='contributions__title'>My Reports</h1>
          {submissions.size === 0 ? (
            <div className='contributions__empty'>
              <p>You have not filed any reports yet.</p>
              <Button onClick={() => open_contribution_dialog()}>
                Report a problem
              </Button>
            </div>
          ) : (
            <div className='contributions__list'>
              {submissions.map((submission) => (
                <Link
                  key={submission.get('submission_id')}
                  to={`/contributions/${submission.get('submission_id')}`}
                  className='contributions__row'
                >
                  <div className='contributions__row-title'>
                    {submission.get('submission_title')}
                  </div>
                  <div className='contributions__row-meta'>
                    <Chip
                      size='small'
                      label={read_status_label(
                        submission.get('submission_status')
                      )}
                    />
                    <span>
                      {dayjs(submission.get('submitted_at')).format(
                        'MMM D, YYYY'
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      }
    />
  )
}

ContributionsPage.propTypes = {
  contributions: ImmutablePropTypes.map,
  is_logged_in: PropTypes.bool,
  load_contributions: PropTypes.func,
  load_contribution: PropTypes.func,
  submit_contribution_answer: PropTypes.func,
  open_contribution_dialog: PropTypes.func
}
