import dayjs from 'dayjs'

import get_free_agent_period from '#libs-shared/get-free-agent-period.mjs'
import timestamptz_to_epoch from '#libs-shared/timestamptz-to-epoch.mjs'

// Shared league-calendar derivation used by both the schedule doc (full
// calendar) and the league index (current phase + a few upcoming dates). The
// event set is the enumerated list of `seasons` timestamp fields; labels match
// the app's `get_league_events` vocabulary so the docs and SPA agree.
//
// The set is a SUBSET of the table's timestamptz columns, and the exclusions are
// deliberate rather than an oversight — a calendar states when something is
// SCHEDULED to happen. `rookie_draft_completed_at` is a completion stamp (it
// records that the draft finished, and is null while one is in progress), and
// `restricted_free_agency_processing_paused_at` / `_paused_until` are pause
// state belonging to the processing pause feature. Adding any of the three would
// put a fact about what already happened into a list of dates to plan against.
// When a new `seasons` timestamp column lands, decide which of the two it is.

export const league_calendar_events = [
  { field: 'season_started_at', label: 'Season Begins' },
  { field: 'draft_start', label: 'Rookie Draft Begins' },
  { field: 'rookie_draft_end_at', label: 'Rookie Draft Ends' },
  { field: 'extension_deadline_at', label: 'Extension Deadline' },
  { field: 'free_agency_period_start', label: 'Free Agency Period Begins' },
  {
    field: 'free_agency_live_auction_start',
    label: 'Free Agency Live Auction'
  },
  { field: 'free_agency_live_auction_end', label: 'Free Agency Auction Ends' },
  { field: 'free_agency_period_end', label: 'Free Agency Period Ends' },
  {
    field: 'restricted_free_agency_period_start',
    label: 'Restricted Free Agency Begins'
  },
  {
    field: 'restricted_free_agency_first_window_at',
    label: 'Restricted Free Agency First Window Opens'
  },
  {
    field: 'restricted_free_agency_period_end',
    label: 'Restricted Free Agency Ends'
  },
  { field: 'tddate', label: 'Trade Deadline' },
  { field: 'season_finalized_at', label: 'Season Finalized' }
]

/**
 * Build the chronological calendar: one entry per populated field in the
 * enumerated event set, sorted by date, each tagged past/upcoming relative to
 * now. Playoff weeks are derived separately (see `derive_playoff_weeks`) since
 * they are week numbers, not timestamps.
 */
export function build_league_calendar({ league, now_unix }) {
  const now = now_unix || dayjs().unix()

  // Every field in the event set is a `seasons` timestamptz, so each arrives as
  // a Date (server) or an ISO string (once through JSON). The internals below
  // stay epoch seconds because `now_unix` is the caller's contract, so the
  // conversion happens once, here, at the read boundary. `Number(a Date)` would
  // yield milliseconds and read every event as upcoming forever.
  return league_calendar_events
    .filter((event) => league[event.field])
    .map((event) => {
      const date_unix = timestamptz_to_epoch(league[event.field])
      return {
        label: event.label,
        date_unix,
        status: date_unix < now ? 'past' : 'upcoming'
      }
    })
    .sort((a, b) => a.date_unix - b.date_unix)
}

/**
 * Derive playoff weeks best-effort from `wildcard_round` (a week number) and
 * `championship_round` (an array of week numbers). The `playoffs` table has no
 * bracket/seed structure, so callers state this is best-effort.
 */
export function derive_playoff_weeks({ league }) {
  const wildcard_week = league.wildcard_round || null
  const championship_weeks = Array.isArray(league.championship_round)
    ? league.championship_round.filter(Boolean)
    : []

  return { wildcard_week, championship_weeks }
}

/**
 * Resolve a compact current-phase label for the banner. Checks the known
 * windows in chronological order and falls back to regular season / offseason.
 * Mirrors the app's use of `dayjs()` for "now".
 */
export function resolve_current_phase({ league, now_unix }) {
  const now = now_unix || dayjs().unix()

  // Same read boundary as build_league_calendar: these are timestamptz columns
  // and every comparison below is against epoch seconds.
  const season_finalized_at = timestamptz_to_epoch(league.season_finalized_at)
  const extension_deadline_at = timestamptz_to_epoch(
    league.extension_deadline_at
  )
  const draft_start = timestamptz_to_epoch(league.draft_start)
  const restricted_free_agency_period_start = timestamptz_to_epoch(
    league.restricted_free_agency_period_start
  )
  const restricted_free_agency_period_end = timestamptz_to_epoch(
    league.restricted_free_agency_period_end
  )

  if (season_finalized_at && now > season_finalized_at) {
    return 'Offseason (season finalized)'
  }

  if (extension_deadline_at && now < extension_deadline_at) {
    return 'Extension Window'
  }

  if (league.free_agency_live_auction_start) {
    const fa = get_free_agent_period(league)
    const fa_start = fa.start ? fa.start.unix() : null
    const fa_end = fa.end ? fa.end.unix() : null
    const auction_start = fa.free_agency_live_auction_start
      ? fa.free_agency_live_auction_start.unix()
      : null
    const auction_end = fa.free_agency_live_auction_end
      ? fa.free_agency_live_auction_end.unix()
      : null

    if (
      auction_start &&
      auction_end &&
      now >= auction_start &&
      now <= auction_end
    ) {
      return 'Free Agency (live auction)'
    }
    if (fa_start && fa_end && now >= fa_start && now <= fa_end) {
      return 'Free Agency'
    }
  }

  if (
    restricted_free_agency_period_start &&
    restricted_free_agency_period_end &&
    now >= restricted_free_agency_period_start &&
    now <= restricted_free_agency_period_end
  ) {
    return 'Restricted Free Agency'
  }

  if (
    draft_start &&
    now >= draft_start &&
    extension_deadline_at &&
    now < extension_deadline_at
  ) {
    return 'Rookie Draft'
  }

  return 'Regular Season / Offseason'
}
