import debug from 'debug'

import { underdog_session_manager } from '#private/libs-server/underdog/underdog-session-manager.mjs'

const log = debug('underdog')

// Underdog Fantasy stats API wrapper. The host stats.underdogfantasy.com is
// fully public (unauthenticated requests return 200) but Cloudflare-fronted, so
// requests are issued through CloakBrowser's warmed persistent profile (see
// underdog-session-manager.mjs). All endpoints accept ?product=fantasy.
//
// Validated live 2026-06-10: slates / players / teams / appearances all 200
// unauthenticated; 1448 appearances per NFL best-ball slate.

// Half-PPR scoring type, shared across all NFL best-ball slates (the same id
// returns the superflex slate's 2QB-premium ADP -- the slate, not the scoring
// type, carries the roster format). Treated as a stable constant; the importer
// fails loudly if appearances 404.
export const UNDERDOG_HALF_PPR_SCORING_TYPE_ID =
  'ccf300b0-9197-5951-bd96-cba84ad71e86'

// All NFL best-ball slates for the fantasy product. Each slate carries
// id, title (via description), best_ball, sport_id.
export const get_underdog_nfl_slates = async () => {
  const data = await underdog_session_manager.get_underdog_json({
    path: '/v1/sports/nfl/slates?product=fantasy'
  })
  const slates = data?.slates || []
  log('fetched %d nfl slates', slates.length)
  return slates
}

// Players on a slate: id, first_name, last_name, position_name, position_id,
// team_id (can be null for deep players).
export const get_underdog_slate_players = async ({ slate_id }) => {
  if (!slate_id) throw new Error('slate_id is required')
  const data = await underdog_session_manager.get_underdog_json({
    path: `/v1/slates/${slate_id}/players?product=fantasy`
  })
  return data?.players || []
}

// All teams across sports; filter sport_id === 'NFL' for the 32 NFL teams
// (id -> abbr, standard NFL abbreviations).
export const get_underdog_teams = async () => {
  const data = await underdog_session_manager.get_underdog_json({
    path: '/v1/teams'
  })
  const teams = data?.teams || []
  return teams.filter((team) => team.sport_id === 'NFL')
}

// Appearances for a slate under a scoring type: each carries player_id, team_id,
// position_id, and projection { adp (string), points, avg_weekly_points,
// position_rank, scoring_type_id }. The scoring_type is REQUIRED in the path
// (the bare appearances path 404s). Defaults to half-PPR.
export const get_underdog_appearances = async ({
  slate_id,
  scoring_type_id = UNDERDOG_HALF_PPR_SCORING_TYPE_ID
}) => {
  if (!slate_id) throw new Error('slate_id is required')
  const data = await underdog_session_manager.get_underdog_json({
    path: `/v1/slates/${slate_id}/scoring_types/${scoring_type_id}/appearances?product=fantasy`
  })
  return data?.appearances || []
}

export const cleanup_underdog_session = async () => {
  await underdog_session_manager.cleanup()
}
