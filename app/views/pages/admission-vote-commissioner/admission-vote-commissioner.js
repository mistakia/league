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
  admission_vote_statuses,
  admission_vote_outcomes
} from '#libs-shared/constants/admission-vote-constants.mjs'

import './admission-vote-commissioner.styl'

// The commissioner's side of the Amendment XLIII Admission Vote: opening it,
// watching turnout while it runs, transcribing a ranking sent to him directly,
// closing it, and then the Section 11(a) election.
//
// TWO ACTIONS AT THE CLOSE AND NO THIRD. Section 11(a) grants admission of the
// highest ranked Candidate, or a pass. There is deliberately no
// admit-someone-else control here, with or without a reason box beside it: the
// admit button is offered only against the top of the ranking, and the API
// refuses anyone else regardless of what this page renders. A tie is not an
// exception — Section 11(c) puts the ranking WITHIN a tie in the
// commissioner's discretion, so every candidate sharing the top total is
// offered and whichever he picks is the highest ranked once he has ranked them.
//
// NO SURFACE HERE RENDERS A BALLOT. He sees how many teams voted and how many
// he transcribed, never which team voted or what any of them ranked. That is
// not a courtesy to the managers — the whole design rests on the tally being
// the only thing anyone reads about OTHER teams, including him. He reads his
// own ballot where every manager does, on the manager page, by the same
// own-team predicate and with no privilege attached to being commissioner.

const format_moment = (value) =>
  value ? dayjs(value).format('MMM D, YYYY h:mm A') : null

const post = async ({ url, token, body }) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'The request was refused.')
  }
  return payload
}

const TeamCheckboxes = ({ teams, selected, on_toggle }) => (
  <div className='admission-vote-commissioner__teams'>
    {teams.map((team) => (
      <label key={team.team_id}>
        <input
          type='checkbox'
          checked={selected.includes(team.team_id)}
          onChange={() => on_toggle(team.team_id)}
        />
        {team.team_name || `Team ${team.team_id}`}
      </label>
    ))}
  </div>
)

TeamCheckboxes.propTypes = {
  teams: PropTypes.array,
  selected: PropTypes.array,
  on_toggle: PropTypes.func
}

