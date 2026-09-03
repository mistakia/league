// The failure contract for agentic data view generation: one home for every
// named outcome a generation can end in, and which of them are the caller's
// fault.
//
// WHY A REGISTRY RATHER THAN CODES SCATTERED ACROSS THREE MODULES. They already
// were scattered -- the queue names its refusals, the drainer names its
// dispatch failures, the socket names its admission failures -- and nothing
// listed them. A client cannot render a refusal it has never heard of, and the
// difference that matters to a user is not which module raised the code but
// whether they can do anything about it. That judgement is made HERE, once,
// rather than re-derived from message text at each rendering site, which is
// exactly the judgement a renderer cannot make.
//
// TWO CLASSES THE RETIRED DESIGN HAD ARE DELIBERATELY ABSENT. Cloudflare Access
// at the edge and the inference gateway's machine token were league-as-client
// failure modes. League holds neither credential now and makes no model call at
// all: the container's model call fails inside the harness, and league learns
// about it only as a run that did not finish. Adding them back would be
// building a failure path for a request league does not make.
//
// A REFUSAL THE AGENT MADE IS NOT A FAILURE. "Neither the registry nor
// arbitrary SQL can answer this" is a legitimate, and strong, answer. It is a
// COMPLETED job carrying generation_branch = 'refusal' and an explanation,
// never a row in this table -- filing it as a failure would fold a real answer
// in with the provider being unreachable and make both metrics meaningless.

/**
 * @typedef {object} GenerationFailure
 * @property {string} summary - one line, for an operator reading a job row
 * @property {boolean} caller_fault - whether the caller could have avoided it.
 *   Drives the HTTP status a route would map to and whether the message may be
 *   shown verbatim: a caller-fault message describes the caller's own input,
 *   while a system-fault message can name internal topology.
 * @property {boolean} retryable - whether trying the same thing again could
 *   succeed WITHOUT anything changing. Capacity clears on its own; a malformed
 *   credential does not.
 */

