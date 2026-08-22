import { isImmutable } from 'immutable'

import { shorten_url } from '@core/utils'
import { get_breadcrumbs } from '@core/contribution-breadcrumbs'
import { get_client_trace_ids } from '@core/bugsnag'

// Turns "the table is broken" into a reproduction seed.
//
// Every component here is ALLOWLISTED at capture, size-capped, and shown to the
// submitter in the dialog before it is sent. Nothing in this module reaches
// into state it was not explicitly told to read.

// The client budget sits below the server's 262144-byte ceiling (the
// contribution_submissions.captured_context check constraint, mirrored in
// api/routes/contributions.mjs) so a capture that fills the budget still fits
// with headroom rather than being refused at the route.
export const MAXIMUM_CONTEXT_BYTES = 200000

// Dropped in this order when the budget is exceeded. Cheapest triage value
// first: the screenshot is by far the largest component and the most
// reconstructible from the rest, the route and build are tiny and load-bearing.
export const CONTEXT_DROP_ORDER = Object.freeze([
  'screenshot',
  'redux_snapshot',
  'data_view',
  'action_breadcrumbs'
])

//= ====================================
//  THE REDUX SNAPSHOT ALLOWLIST
// -------------------------------------
//
// THE ALLOWLIST IS THE WHOLE DESIGN, AND A BLACKLIST IS NOT AN ACCEPTABLE
// SUBSTITUTE. `state.app` holds the live session JWT in `token` and the
// submitter's email in `user.email` (app/core/app/reducer.js, app/core/app/
// user.js). A snapshot built by REMOVING known-bad keys ships a credential the
// first time a new field lands on that record -- and the failure is silent,
// because nothing about a new field announces that it is sensitive.
//
// So: name the slices, and name the fields within them. Anything not named here
// is dropped. Adding a field to the `app` record does not change this snapshot
// until it is added below, which is the property test/app.contribution-context
// .spec.mjs asserts.
export const REDUX_SNAPSHOT_ALLOWLIST = Object.freeze({
  app: Object.freeze([
    'year',
    'leagueId',
    'teamId',
    'userId',
    'clientId',
    'selected_data_view_id',
    'selected_plays_view_id'
  ]),
  websocket: Object.freeze(['is_connected'])
})

// `api.request_history` is a Map whose KEYS are structural request identifiers
// and whose values are all `true`. The keys are the useful part and the values
// carry nothing, so this takes keys only. Note it is not a history -- it holds
// only what is in flight right now (see contribution-breadcrumbs.js).
const read_request_history = (state) => {
  const api_slice = state.get('api')
  if (!api_slice) return []
  const request_history = api_slice.get('request_history')
  if (!request_history) return []
  return request_history.keySeq().toArray()
}

// Serialized at the boundary. An Immutable structure that survived into the
// output would be JSON.stringify'd into its internal shape rather than its
// value, so anything leaving here is converted explicitly.
const to_plain = (value) =>
  isImmutable(value) || (value && typeof value.toJS === 'function')
    ? value.toJS()
    : value

export const build_redux_snapshot = (state) => {
  if (!state || typeof state.get !== 'function') return null

  const snapshot = {}

  for (const [slice_name, field_names] of Object.entries(
    REDUX_SNAPSHOT_ALLOWLIST
  )) {
    const slice = state.get(slice_name)
    if (!slice || typeof slice.get !== 'function') continue

    const slice_snapshot = {}
    for (const field_name of field_names) {
      const value = to_plain(slice.get(field_name))
      // Only scalars and plain arrays cross the boundary. An allowlisted field
      // that unexpectedly holds an object is dropped rather than serialized,
      // so a field changing shape cannot widen the capture.
      const value_type = typeof value
      if (
        value === null ||
        value_type === 'string' ||
        value_type === 'number' ||
        value_type === 'boolean' ||
        value_type === 'undefined'
      ) {
        slice_snapshot[field_name] = value === undefined ? null : value
      }
    }
    snapshot[slice_name] = slice_snapshot
  }

  snapshot.api = { request_history_keys: read_request_history(state) }

  return snapshot
}

