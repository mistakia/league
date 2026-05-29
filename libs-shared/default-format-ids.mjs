// Default format IDs used as fallbacks throughout the server-side code.
// Opaque slugs; identity is decoupled from config content. The canonical slug
// 'draftkings' covers the config formerly named ppr_lower_turnover -- both
// source keys in league-format-definitions.mjs collapse to id 'draftkings'
// under the alphabetical-first rule (see the format-id migration task).

export const DEFAULT_SCORING_FORMAT_ID = 'draftkings'

export const DEFAULT_LEAGUE_FORMAT_ID = 'genesis_10_team'
