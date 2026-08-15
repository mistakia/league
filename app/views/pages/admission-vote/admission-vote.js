/* global fetch */
import React from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { useParams, NavLink } from 'react-router-dom'
import dayjs from 'dayjs'

import PageLayout from '@layouts/page'
import { get_app } from '@core/selectors'
import { API_URL } from '@core/constants'
import {
  admission_vote_statuses,
  admission_vote_outcomes
} from '@libs-shared/constants/admission-vote-constants.mjs'

import './admission-vote.styl'

// The Amendment XLIII Admission Vote, as a Manager sees it: the Notice, his
// own confidential ranked ballot while the vote is open, and the per-Candidate
// point totals once it has closed.
//
// ONE PAGE FOR BOTH HALVES, because they are the same subject at two moments
// and a Manager arriving after the close should not have to know that the page
// he ranked on is not the page the totals are on.
//
// NOTHING RENDERS ANOTHER TEAM'S BALLOT. His own is rendered, and the form is
// seeded from it, so replacing a ballot is an edit rather than a re-entry.
// Section 10(e) forbids disclosing how a Team voted to OTHERS and says nothing
// about a Manager reading his own; the absolute reading held until 2026-08-15
// and was a design property rather than a constitutional requirement. The API
// enforces the half that matters -- it keys the returned ranking on the
// caller's own team -- so this page could not reach another Team's ballot even
// if it tried.
//
// NO REACTIONS AND NO COMMENTS on the Candidate panels. A visible opinion on a
// named person's application recreates exactly the public verdict the
// confidentiality provision exists to prevent.
//
// DELIBERATELY NOT WIRED THROUGH REDUX, for the reasons the waitlist page
// records: the state is one vote read on mount and one write, and the redux
// path's three documented silent-failure modes all cost more than they buy.

const format_moment = (value) =>
  value ? dayjs(value).format('MMM D, YYYY h:mm A') : null

const Candidate = ({ candidate }) => (
  <article className='admission-vote__candidate'>
    <h3 className='admission-vote__candidate-name'>
      {candidate.candidate_name}
    </h3>
    <div className='admission-vote__candidate-meta'>
      {candidate.sponsors.length
        ? `Sponsored by ${candidate.sponsors
            .map((sponsor) => sponsor.team_name || `Team ${sponsor.team_id}`)
            .join(', ')}`
        : 'No sponsor recorded'}
    </div>
    {/* The waitlist is the pool Candidates are drawn from, never a nomination
        channel, so a Candidate named on the Boards with no application on file
        is ordinary. Saying so explicitly beats an empty panel, which reads as
        a page that failed to load. */}
    {candidate.submission_id ? (
      <div className='admission-vote__candidate-meta'>
        <NavLink to='../waitlist-submissions' relative='path'>
          Read his application
        </NavLink>
      </div>
    ) : (
      <div className='admission-vote__candidate-meta'>
        Nominated directly. No application on file.
      </div>
    )}
  </article>
)

Candidate.propTypes = {
  candidate: PropTypes.object
}