//= ====================================
//  BUILD MANIFEST
// -------------------------------------
//
// The commit SHA is DELIBERATELY not in the bundle. DefinePlugin supplies
// IS_DEV and APP_VERSION only; the SHA is written to dist/build-manifest.json
// by build_manifest_plugin (webpack/webpack.config.prod.babel.mjs) precisely so
// it does not rehash every chunk on every commit. Adding it to DefinePlugin
// would defeat reproducible builds and is not an acceptable shortcut.
// Left uninitialized deliberately: `undefined` means "not fetched yet" and
// `null` means "fetched and failed", and the two must stay distinguishable so a
// failed fetch is not retried on every capture.
let cached_build

export const read_build = async () => {
  if (cached_build !== undefined) return cached_build
  try {
    const response = await window.fetch('/dist/build-manifest.json', {
      credentials: 'same-origin'
    })
    if (!response.ok) {
      cached_build = null
      return cached_build
    }
    const { sha, built_at } = await response.json()
    cached_build = { sha: sha || null, built_at: built_at || null }
  } catch (_error) {
    // DEGRADE, NEVER THROW. Context is a triage aid and never a submission
    // precondition -- a failed manifest fetch leaves the field null and the
    // report still goes.
    cached_build = null
  }
  return cached_build
}

//= ====================================
//  DATA VIEW
// -------------------------------------
//
// The URL and the serialized state are NOT redundant. The URL reopens the view
// a human can look at; the serialized state is what a triage agent diffs
// against defaults without a browser.
const read_data_view = async ({ table_state, saved_table_state }) => {
  const canonical_url = window.location.href
  let short_url = null

  try {
    const response = await shorten_url(canonical_url)
    short_url = response?.hash ? `/u/${response.hash}` : null
  } catch (_error) {
    // POST /api/u is rate-limited by express-slow-down and may refuse. A
    // refusal degrades the capture rather than blocking the submission.
    short_url = null
  }

  return {
    canonical_url,
    short_url,
    table_state: to_plain(table_state) || null,
    saved_table_state: to_plain(saved_table_state) || null
  }
}

const read_viewport = () => ({
  inner_width: window.innerWidth,
  inner_height: window.innerHeight,
  device_pixel_ratio: window.devicePixelRatio,
  user_agent: window.navigator?.userAgent || null
})

//= ====================================
//  BUDGET
// -------------------------------------
//
// A truncated capture is VISIBLY truncated. Dropping a component silently would
// let triage read an absent screenshot as "the submitter declined one" rather
// than "it did not fit", which are different findings.
export const enforce_context_budget = (context) => {
  const dropped_components = []
  let candidate = { ...context }

  const byte_length = (value) =>
    typeof window !== 'undefined' && window.TextEncoder
      ? new window.TextEncoder().encode(JSON.stringify(value)).length
      : JSON.stringify(value).length

  for (const component of CONTEXT_DROP_ORDER) {
    if (byte_length(candidate) <= MAXIMUM_CONTEXT_BYTES) break
    if (candidate[component] === undefined || candidate[component] === null) {
      continue
    }
    delete candidate[component]
    dropped_components.push(component)
  }

  if (dropped_components.length) {
    candidate = { ...candidate, dropped_components }
  }

  return candidate
}

//= ====================================
//  CAPTURE
// -------------------------------------

/**
 * Assemble the captured context for a submission.
 *
 * Every field degrades to null independently. Nothing here may throw into the
 * submit path: a report that fails to send because its context could not be
 * gathered is strictly worse than a report with a thin context.
 */
export const capture_contribution_context = async ({
  state,
  table_state = null,
  saved_table_state = null,
  screenshot = null
}) => {
  const [build, data_view] = await Promise.all([
    read_build(),
    read_data_view({ table_state, saved_table_state })
  ])

  const context = {
    route: {
      pathname: window.location.pathname,
      search: window.location.search || null
    },
    viewport: read_viewport(),
    build,
    data_view,
    redux_snapshot: build_redux_snapshot(state),
    action_breadcrumbs: get_breadcrumbs(),
    // Correlates this report with the errors the browser already reported. The
    // identifiers are minted per reported error in app/core/bugsnag.js, because
    // POST /api/errors persists no row and returns no identifier of its own.
    client_trace_ids: get_client_trace_ids(),
    screenshot,
    captured_at: new Date().toISOString()
  }

  return enforce_context_budget(context)
}
