import { find_play } from '#libs-server/play-cache.mjs'

// Play identity by game context, tightest key first. Charting feeds carry no NFL
// play id, so a play is located by the situation it happened in — and the tiers
// exist because two charting vendors now write nfl_plays and they do not agree
// field for field. Sumer Sports owns seconds_remaining_quarter for 2025 and its
// clock runs a few seconds off other feeds', so a clock-exact match alone loses
// roughly a sixth of a season.
//
// Every tier requires exactly ONE candidate; an ambiguous tier falls through
// rather than guessing, and the tier that resolved each play is returned so a
// caller can count the loose ones and a later audit can revisit them.
//
// The names order on ONE axis — what the tier matches on, loosening downward —
// so a reader can rank them by tightness and place a new one. A tier named for
// what it REMOVES cannot be ranked against one named for what it keeps.
//
// A fifth tier matching on down and distance while dropping yard_line_100 was
// measured and rejected: against the 2025 PlayerProfiler file it bought 529
// extra matches while creating 168 additional same-play collisions — one
// database play claimed by two CSV rows, which proves at least one attribution
// is wrong — and it was the only tier producing collisions among charted plays.
// Dropping yard_line_100 while keeping yards_to_go is the looser relaxation,
// because down plus yard line nearly determines distance.
export const PLAY_MATCH_TIERS = [
  {
    name: 'clock_exact',
    build: (c) => ({
      quarter: c.quarter,
      down_number: c.down_number,
      yards_to_go: c.yards_to_go,
      yard_line_100: c.yard_line_100,
      offense_nfl_team: c.offense,
      defense_nfl_team: c.defense,
      seconds_remaining_quarter: c.seconds_remaining_quarter
    })
  },
  {
    name: 'clock_within_tolerance',
    build: (c) => ({
      quarter: c.quarter,
      down_number: c.down_number,
      yards_to_go: c.yards_to_go,
      yard_line_100: c.yard_line_100,
      offense_nfl_team: c.offense,
      defense_nfl_team: c.defense,
      seconds_remaining_quarter: c.seconds_remaining_quarter,
      sec_rem_qtr_tolerance: 3
    })
  },
  {
    name: 'down_distance_spot',
    build: (c) => ({
      quarter: c.quarter,
      down_number: c.down_number,
      yards_to_go: c.yards_to_go,
      yard_line_100: c.yard_line_100,
      offense_nfl_team: c.offense,
      defense_nfl_team: c.defense
    })
  },
  {
    // A penalty or spot correction moves distance without moving the snap.
    name: 'down_distance_spot_any_distance',
    build: (c) => ({
      quarter: c.quarter,
      down_number: c.down_number,
      yard_line_100: c.yard_line_100,
      offense_nfl_team: c.offense,
      defense_nfl_team: c.defense
    })
  }
]

/**
 * Resolve a database play from game context, trying each match tier in order
 * from tightest to loosest and accepting only an unambiguous single candidate.
 *
 * Requires preload_plays() to have been called for the relevant season.
 *
 * @param {object} criteria
 * @param {string} criteria.esbid - Game the play belongs to
 * @param {number} [criteria.quarter]
 * @param {number} [criteria.down_number]
 * @param {number} [criteria.yards_to_go]
 * @param {number} [criteria.yard_line_100]
 * @param {number} [criteria.seconds_remaining_quarter]
 * @param {string} [criteria.offense] - Offense team abbreviation
 * @param {string} [criteria.defense] - Defense team abbreviation
 * @returns {{ play: object|null, tier: string|null }}
 */
export const resolve_play_by_context = (criteria) => {
  for (const tier of PLAY_MATCH_TIERS) {
    const matches = find_play({
      esbid: criteria.esbid,
      ...tier.build(criteria),
      return_all_matches: true
    })

    const candidates = Array.isArray(matches)
      ? matches
      : matches
        ? [matches]
        : []
    if (candidates.length === 1) {
      return { play: candidates[0], tier: tier.name }
    }
  }

  return { play: null, tier: null }
}

export default resolve_play_by_context
