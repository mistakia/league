// Convert a timestamptz value read back from the database to epoch SECONDS.
//
// The counterpart to epoch_to_timestamptz. It exists for the read half of the
// 2026-08-07 timestamptz conformance pass, which is the SILENT half: node-pg
// hands back a JavaScript Date where the code used to get an epoch integer, the
// SQL stays valid, and arithmetic goes wrong with nothing raising. `Number(date)`
// yields MILLISECONDS, so a `< now_unix` comparison against it reads every
// conformed instant as a thousand-fold future date.
//
// Call this at the read boundary in code that legitimately keeps epoch-seconds
// internals -- a comparison against a non-database epoch, a sort key shared with
// unconformed values -- rather than threading Dates through the callers.
//
// Accepts a Date (the server path, from node-pg) or an ISO string (the client
// path, where the value has been through JSON). A bare number is NOT accepted as
// epoch seconds: post-conform no such value reaches here, and silently passing
// one through would be indistinguishable from the units bug this helper exists
// to prevent.
export default function timestamptz_to_epoch(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    throw new Error(
      `timestamptz_to_epoch received a number (${value}); expected a Date or an ISO string`
    )
  }
  const date = value instanceof Date ? value : new Date(value)
  const milliseconds = date.getTime()
  return Number.isNaN(milliseconds) ? null : Math.round(milliseconds / 1000)
}
