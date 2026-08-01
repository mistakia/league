import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import {
  league_default_rfa_window_hours,
  league_default_rfa_processing_lead_hours
} from '#constants'

dayjs.extend(utc)
dayjs.extend(timezone)

export const league_timezone = 'America/New_York'

// Restricted free agency runs as a sequence of fixed-length windows anchored on
// `restricted_free_agency_first_window_at`, the timestamp of the FIRST
// announcement. Window N opens when team N's nomination is announced and closes
// when the next window opens; bids on it are processed `processing_lead_hours`
// before that, so processing always strictly precedes the next announcement.
//
// The anchor is deliberately separate from `restricted_free_agency_period_start`,
// which is when restricted free agency becomes legal — teams need time between
// the period opening and the first announcement in order to nominate at all.
//
// Boundaries are computed calendar-aware in the league timezone rather than by
// epoch arithmetic, so a period spanning a DST transition keeps its wall-clock
// announcement hour instead of sliding by an hour.

const resolve_setting = (value, fallback) =>
  value === undefined || value === null ? fallback : Number(value)

export const get_restricted_free_agency_window_config = ({ league }) => {
  const window_hours = resolve_setting(
    league.restricted_free_agency_window_hours,
    league_default_rfa_window_hours
  )
  const processing_lead_hours = resolve_setting(
    league.restricted_free_agency_processing_lead_hours,
    league_default_rfa_processing_lead_hours
  )

  return {
    window_hours,
    processing_lead_hours,
    bid_window_hours: window_hours - processing_lead_hours,
    windows_per_day: 24 / window_hours
  }
}

/**
 * Timestamp at which window `window_index` opens — the moment that window's
 * nomination is announced, and the nomination deadline for the team on it.
 */
export const get_restricted_free_agency_window_start = ({
  league,
  window_index
}) => {
  const { window_hours, windows_per_day } =
    get_restricted_free_agency_window_config({ league })

  // timestamptz: a Date server-side, an ISO string once it has been through JSON
  const anchor = dayjs(league.restricted_free_agency_first_window_at).tz(
    league_timezone
  )

  const day_index = Math.floor(window_index / windows_per_day)
  const slot_of_day =
    ((window_index % windows_per_day) + windows_per_day) % windows_per_day
  const hour_from_anchor = anchor.hour() + slot_of_day * window_hours

  // The calendar date is advanced in UTC, which has no DST and so gives pure
  // day arithmetic, and the wall-clock time is then resolved in the league
  // timezone for THAT date. Doing this the obvious way instead — .add(days)
  // then .hour() on a tz-aware object — silently shifts every boundary by an
  // hour once the period crosses a DST transition, because dayjs applies the
  // UTC offset captured when the object was built.
  const target_date = dayjs
    .utc(anchor.format('YYYY-MM-DD'))
    .add(day_index + Math.floor(hour_from_anchor / 24), 'day')
    .format('YYYY-MM-DD')

  const pad = (value) => String(value).padStart(2, '0')
  const target_time = `${pad(hour_from_anchor % 24)}:${pad(anchor.minute())}:00`

  return dayjs.tz(`${target_date} ${target_time}`, league_timezone).unix()
}

/**
 * Index of the window containing `timestamp` — the largest N whose window start
 * is at or before it. Negative before the period opens.
 */
export const get_restricted_free_agency_window_index = ({
  league,
  timestamp = Math.round(Date.now() / 1000)
}) => {
  const { window_hours } = get_restricted_free_agency_window_config({ league })
  const anchor = dayjs(league.restricted_free_agency_first_window_at).unix()

  const window_start = (window_index) =>
    get_restricted_free_agency_window_start({ league, window_index })

  // Epoch estimate, then walk to the exact boundary. The two disagree by at
  // most an hour, and only across a DST transition.
  let index = Math.floor((timestamp - anchor) / (window_hours * 3600))
  while (window_start(index) > timestamp) index -= 1
  while (window_start(index + 1) <= timestamp) index += 1

  return index
}

/**
 * Timestamp at which bids on window `window_index` are processed —
 * `processing_lead_hours` before the next window opens.
 */
export const get_restricted_free_agency_processing_time = ({
  league,
  window_index
}) => {
  const { processing_lead_hours } = get_restricted_free_agency_window_config({
    league
  })

  return (
    get_restricted_free_agency_window_start({
      league,
      window_index: window_index + 1
    }) -
    processing_lead_hours * 3600
  )
}

/**
 * Team position (index into teams sorted by draft_order desc) nominating in
 * window `window_index`.
 *
 * Every round runs the same direction — descending draft order, repeating.
 *
 * A consequence worth stating wherever the schedule is published: when
 * `num_teams` is a multiple of the windows per day, a team's slot-of-day never
 * changes. Team `k` draws windows `k`, `k + num_teams`, ..., which all share a
 * slot, so under a 12-hour cadence half the league nominates at the afternoon
 * hour every time and half holds the overnight hour every time.
 */
export const get_restricted_free_agency_nominating_team_index = ({
  window_index,
  num_teams
}) => {
  if (window_index < 0) return 0

  return window_index % num_teams
}

/**
 * Total number of windows in the period — one per nomination opportunity.
 */
export const get_restricted_free_agency_window_count = ({ league }) => {
  const period_end = Number(league.restricted_free_agency_period_end)
  if (!period_end) return 0

  return (
    get_restricted_free_agency_window_index({
      league,
      timestamp: period_end
    }) + 1
  )
}

export default get_restricted_free_agency_window_start
