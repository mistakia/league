import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

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

  const on_submit = (event) => {
    event.preventDefault()
    if (!instruction.trim() || is_live) return
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
        <input
          className='data-view-generation__input'
          type='text'
          value={instruction}
          disabled={is_live}
          placeholder='Describe the view you want'
          aria-label='Describe the view you want'
          onChange={(event) => set_instruction(event.target.value)}
        />
        <button
          type='submit'
          className='data-view-generation__submit'
          disabled={is_live || !instruction.trim()}
        >
          Build it
        </button>
        <button
          type='button'
          className='data-view-generation__close'
          aria-label='Close'
          onClick={() => {
            set_is_open(false)
            dismiss_data_view_generation()
          }}
        >
          ×
        </button>
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
