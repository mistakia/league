import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import AgentSessionTimeline from 'react-agent-timeline'

import './data-view-generation-control.styl'

// The status words the JOB row uses, mapped to what a person reads. `submitting`
// is the client's own, for the gap between sending and the server answering.
//
// Deliberately a map rather than a formatter over the raw word: `dispatched`
// means "handed to the agent rail" and `queued` means "waiting for a slot", and
// a user reading either would not guess which one is theirs to wait on.
const STATUS_LABEL = {
  submitting: 'Sending',
  queued: 'Queued',
  dispatched: 'Starting the agent',
  running: 'Building the view',
  completed: 'Done',
  failed: 'Failed',
  expired: 'Timed out'
}

const LIVE_STATUSES = ['submitting', 'queued', 'dispatched', 'running']

// Every word the shared timeline component renders comes from here. The package
// is presentational and deliberately ships no domain vocabulary of its own, so
// a label it does not receive is a label that does not exist.
//
// THIS IS NOT THE OLD TOOL PARAPHRASE COMING BACK. What was removed mapped six
// TOOL NAMES onto invented prose and showed only that — `describe_column`
// became "Checking how that stat is measured", which is a guess about what the
// agent meant rather than a record of what it did. These are chrome around the
// agent's own words.
const TIMELINE_LABELS = {
  empty: 'Waiting for the agent to start',
  expand: 'Show the full run',
  collapse: 'Show less'
}

/**
 * What to say about a refusal.
 *
 * REFUSALS ARE A FIRST-CLASS STATE, NOT AN ERROR TOAST. Two of them are not
 * failures at all: a full queue is the queue working and reports how full it is,
 * and a refusal the AGENT made is a completed job carrying an explanation --
 * "neither the registry nor SQL can answer this" is an answer, and rendering it
 * as a crash throws away the only thing it said.
 */
const describe_error = ({
  error_code,
  error_message,
  queue_depth,
  max_queue_depth
}) => {
  if (error_code === 'queue_full' && max_queue_depth) {
    return `The generation queue is full — ${queue_depth ?? max_queue_depth} of ${max_queue_depth} runs are in flight. Try again shortly.`
  }
  // Both reach a rendered control only when the store is STALE against the
  // server: the panel does not render at all without the entitlement, so
  // arriving here means the session expired or the flag was revoked while the
  // page stayed open. Named rather than folded into the generic message,
  // because "sign in again" and "ask for access" are different actions.
  if (error_code === 'authentication_required') {
    return 'Generating a view requires a signed-in account.'
  }
  if (error_code === 'generation_not_enabled') {
    return 'This account is not enabled for view generation.'
  }
  return error_message || 'The generation could not be completed.'
}