/** @type {Record<string, GenerationFailure>} */
export const GENERATION_FAILURES = Object.freeze({
  // --- admission: the caller asked for something that cannot be accepted ---
  authentication_required: {
    summary: 'generation requires a signed-in account',
    caller_fault: true,
    retryable: false
  },
  instruction_required: {
    summary: 'the request carried no instruction',
    caller_fault: true,
    retryable: false
  },
  generation_id_required: {
    summary: 'collecting a generation needs its generation_id',
    caller_fault: true,
    retryable: false
  },
  generation_not_found: {
    summary: 'no generation with that id is available to this account',
    caller_fault: true,
    retryable: false
  },
  // Retryable and the caller's to retry: the queue is full RIGHT NOW, and it
  // reports its depth so the caller can decide rather than guess.
  queue_full: {
    summary: 'the generation queue is at its stated depth limit',
    caller_fault: true,
    retryable: true
  },
  // THE THREE SPEND LIMITS, and the distinction that matters between them and
  // queue_full is TIME. A full queue clears in minutes; these clear at the end
  // of an hour-long window, or not at all. A client that rendered all four
  // alike would send a rate-limited caller back every few seconds for an hour.
  generation_rate_limited: {
    summary: 'this account has run its hourly limit of generations',
    caller_fault: true,
    retryable: true
  },
  generation_budget_exhausted: {
    summary: 'this account has spent its hourly generation token budget',
    caller_fault: true,
    retryable: true
  },
  // NOT retryable, and not the caller's fault. An operator switched generation
  // off; nothing the caller does changes that and nothing about waiting does
  // either.
  generation_disabled: {
    summary: 'view generation is switched off',
    caller_fault: false,
    retryable: false
  },

  // --- dispatch: league could not hand the job to base's session rail ---
  // The only two that clear by waiting. Both are the rail being busy or
  // momentarily unreadable rather than misconfigured, and the drainer returns
  // the job to the HEAD of the queue for exactly these.
  base_capacity_reached: {
    summary: "the agent's container is already running its one session",
    caller_fault: false,
    retryable: true
  },
  base_container_unreadable: {
    summary: "base could not read the agent container's session count",
    caller_fault: false,
    retryable: true
  },
  base_dispatch_failed: {
    summary: 'base refused the generation session',
    caller_fault: false,
    retryable: false
  },
  base_dispatch_empty: {
    summary: 'base accepted the session but returned no thread id',
    caller_fault: false,
    retryable: false
  },
  dispatch_failed: {
    summary: 'the dispatch failed before base answered',
    caller_fault: false,
    retryable: false
  },

  // --- configuration: nothing clears these by waiting ---
  base_api_url_unset: {
    summary:
      'BASE_API_URL is not set, so there is no session rail to dispatch onto',
    caller_fault: false,
    retryable: false
  },
  identity_key_unreadable: {
    summary: "the generation identity's key file could not be read",
    caller_fault: false,
    retryable: false
  },
  identity_key_malformed: {
    summary: "the generation identity's key is not 64 hex characters",
    caller_fault: false,
    retryable: false
  },
  session_mint_failed: {
    summary: 'base refused to mint a session token for the generation identity',
    caller_fault: false,
    retryable: false
  },
  session_mint_empty: {
    summary: 'base returned a session response carrying no token',
    caller_fault: false,
    retryable: false
  },
  principal_unresolved: {
    summary:
      'a generation job needs either an authenticated user or a connecting ip',
    caller_fault: false,
    retryable: false
  },

  // --- the run itself ---
  // THE WALL-CLOCK BOUND, and the only failure that can end a run nobody is
  // watching. It is not the socket: a disconnect must not cancel a job the
  // client can still collect, so "the client went away" and "the run should
  // stop" are different events and this is the second one.
  deadline_exceeded: {
    summary: 'the generation run passed its wall-clock deadline',
    caller_fault: false,
    retryable: true
  },
  generation_vanished: {
    summary: 'the generation job row no longer exists',
    caller_fault: false,
    retryable: false
  },

  // --- the run ended and produced nothing, learned by reading base's thread ---
  //
  // These are what stop a dead run sitting in `running` until its deadline.
  // They are named apart because each sends an operator somewhere different,
  // and that distinction is invisible from the job row alone: a session that
  // ENDED cleanly without emitting is the agent giving up without using its
  // emit tool, a FAILED one is the rail or the model, and a MISSING thread is
  // base having no record of the session league was told it created.
  //
  // All three are retryable: the same instruction against a warm model is a
  // different run, and none of them says anything was wrong with the request.
  agent_ended_without_emission: {
    summary: 'the agent session ended without emitting a view',
    caller_fault: false,
    retryable: true
  },
  agent_session_failed: {
    summary: 'the agent session failed before emitting a view',
    caller_fault: false,
    retryable: true
  },
  agent_session_missing: {
    summary: 'base has no thread for the session this generation was given',
    caller_fault: false,
    retryable: true
  },
  base_thread_unreadable: {
    summary: "base refused a read of the generation's own thread",
    caller_fault: false,
    retryable: true
  }
})

/**
 * Look up a failure, refusing to invent one for a code nobody declared.
 *
 * Returns null rather than a plausible default. A default would let an
 * undeclared code render as though it were understood -- caller_fault false,
 * retryable false, some generic summary -- which is how a code added in one
 * module and never registered here stays invisible.
 *
 * @param {string} error_code
 * @returns {GenerationFailure|null}
 */
export const describe_generation_failure = (error_code) =>
  Object.prototype.hasOwnProperty.call(GENERATION_FAILURES, error_code)
    ? GENERATION_FAILURES[error_code]
    : null

/**
 * Whether a failed generation is worth trying again as-is.
 *
 * @param {string} error_code
 * @returns {boolean}
 */
export const is_retryable_generation_failure = (error_code) =>
  describe_generation_failure(error_code)?.retryable === true

/**
 * The HTTP status a route would answer for a failure.
 *
 * 5xx for anything the caller could not have caused, which is the rule this
 * function exists to keep honest: a system fault answered 400 tells the caller
 * to change a request that was fine, and it hides the fault from every 5xx
 * alarm. 429 specifically for the two contention codes, because it is the one
 * status that already means "later, not different".
 *
 * @param {string} error_code
 * @returns {number}
 */
export const generation_failure_status = (error_code) => {
  const failure = describe_generation_failure(error_code)
  // An undeclared code is a bug in league, not a bad request.
  if (!failure) return 500
  if (failure.retryable) return failure.caller_fault ? 429 : 503
  return failure.caller_fault ? 400 : 500
}

export default {
  GENERATION_FAILURES,
  describe_generation_failure,
  generation_failure_status,
  is_retryable_generation_failure
}
