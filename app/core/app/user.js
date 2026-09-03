import { Record } from 'immutable'

// THE RECORD IS A WHITELIST, TWICE OVER. Immutable's Record silently drops any
// key it was not declared with, and create_user_record destructures an explicit
// list on the way in -- so a field added to the `users` row and returned by
// GET /api/me reaches the SPA as `undefined` unless it is added in BOTH places
// here. Nothing reports it: not lint, not the build, not PropTypes. See
// docs/guides/spa.md.
export const User = Record({
  id: null,
  username: null,
  email: null,
  data_view_generation_is_enabled: false
})

export function create_user_record({
  id,
  username,
  email,
  data_view_generation_is_enabled
}) {
  return new User({
    id,
    username,
    email,
    // Coerced rather than passed through. An older API host that predates the
    // column sends nothing, and the honest reading of "this deploy cannot tell
    // me" is the closed one -- the whole point of the entitlement is that it
    // defaults shut.
    data_view_generation_is_enabled: Boolean(data_view_generation_is_enabled)
  })
}