const OpenVoteForm = ({
  league_teams,
  waitlist_submissions,
  on_open,
  is_working
}) => {
  const [closes_at, set_closes_at] = React.useState('')
  const [eligible_team_ids, set_eligible_team_ids] = React.useState(
    league_teams.map((team) => team.team_id)
  )
  const [candidates, set_candidates] = React.useState([
    { candidate_name: '', submission_id: null, sponsor_team_ids: [] }
  ])

  const toggle = (list, set_list, value) =>
    set_list(
      list.includes(value)
        ? list.filter((entry) => entry !== value)
        : [...list, value]
    )

  const update_candidate = (index, changes) =>
    set_candidates((current) =>
      current.map((candidate, candidate_index) =>
        candidate_index === index ? { ...candidate, ...changes } : candidate
      )
    )

  return (
    <form
      className='admission-vote-commissioner__form'
      onSubmit={(event) => {
        event.preventDefault()
        on_open({
          closes_at: new Date(closes_at).toISOString(),
          eligible_teams: eligible_team_ids.map((team_id) => ({ team_id })),
          candidates: candidates
            .filter((candidate) => candidate.candidate_name.trim())
            .map(({ candidate_name, submission_id, sponsor_team_ids }) => ({
              candidate_name,
              submission_id,
              sponsor_team_ids
            }))
        })
      }}
    >
      <label className='admission-vote-commissioner__field'>
        <span>Voting closes</span>
        <input
          type='datetime-local'
          value={closes_at}
          required
          onChange={(event) => set_closes_at(event.target.value)}
        />
      </label>

      {/* Section 10 states no cap on how many Candidates a Team may rank, so
          there is nothing to ask for here: a first choice scores the size of
          the field, which the server derives from the candidates below. */}

      {/* Section 10(c): a Team without a Manager shall not vote. Row presence
          in the database cannot answer this, so it is stated here and frozen
          when the vote opens. */}
      <fieldset className='admission-vote-commissioner__field'>
        <legend>Teams entitled to a ballot</legend>
        <p className='admission-vote-commissioner__hint'>
          Uncheck any team with no manager. This is frozen when the vote opens.
        </p>
        <TeamCheckboxes
          teams={league_teams}
          selected={eligible_team_ids}
          on_toggle={(team_id) =>
            toggle(eligible_team_ids, set_eligible_team_ids, team_id)
          }
        />
      </fieldset>

      <fieldset className='admission-vote-commissioner__field'>
        <legend>Candidates and their sponsors</legend>
        {/* The waiting list is the pool Candidates are drawn from, never a
            nomination channel — a Manager names someone on the Boards, and the
            picker is only how you attach that person's application when he has
            one on file. So the typed name stands on its own beside it: a
            Candidate nominated directly has no submission and never will, and
            with an empty waiting list the picker degrades to its one option
            rather than becoming a dead end. */}
        {candidates.map((candidate, index) => (
          <div className='admission-vote-commissioner__candidate' key={index}>
            <label className='admission-vote-commissioner__field'>
              <span>Application on file</span>
              <select
                value={candidate.submission_id ?? ''}
                onChange={(event) => {
                  const submission_id = event.target.value
                    ? Number(event.target.value)
                    : null
                  const submission = waitlist_submissions.find(
                    (row) => row.submission_id === submission_id
                  )
                  // Picking fills the name from the application; typing over it
                  // afterwards is allowed, because the Notice names the
                  // Candidate and the Commissioner may hold a better spelling
                  // of it than the applicant typed.
                  update_candidate(index, {
                    submission_id,
                    ...(submission
                      ? { candidate_name: submission.candidate_name }
                      : {})
                  })
                }}
              >
                <option value=''>
                  {waitlist_submissions.length
                    ? '— nominated directly, no application —'
                    : '— no applications on file —'}
                </option>
                {waitlist_submissions.map((submission) => (
                  <option
                    key={submission.submission_id}
                    value={submission.submission_id}
                  >
                    {submission.candidate_name} (
                    {format_moment(submission.submitted_at)})
                  </option>
                ))}
              </select>
            </label>

            <input
              type='text'
              placeholder='Candidate name'
              value={candidate.candidate_name}
              onChange={(event) =>
                update_candidate(index, { candidate_name: event.target.value })
              }
            />
            {/* Labelled, like every other control on the page. Section 9(c):
                an individual nominated by more than one Manager is one
                Candidate and each of them is a Sponsor, so this is a list. */}
            <div className='admission-vote-commissioner__field'>
              <span>Sponsors</span>
              <TeamCheckboxes
                teams={league_teams}
                selected={candidate.sponsor_team_ids}
                on_toggle={(team_id) =>
                  update_candidate(index, {
                    sponsor_team_ids: candidate.sponsor_team_ids.includes(
                      team_id
                    )
                      ? candidate.sponsor_team_ids.filter(
                          (entry) => entry !== team_id
                        )
                      : [...candidate.sponsor_team_ids, team_id]
                  })
                }
              />
            </div>
          </div>
        ))}
        <button
          className='admission-vote-commissioner__action--add'
          type='button'
          onClick={() =>
            set_candidates([
              ...candidates,
              { candidate_name: '', submission_id: null, sponsor_team_ids: [] }
            ])
          }
        >
          Add another candidate
        </button>
      </fieldset>

      <button
        className='admission-vote-commissioner__action'
        type='submit'
        disabled={is_working}
      >
        Open the admission vote
      </button>
    </form>
  )
}

OpenVoteForm.propTypes = {
  league_teams: PropTypes.array,
  waitlist_submissions: PropTypes.array,
  on_open: PropTypes.func,
  is_working: PropTypes.bool
}

