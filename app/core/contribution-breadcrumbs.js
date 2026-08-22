// What the user did before the bug, as a bounded in-memory ring buffer.
//
// `request_history` (app/core/api/reducer.js) looks like the natural source for
// this and is not one: it sets a key on _PENDING and DELETES it on _FULFILLED
// or _FAILED, so it holds only what is in flight right now. There is no
// breadcrumb trail in this app until this middleware makes one.
//
// THE ENTRY IS `{ type, at }` AND NOTHING ELSE. Never the payload. Redux action
// payloads here carry player rows, whole league objects, and -- on the auth
// actions -- a plaintext password (LOGIN, REGISTER) and a session JWT
// (LOGIN_FULFILLED, REGISTER_FULFILLED, INIT_APP). A breadcrumb trail that
// passed payloads through would be a credential leak with extra steps, and it
// would be one on the single surface whose whole purpose is to be attached to a
// report and read by someone else. Adding a payload field here is not a
// refinement of this module; it is the defect it exists to prevent.
//
// Where a type genuinely needs a discriminator to be useful, add a per-type
// extractor to ACTION_DISCRIMINATORS below. Each returns ONE scalar, and the
// allowlist is the whole guard -- a default that reached into an unknown
// payload would reintroduce exactly what the paragraph above forbids.

export const BREADCRUMB_LIMIT = 48

const buffer = []

// Per-type scalar extractors, on an allowlist. A value that is not a string,
// number or boolean is dropped rather than serialized, so an extractor that
// accidentally names an object cannot leak one.
const ACTION_DISCRIMINATORS = {
  '@@router/LOCATION_CHANGE': (payload) => payload?.location?.pathname,
  SELECT_LEAGUE: (payload) => payload?.leagueId,
  SELECT_YEAR: (payload) => payload?.year,
  SET_SELECTED_DATA_VIEW: (payload) => payload?.data_view_id,
  SET_SELECTED_PLAYS_VIEW: (payload) => payload?.data_view_id
}

const read_discriminator = (type, payload) => {
  const extractor = ACTION_DISCRIMINATORS[type]
  if (!extractor) return undefined
  let value
  try {
    value = extractor(payload)
  } catch (_error) {
    return undefined
  }
  const value_type = typeof value
  if (
    value_type === 'string' ||
    value_type === 'number' ||
    value_type === 'boolean'
  ) {
    return value
  }
  return undefined
}

export const record_breadcrumb = (action) => {
  const type = action?.type
  if (typeof type !== 'string') return

  const entry = { type, at: Date.now() }
  const discriminator = read_discriminator(type, action.payload)
  if (discriminator !== undefined) entry.detail = discriminator

  buffer.push(entry)
  // Bounded from the FRONT, so the buffer always holds the most recent actions
  // -- the ones adjacent to the defect being reported.
  while (buffer.length > BREADCRUMB_LIMIT) buffer.shift()
}

// A copy, so a consumer cannot mutate the live buffer.
export const get_breadcrumbs = () => buffer.slice()

export const clear_breadcrumbs = () => {
  buffer.length = 0
}

// Never persisted -- not to localStorage, not to sessionStorage. The buffer is
// session-scoped by construction and dies with the tab.
export const contribution_breadcrumbs_middleware = () => (next) => (action) => {
  record_breadcrumb(action)
  return next(action)
}
