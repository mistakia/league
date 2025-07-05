// Default format hashes used as fallbacks throughout the server-side code
// These reference the named formats to maintain consistency

import { named_scoring_formats } from './named-scoring-formats-generated.mjs'
import { named_league_formats } from './named-league-formats-generated.mjs'

// Default scoring format hash - currently using 'genesis' format
export const DEFAULT_SCORING_FORMAT_HASH =
  named_scoring_formats.ppr_lower_turnover.hash

// Default league format hash - currently using 'genesis_10_team' format
export const DEFAULT_LEAGUE_FORMAT_HASH =
  named_league_formats.genesis_10_team.hash

// For backward compatibility and easy reference
export const default_format_hashes = {
  scoring_format: DEFAULT_SCORING_FORMAT_HASH,
  league_format: DEFAULT_LEAGUE_FORMAT_HASH
}