const TranscribeForm = ({ state, on_transcribe, is_working }) => {
  const { vote, candidates, league_teams, eligible_team_ids } = state
  const [team_id, set_team_id] = React.useState('')
  const [reason, set_reason] = React.useState('')
  const [slots, set_slots] = React.useState(() =>
    Array.from({ length: vote.maximum_ranked_candidates }, () => '')
  )

  const ranked_candidate_ids = slots.filter(Boolean).map(Number)
  const eligible_teams = league_teams.filter((team) =>
    eligible_team_ids.includes(team.team_id)
  )

  return (
    <form
      className='admission-vote-commissioner__form'
      onSubmit={(event) => {
        event.preventDefault()
        on_transcribe({
          team_id: Number(team_id),
          ranked_candidate_ids,
          commissioner_entered_reason: reason
        })
      }}
    >
      <p className='admission-vote-commissioner__hint'>
        For a manager who cannot reach the app. It is refused once voting
        closes, and refused for a team that already has a ballot — replacing a
        ballot is the manager’s own act.
      </p>

      <label className='admission-vote-commissioner__field'>
        <span>Team</span>
        <select
          value={team_id}
          required
          onChange={(event) => set_team_id(event.target.value)}
        >
          <option value=''>— choose —</option>
          {eligible_teams.map((team) => (
            <option key={team.team_id} value={team.team_id}>
              {team.team_name || `Team ${team.team_id}`}
            </option>
          ))}
        </select>
      </label>

      {slots.map((value, index) => (
        <label className='admission-vote-commissioner__field' key={index}>
          <span>Preference {index + 1}</span>
          <select
            value={value}
            onChange={(event) =>
              set_slots((current) =>
                current.map((slot, slot_index) =>
                  slot_index === index ? event.target.value : slot
                )
              )
            }
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

      {/* One column rather than a flag plus a reason, so a transcription
          cannot be recorded without saying why it was made. */}
      <label className='admission-vote-commissioner__field'>
        <span>Why you are entering it</span>
        <input
          type='text'
          value={reason}
          required
          onChange={(event) => set_reason(event.target.value)}
        />
      </label>

      <button
        className='admission-vote-commissioner__action'
        type='submit'
        disabled={is_working || !team_id || !ranked_candidate_ids.length}
      >
        Record this ballot
      </button>
    </form>
  )
}

TranscribeForm.propTypes = {
  state: PropTypes.object,
  on_transcribe: PropTypes.func,
  is_working: PropTypes.bool
}

const DecisionPanel = ({ state, on_decide, is_working }) => {
  const { vote, totals } = state
  const [pass_reason, set_pass_reason] = React.useState('')

  if (vote.decision_outcome) {
    const admitted = totals.find(
      (row) =>
        row.admission_vote_candidate_id ===
        vote.decided_admission_vote_candidate_id
    )
    return (
      <p>
        {vote.decision_outcome === admission_vote_outcomes.ADMITTED
          ? `${admitted ? admitted.candidate_name : 'A candidate'} was admitted on ${format_moment(vote.decided_at)}.`
          : `You passed on ${format_moment(vote.decided_at)}: ${vote.decision_reason}`}
      </p>
    )
  }

  // Section 11(a). Once the seven days elapse the deemed pass has taken effect,
  // so there is no decision left to offer.
  if (vote.is_deemed_passed) {
    return (
      <p>
        The seven days ran out on {format_moment(vote.decision_due_at)}, so you
        are deemed to have passed. Open a further nomination period.
      </p>
    )
  }

  const highest_points = totals.length ? totals[0].points_total : null
  const highest_ranked = totals.filter(
    (row) => row.points_total === highest_points
  )

  return (
    <div>
      <p className='admission-vote-commissioner__hint'>
        You have until {format_moment(vote.decision_due_at)} to admit the
        highest ranked candidate or to pass. Where you do neither you are deemed
        to have passed.
      </p>

      {highest_ranked.length > 1 && (
        <p className='admission-vote-commissioner__hint'>
          {highest_ranked.length} candidates are tied at {highest_points}{' '}
          points. Ranking them among themselves is yours alone, so admitting any
          of them admits the highest ranked.
        </p>
      )}

      {highest_ranked.map((row) => (
        <button
          className='admission-vote-commissioner__action'
          key={row.admission_vote_candidate_id}
          type='button'
          disabled={is_working}
          onClick={() =>
            on_decide({
              decision_outcome: admission_vote_outcomes.ADMITTED,
              admission_vote_candidate_id: row.admission_vote_candidate_id
            })
          }
        >
          Admit {row.candidate_name}
        </button>
      ))}

      {/* Section 11(b): Notice of the pass AND of his reason for it. */}
      <form
        className='admission-vote-commissioner__form'
        onSubmit={(event) => {
          event.preventDefault()
          on_decide({
            decision_outcome: admission_vote_outcomes.PASSED,
            decision_reason: pass_reason
          })
        }}
      >
        <label className='admission-vote-commissioner__field'>
          <span>Reason for passing</span>
          <input
            type='text'
            value={pass_reason}
            required
            onChange={(event) => set_pass_reason(event.target.value)}
          />
        </label>
        <button
          className='admission-vote-commissioner__action'
          type='submit'
          disabled={is_working || !pass_reason.trim()}
        >
          Pass and reopen nominations
        </button>
      </form>
    </div>
  )
}

DecisionPanel.propTypes = {
  state: PropTypes.object,
  on_decide: PropTypes.func,
  is_working: PropTypes.bool
}

export default function AdmissionVoteCommissionerPage() {
  const { lid } = useParams()
  const app = useSelector(get_app)
  const { token } = app

  const [state, set_state] = React.useState(null)
  const [waitlist_submissions, set_waitlist_submissions] = React.useState([])
  const [is_loading, set_is_loading] = React.useState(true)
  const [is_working, set_is_working] = React.useState(false)
  const [error_message, set_error_message] = React.useState(null)
  const [notice, set_notice] = React.useState(null)

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
        throw new Error('Could not load the admission vote.')
      }
      set_state(await response.json())
      set_error_message(null)
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_is_loading(false)
    }
  }, [lid, token])

  // The waiting list, for the picker. Its own request rather than a field on
  // the vote payload: it is a live, already-gated route, and the candidate PII
  // it carries has no business riding along on a read every Manager makes.
  //
  // A failure here is NOT an error on this page. The list is empty far more
  // often than not — it holds zero rows today — and the route additionally
  // needs the caller to manage a team, which a Commissioner need not. Either
  // way the answer is the same: no applications to pick from, type the name.
  const load_waitlist_submissions = React.useCallback(async () => {
    if (!token || !lid) {
      return
    }
    try {
      const response = await fetch(
        `${API_URL}/waitlist-submissions?league_id=${lid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      set_waitlist_submissions(response.ok ? await response.json() : [])
    } catch {
      set_waitlist_submissions([])
    }
  }, [lid, token])

  React.useEffect(() => {
    set_is_loading(true)
    load()
    load_waitlist_submissions()
  }, [load, load_waitlist_submissions])

  const run = async (make_request) => {
    set_is_working(true)
    set_notice(null)
    try {
      await make_request()
      set_error_message(null)
      await load()
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_is_working(false)
    }
  }

  const league_id = Number(lid)

  const open_admission_vote = (body) =>
    run(async () => {
      await post({
        url: `${API_URL}/admission-votes`,
        token,
        body: { league_id, ...body }
      })
      set_notice('The admission vote is open.')
    })

  const transcribe = (body) =>
    run(async () => {
      await post({
        url: `${API_URL}/admission-votes/${state.vote.admission_vote_id}/transcribed-ballot`,
        token,
        body: { league_id, ...body }
      })
      set_notice('The ballot is recorded.')
    })

  const close = () =>
    run(async () => {
      await post({
        url: `${API_URL}/admission-votes/${state.vote.admission_vote_id}/close`,
        token,
        body: { league_id }
      })
      set_notice('The vote is closed and the tally is final.')
    })

  const decide = (body) =>
    run(async () => {
      await post({
        url: `${API_URL}/admission-votes/${state.vote.admission_vote_id}/decision`,
        token,
        body: { league_id, ...body }
      })
      set_notice('Your decision is recorded.')
    })

  let content

  if (is_loading) {
    content = <p>Loading.</p>
  } else if (!state) {
    content = (
      <p className='admission-vote-commissioner__error'>{error_message}</p>
    )
  } else if (!state.viewer || !state.viewer.is_commissioner) {
    content = <p>Only the commissioner can run an admission vote.</p>
  } else {
    const { vote, league_teams } = state
    const is_open = vote && vote.vote_status === admission_vote_statuses.OPEN

    content = (
      <>
        {notice && (
          <p className='admission-vote-commissioner__notice'>{notice}</p>
        )}
        {error_message && (
          <p className='admission-vote-commissioner__error'>{error_message}</p>
        )}

        {!is_open && (
          <section className='admission-vote-commissioner__section'>
            <h2>Open an admission vote</h2>
            <OpenVoteForm
              league_teams={league_teams}
              waitlist_submissions={waitlist_submissions}
              on_open={open_admission_vote}
              is_working={is_working}
            />
          </section>
        )}

        {is_open && (
          <>
            <section className='admission-vote-commissioner__section'>
              <h2>Turnout</h2>
              {/* Aggregates. Which team has voted is not shown, because
                  knowing who has not voted yet is a lever over how they do. */}
              <p>
                {state.ballot_count} of {state.eligible_team_ids.length}{' '}
                entitled teams have voted
                {state.commissioner_entered_ballot_count
                  ? `, ${state.commissioner_entered_ballot_count} of them transcribed by you`
                  : ''}
                . Voting closes {format_moment(vote.closes_at)}.
              </p>
              <button
                className='admission-vote-commissioner__action'
                type='button'
                disabled={is_working}
                onClick={close}
              >
                Close the vote and pin the tally
              </button>
            </section>

            <section className='admission-vote-commissioner__section'>
              <h2>Transcribe a ballot</h2>
              <TranscribeForm
                state={state}
                on_transcribe={transcribe}
                is_working={is_working}
              />
            </section>
          </>
        )}

        {vote && !is_open && (
          <section className='admission-vote-commissioner__section'>
            <h2>The ranking</h2>
            <table className='admission-vote-commissioner__totals'>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {state.totals.map((row) => (
                  <tr key={row.admission_vote_candidate_id}>
                    <td>{row.candidate_name}</td>
                    <td>{row.points_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <DecisionPanel
              state={state}
              on_decide={decide}
              is_working={is_working}
            />
          </section>
        )}
      </>
    )
  }

  const body = (
    <div className='admission-vote-commissioner'>
      <h1 className='admission-vote-commissioner__title'>
        Admission vote — commissioner
      </h1>
      {content}
    </div>
  )

  return <PageLayout body={body} scroll />
}
