import dayjs from 'dayjs'

import get_free_agent_period from '#libs-shared/get-free-agent-period.mjs'

// Shared league-calendar derivation used by both the schedule doc (full
// calendar) and the league index (current phase + a few upcoming dates). The
// event set is the enumerated list of `seasons` timestamp fields; labels match
// the app's `get_league_events` vocabulary so the docs and SPA agree.

export const league_calendar_events = [
  { field: 'season_started_at', label: 'Season Begins' },
  { field: 'draft_start', label: 'Rookie Draft' },
  { field: 'ext_date', label: 'Extension Deadline' },
  { field: 'free_agency_period_start', label: 'Free Agency Period Begins' },
  {
    field: 'free_agency_live_auction_start',
    label: 'Free Agency Live Auction'
  },
  { field: 'free_agency_live_auction_end', label: 'Free Agency Auction Ends' },
  { field: 'free_agency_period_end', label: 'Free Agency Period Ends' },
  { field: 'tran_start', label: 'Restricted Free Agency Begins' },
  { field: 'tran_end', label: 'Restricted Free Agency Ends' },
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

  return league_calendar_events
    .filter((event) => league[event.field])
    .map((event) => ({
      label: event.label,
      date_unix: Number(league[event.field]),
      status: Number(league[event.field]) < now ? 'past' : 'upcoming'
    }))
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

  if (league.season_finalized_at && now > league.season_finalized_at) {
    return 'Offseason (season finalized)'
  }

  if (league.ext_date && now < league.ext_date) {
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
    league.tran_start &&
    league.tran_end &&
    now >= league.tran_start &&
    now <= league.tran_end
  ) {
    return 'Restricted Free Agency'
  }

  if (
    league.draft_start &&
    now >= league.draft_start &&
    league.ext_date &&
    now < league.ext_date
  ) {
    return 'Rookie Draft'
  }

  return 'Regular Season / Offseason'
}
