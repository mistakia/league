import { fromJS } from 'immutable'

import { data_view_generation_actions } from './actions'

// The generation panel's whole state, and it holds AT MOST ONE run.
//
// One at a time is not a simplification: the server's queue admits a caller
// once per slot and the profile permits a single concurrent session, so a
// client tracking several would be tracking runs the server is refusing. A
// second submit replaces the first here and the first keeps running server-side
// under its own id -- the run outlives the client's interest in it, which is
// the same asymmetry the socket layer is built on.
const initial_state = fromJS({
  // The whole contract. Persisted to localStorage by the saga, because
  // reconnect-and-collect is a server feature no client can reach without it.
  generation_id: null,
  // queued | dispatched | running | completed | failed | expired -- the job
  // row's own vocabulary, not a second one. A client-side status word would
  // have to be mapped back onto these at every read site.
  status: null,
  instruction: null,
  // The emit envelope: {expressible, explanation, inexpressible_reason} plus
  // either table_state or sql_text/column_annotations.
  result: null,
  // registry | query | refusal
  generation_branch: null,
  error_code: null,
  error_message: null,
  // Carried on a queue_full refusal specifically, so the control can say how
  // full the queue is rather than rendering a generic error.
  queue_depth: null,
  max_queue_depth: null,
  // What the run cost. Null until the job row carries it.
  tool_call_count: null,
  total_tokens: null,
  duration_milliseconds: null
})

// The frame fields that are simply mirrored. Listed rather than spread wholesale
// so a server field the client does not model cannot silently become client
// state that nothing reads.
const MIRRORED_FIELDS = [
  'generation_id',
  'status',
  'instruction',
  'result',
  'generation_branch',
  'error_code',
  'error_message',
  'tool_call_count',
  'total_tokens',
  'duration_milliseconds'
]

const mirror_job = (state, payload) => {
  const next = {}
  for (const field of MIRRORED_FIELDS) {
    if (payload[field] !== undefined) next[field] = payload[field]
  }
  return state.merge(fromJS(next))
}

export function data_view_generation_reducer(
  state = initial_state,
  { payload, type }
) {
  switch (type) {
    case data_view_generation_actions.DATA_VIEW_GENERATION_SUBMIT:
      // Cleared to initial rather than merged over: a second submit must not
      // leave the previous run's result, branch or error on screen beside a
      // freshly queued one. `status: 'submitting'` is the one word here that is
      // NOT a job status -- there is no job yet, and the server has not
      // answered. It is what distinguishes "we sent it" from "it was accepted",
      // which matters because the queue can refuse.
      return initial_state.merge({
        status: 'submitting',
        instruction: payload.instruction
      })

    case data_view_generation_actions.DATA_VIEW_GENERATION_ACCEPTED:
      return mirror_job(initial_state, payload).merge({
        queue_depth: payload.queue_depth ?? null,
        max_queue_depth: payload.max_queue_depth ?? null
      })

    case data_view_generation_actions.DATA_VIEW_GENERATION_UPDATE: {
      // Guarded on the id. A frame for a run this client has moved on from --
      // a watcher still polling the previous generation when a second submit
      // has already replaced it -- would otherwise put the old run's status
      // back over the new one. The ACCEPTED frame for the new run may not have
      // landed yet, so an update arriving while generation_id is null is
      // equally not ours.
      const current = state.get('generation_id')
      if (!current || current !== payload.generation_id) return state
      return mirror_job(state, payload)
    }

    case data_view_generation_actions.DATA_VIEW_GENERATION_ERROR: {
      // An error frame carrying no generation_id is an ADMISSION refusal --
      // the queue was full, or the caller is not signed in -- so it belongs to
      // the submit in flight and there is no id to match on. One that carries
      // an id belongs to a specific run and is matched like an update.
      if (
        payload.generation_id &&
        payload.generation_id !== state.get('generation_id')
      ) {
        return state
      }
      return state.merge({
        status: 'failed',
        error_code: payload.error_code || null,
        error_message: payload.message || null,
        queue_depth: payload.queue_depth ?? null,
        max_queue_depth: payload.max_queue_depth ?? null
      })
    }

    case data_view_generation_actions.DATA_VIEW_GENERATION_DISMISS:
      return initial_state

    default:
      return state
  }
}