const Totals = ({ totals }) => (
  <table className='admission-vote__totals'>
    <thead>
      <tr>
        <th>Candidate</th>
        <th>Points</th>
      </tr>
    </thead>
    <tbody>
      {totals.map((row) => (
        <tr key={row.admission_vote_candidate_id}>
          <td>{row.candidate_name}</td>
          <td>{row.points_total}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

Totals.propTypes = {
  totals: PropTypes.array
}

const Decision = ({ vote, totals }) => {
  if (vote.decision_outcome === admission_vote_outcomes.ADMITTED) {
    const admitted = totals.find(
      (row) =>
        row.admission_vote_candidate_id ===
        vote.decided_admission_vote_candidate_id
    )
    return (
      <p className='admission-vote__decision'>
        {admitted ? admitted.candidate_name : 'A candidate'} was admitted on{' '}
        {format_moment(vote.decided_at)}.
      </p>
    )
  }

  if (vote.decision_outcome === admission_vote_outcomes.PASSED) {
    return (
      <p className='admission-vote__decision'>
        The commissioner passed on {format_moment(vote.decided_at)}:{' '}
        {vote.decision_reason}
      </p>
    )
  }

  // Section 11(a): where he neither admits nor passes within seven days he is
  // deemed to have passed. Derived from the absence of a decision rather than
  // written by anything, which is why it renders from a flag the server
  // computes rather than from an outcome value.
  if (vote.is_deemed_passed) {
    return (
      <p className='admission-vote__decision'>
        The commissioner did not decide by {format_moment(vote.decision_due_at)}{' '}
        and is deemed to have passed. Nominations reopen.
      </p>
    )
  }

  return (
    <p className='admission-vote__decision'>
      The commissioner has until {format_moment(vote.decision_due_at)} to admit
      the highest ranked candidate or pass.
    </p>
  )
}

Decision.propTypes = {
  vote: PropTypes.object,
  totals: PropTypes.array
}

const Ballot = ({ vote, candidates, on_submit, is_submitting, viewer }) => {
  // Seeded from his own ranking, so replacing a ballot is an edit rather than a
  // re-entry. Keyed on the ranking itself: the page reloads the vote after a
  // submit, and without the key the slots would keep the pre-submit state.
  const [slots, set_slots] = React.useState(() =>
    Array.from(
      { length: vote.maximum_ranked_candidates },
      (unused, index) => viewer.ranked_candidate_ids[index] ?? ''
    )
  )

  const set_slot = (index, value) =>
    set_slots((current) =>
      current.map((slot, slot_index) => (slot_index === index ? value : slot))
    )

  const ranked_candidate_ids = slots
    .filter(Boolean)
    .map((value) => Number(value))

  const has_duplicate =
    new Set(ranked_candidate_ids).size !== ranked_candidate_ids.length

  return (
    <form
      className='admission-vote__ballot'
      onSubmit={(event) => {
        event.preventDefault()
        on_submit(ranked_candidate_ids)
      }}
    >
      <p className='admission-vote__ballot-intro'>
        Rank up to {vote.maximum_ranked_candidates} candidate
        {vote.maximum_ranked_candidates === 1 ? '' : 's'}. Your first choice
        scores {vote.maximum_ranked_candidates}, your second one fewer, and so
        on. Ranking fewer does not weaken your first choice.
        {viewer.has_submitted_ballot &&
          ' Your ballot is shown below as you submitted it. Changing it and submitting replaces it entirely, as often as you like while the vote is open.'}
      </p>

      {slots.map((value, index) => (
        <label className='admission-vote__slot' key={index}>
          <span className='admission-vote__slot-label'>
            Preference {index + 1}
          </span>
          <select
            value={value}
            onChange={(event) => set_slot(index, event.target.value)}
          >
            <option value=''>— none —</option>
            {candidates.map((candidate) => (
              <option
                key={candidate.admission_vote_candidate_id}
                value={candidate.admission_vote_candidate_id}
              >
                {candidate.candidate_name}
              </option>
            ))}
          </select>
        </label>
      ))}

      {has_duplicate && (
        <p className='admission-vote__error'>
          A candidate may appear only once in a ranking.
        </p>
      )}

      <button
        type='submit'
        disabled={
          is_submitting || has_duplicate || !ranked_candidate_ids.length
        }
      >
        {viewer.has_submitted_ballot ? 'Replace my ballot' : 'Submit my ballot'}
      </button>
    </form>
  )
}

Ballot.propTypes = {
  vote: PropTypes.object,
  candidates: PropTypes.array,
  on_submit: PropTypes.func,
  is_submitting: PropTypes.bool,
  viewer: PropTypes.object
}

export default function AdmissionVotePage() {
  const { lid } = useParams()
  const app = useSelector(get_app)
  const { token } = app

  const [state, set_state] = React.useState(null)
  const [is_loading, set_is_loading] = React.useState(true)
  const [is_submitting, set_is_submitting] = React.useState(false)
  const [error_message, set_error_message] = React.useState(null)
  const [notice, set_notice] = React.useState(null)

  // Keyed on the route's league and on the token, not on mount, so the page
  // renders the league in the URL rather than whichever one the app happened to
  // hold when it was first constructed.
  const load = React.useCallback(async () => {
    if (!token || !lid) {
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/admission-votes?league_id=${lid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'Only this league’s managers can read the admission vote.'
            : 'Could not load the admission vote.'
        )
      }
      set_state(await response.json())
      set_error_message(null)
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_is_loading(false)
    }
  }, [lid, token])

  React.useEffect(() => {
    set_is_loading(true)
    load()
  }, [load])

  const submit_ballot = async (ranked_candidate_ids) => {
    set_is_submitting(true)
    set_notice(null)
    try {
      const response = await fetch(
        `${API_URL}/admission-votes/${state.vote.admission_vote_id}/ballot`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            league_id: Number(lid),
            ranked_candidate_ids
          })
        }
      )
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body.error || 'Could not record your ballot.')
      }
      set_notice('Your ballot is recorded.')
      set_error_message(null)
      await load()
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_is_submitting(false)
    }
  }

  let content

  if (is_loading) {
    content = <p>Loading.</p>
  } else if (error_message && !state) {
    content = <p className='admission-vote__error'>{error_message}</p>
  } else if (!state || !state.vote) {
    content = <p>No admission vote has been held in this league.</p>
  } else {
    const { vote, candidates, totals, viewer } = state
    const is_open = vote.vote_status === admission_vote_statuses.OPEN

    content = (
      <>
        <section className='admission-vote__section'>
          <h2>Candidates</h2>
          <p className='admission-vote__meta'>
            {is_open
              ? `Voting closes ${format_moment(vote.closes_at)}.`
              : `Voting closed ${format_moment(vote.closed_at)}.`}
          </p>
          {candidates.map((candidate) => (
            <Candidate
              key={candidate.admission_vote_candidate_id}
              candidate={candidate}
            />
          ))}
        </section>

        {is_open && viewer.is_eligible && (
          <section className='admission-vote__section'>
            <h2>Your ballot</h2>
            {notice && <p className='admission-vote__notice'>{notice}</p>}
            {error_message && (
              <p className='admission-vote__error'>{error_message}</p>
            )}
            {/* Keyed on the ranking the server holds, so the form resyncs when
                that changes underneath it -- a ballot the commissioner
                transcribed, or one cast from another device. A useState
                initializer runs on mount alone and would otherwise strand the
                slots on whatever they held when the page first loaded. */}
            <Ballot
              key={viewer.ranked_candidate_ids.join('-')}
              vote={vote}
              candidates={candidates}
              viewer={viewer}
              is_submitting={is_submitting}
              on_submit={submit_ballot}
            />
          </section>
        )}

        {/* Section 10(c): a Team without a Manager shall not vote. Saying so is
            better than showing a form that would be refused. */}
        {is_open && !viewer.is_eligible && (
          <section className='admission-vote__section'>
            <h2>Your ballot</h2>
            <p>Your team is not entitled to a ballot in this vote.</p>
          </section>
        )}

        {/* Section 10(e): the point totals are shown to any Manager on request,
            and nothing at all is shown while the vote is open. That is enforced
            server-side by a status check rather than here. */}
        {!is_open && (
          <section className='admission-vote__section'>
            <h2>Result</h2>
            <Totals totals={totals} />
            <Decision vote={vote} totals={totals} />
            <p className='admission-vote__meta'>
              {state.ballot_count} of {state.eligible_team_ids.length} entitled
              teams voted
              {state.commissioner_entered_ballot_count
                ? `, ${state.commissioner_entered_ballot_count} transcribed by the commissioner`
                : ''}
              .
            </p>
          </section>
        )}
      </>
    )
  }

  const body = (
    <div className='admission-vote'>
      <h1 className='admission-vote__title'>Admission vote</h1>
      <p className='admission-vote__intro'>
        Teams rank the candidates privately. Ballots are confidential — the
        point totals are disclosed, how a team voted never is.
      </p>
      {content}
    </div>
  )

  return <PageLayout body={body} scroll />
}
