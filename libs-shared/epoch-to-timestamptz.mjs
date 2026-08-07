// Convert epoch SECONDS to a Date for binding to a timestamptz column.
//
// This exists because the 2026-08-07 timestamptz conformance pass retyped 24
// columns that used to hold epoch integers. node-pg binds a JavaScript Date to
// a timestamptz cleanly and rejects a bare integer with
// `date/time field value out of range: "<epoch>"`, so every write site that
// still computes an epoch internally converts here, at the database boundary,
// rather than threading Dates back through its callers.
//
// SECONDS, not milliseconds. Every epoch column in that cluster was unix
// seconds; the sole milliseconds column (league_team_daily_values.timestamp)
// was retyped to observed_at and its writer converts from a Date directly.
//
// null and undefined pass through as null so a nullable calendar field stays
// nullable. A numeric 0 is converted rather than nulled -- it is a real instant
// (1970-01-01) and silently turning it into NULL would hide a units bug that
// the DDL's calendar-range assertion is there to catch.
export default function epoch_to_timestamptz(epoch_seconds) {
  if (epoch_seconds === null || epoch_seconds === undefined) return null
  return new Date(epoch_seconds * 1000)
}