export default function DataViewGenerationControl({
  generation,
  is_generation_enabled,
  table_state,
  submit_data_view_generation,
  dismiss_data_view_generation,
  resume_data_view_generation,
  pending_generation_id
}) {
  const [instruction, set_instruction] = useState('')
  const [is_open, set_is_open] = useState(false)
  // Collapsed by default. Expansion is the USER's state and deliberately not
  // reset when entries arrive -- a timeline that re-collapsed itself on every
  // live entry would be unreadable for exactly the run worth reading.
  const [is_timeline_expanded, set_is_timeline_expanded] = useState(false)
  const input_ref = useRef(null)

  // Opening the panel is a request to type in it, so the caret goes there
  // rather than leaving the user to click the box they just asked for. Not
  // `autoFocus`: React applies that on mount only, and the panel is also opened
  // by the resume effect below, which does not remount it.
  useEffect(() => {
    if (!is_open) return
    const element = input_ref.current
    if (!element || element.disabled) return
    element.focus()
    // Caret at the end, not over a selection -- a resumed run leaves the
    // previous instruction in the box and selecting all of it means the next
    // keystroke silently replaces it.
    const end = element.value.length
    element.setSelectionRange(end, end)
  }, [is_open])

  // Grow with the prompt instead of scrolling a one-line window. A view
  // instruction is a sentence or three, and the whole point of reviewing one
  // before sending is being able to see all of it. The cap lives in the
  // stylesheet -- height is reset first so the box shrinks back on delete.
  useEffect(() => {
    const element = input_ref.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [instruction, is_open])

  // Re-attach to a run this browser started before a reload. Runs once: the
  // stored id is read at mount and the server answers with an UPDATE frame that
  // populates the panel, including for a run that finished while the tab was
  // closed.
  useEffect(() => {
    if (!is_generation_enabled || !pending_generation_id) return
    set_is_open(true)
    resume_data_view_generation({ generation_id: pending_generation_id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is_generation_enabled])

  // NO CONTROL AT ALL for an account that is not entitled, rather than one that
  // always refuses -- a refusal a user can do nothing about is worse than no
  // control. This covers an anonymous visitor too, who has no user record and
  // therefore no flag. The socket refuses independently
  // (require_generation_principal); this is the half that decides what is
  // offered, not the half that decides what is allowed.
  //
  // AFTER the hooks, deliberately: an early return above them changes the hook
  // order between renders the moment the flag arrives from GET /api/me.
  if (!is_generation_enabled) return null

  const status = generation.status
  const is_live = LIVE_STATUSES.includes(status)
  // The store holds this as an Immutable List that index.js converts with
  // toJS(), so it is a plain array here. Defaulted because a run that has not
  // reached `dispatched` has no thread and therefore no timeline at all --
  // every run's first seconds, not an edge case.
  const timeline_entries = generation.timeline_entries ?? []

  const can_submit = Boolean(instruction.trim()) && !is_live

  // One control, three jobs, and only one of them is an abort. Dismissing
  // clears CLIENT state -- the run itself keeps going on the server and can be
  // resumed -- so calling it "Cancel" over a live run promises a kill it does
  // not perform.
  const dismiss_label = is_live ? 'Hide' : status ? 'Close' : 'Cancel'

  const close_panel = () => {
    set_is_open(false)
    dismiss_data_view_generation()
  }

  const on_submit = (event) => {
    event.preventDefault()
    if (!can_submit) return
    // The current view rides along as the EDIT case. The server treats a
    // table_state on the request as "this is what the user is looking at";
    // the agent returns a complete replacement rather than a patch.
    submit_data_view_generation({
      instruction: instruction.trim(),
      table_state: table_state || null
    })
  }

  if (!is_open) {
    return (
      <div className='data-view-generation'>
        <button
          type='button'
          className='data-view-generation__open'
          onClick={() => set_is_open(true)}
        >
          Describe a view
        </button>
      </div>
    )
  }

  return (
    <div className='data-view-generation data-view-generation--open'>
      <form className='data-view-generation__form' onSubmit={on_submit}>
        <textarea
          ref={input_ref}
          className='data-view-generation__input'
          rows={3}
          value={instruction}
          disabled={is_live}
          placeholder='Describe the view you want — say who the rows are, what to measure, and over which seasons or weeks.'
          aria-label='Describe the view you want'
          onChange={(event) => set_instruction(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, shift-Enter breaks the line. A textarea is here to
            // show a long prompt, not to invite one -- the instruction is a
            // sentence, so the key that ends a sentence should send it.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              on_submit(event)
              return
            }
            if (event.key === 'Escape' && !is_live) close_panel()
          }}
        />
        {/* Actions appear only once they do something. An always-present
            disabled `Build it` is the loudest element in an empty panel and
            says nothing the empty box has not already said; the hint takes its
            place until there is a prompt to send. */}
        <div className='data-view-generation__actions'>
          <span className='data-view-generation__hint'>
            {is_live
              ? ''
              : can_submit
                ? 'Enter to build'
                : 'Shift-Enter for a new line'}
          </span>
          <button
            type='button'
            className='data-view-generation__cancel'
            onClick={close_panel}
          >
            {dismiss_label}
          </button>
          {can_submit && (
            <button type='submit' className='data-view-generation__submit'>
              Build it
            </button>
          )}
        </div>
      </form>

      {status && (
        <div className='data-view-generation__status'>
          <span className='data-view-generation__status-label'>
            {STATUS_LABEL[status] || status}
          </span>
          {is_live && generation.instruction && (
            <span className='data-view-generation__instruction'>
              {generation.instruction}
            </span>
          )}
          {generation.tool_call_count !== null && (
            <span className='data-view-generation__trajectory'>
              {generation.tool_call_count} tool calls
              {generation.duration_milliseconds
                ? ` · ${Math.round(generation.duration_milliseconds / 1000)}s`
                : ''}
            </span>
          )}
        </div>
      )}

      {/* THE AGENT'S OWN TIMELINE, not a paraphrase of it. Rendered whenever
          there is anything to show — including for a FINISHED run, so a user
          who returns to a completed generation can still read how it got
          there. */}
      {timeline_entries.length > 0 && (
        <div className='data-view-generation__timeline'>
          {generation.timeline_is_redacted && (
            <div className='data-view-generation__timeline-redacted'>
              This run&apos;s timeline could not be read in full.
            </div>
          )}
          <AgentSessionTimeline
            entries={timeline_entries}
            labels={TIMELINE_LABELS}
            is_expanded={is_timeline_expanded}
            on_toggle_expanded={() =>
              set_is_timeline_expanded(!is_timeline_expanded)
            }
          />
        </div>
      )}

      {status === 'failed' && (
        <div className='data-view-generation__error'>
          {describe_error(generation)}
        </div>
      )}

      {/* An agent refusal is a COMPLETED job, so it renders its own explanation
          rather than the error branch above. */}
      {generation.generation_branch === 'refusal' && (
        <div className='data-view-generation__refusal'>
          {generation.result?.inexpressible_reason ||
            generation.result?.explanation ||
            'The agent could not express this view.'}
        </div>
      )}

      {status === 'completed' && generation.generation_branch !== 'refusal' && (
        <div className='data-view-generation__explanation'>
          {generation.result?.explanation}
        </div>
      )}
    </div>
  )
}

DataViewGenerationControl.propTypes = {
  generation: PropTypes.object.isRequired,
  is_generation_enabled: PropTypes.bool,
  table_state: PropTypes.object,
  submit_data_view_generation: PropTypes.func.isRequired,
  dismiss_data_view_generation: PropTypes.func.isRequired,
  resume_data_view_generation: PropTypes.func.isRequired,
  pending_generation_id: PropTypes.string
}
