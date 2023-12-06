import { constants } from '#libs-shared'

export default function encode_market_selection_id({
  market_type,
  esbid,
  pid,
  nfl_team,
  metric_name,
  metric_line,
  selection_name,
  start_time
}) {
  const log_error = (msg) => {
    console.error({
      market_type,
      esbid,
      pid,
      nfl_team,
      metric_name,
      metric_line,
      selection_name,
      start_time
    })
    throw new Error(msg)
  }

  switch (market_type) {
    case 'GAME_PROPS': {
      if (!esbid) {
        log_error('esbid is required for GAME_PROPS')
      }

      if (!metric_name) {
        return `/GAME_PROPS/${esbid}/${selection_name}`
      } else {
        return `/GAME_PROPS/${esbid}/${selection_name}/${metric_name}/${metric_line}`
      }
    }

    case 'TEAM_GAME_PROPS': {
      if (!esbid) {
        log_error('esbid is required for TEAM_GAME_PROPS')
      }

      if (!nfl_team) {
        log_error('nfl_team is required for TEAM_GAME_PROPS')
      }

      if (!metric_name) {
        return `/TEAM_GAME_PROPS/${esbid}/${nfl_team}/${selection_name}`
      } else {
        return `/TEAM_GAME_PROPS/${esbid}/${nfl_team}/${selection_name}/${metric_name}/${metric_line}`
      }
    }

    case 'PLAYER_GAME_PROPS': {
      if (!esbid) {
        log_error('esbid is required for PLAYER_GAME_PROPS')
      }

      if (!pid) {
        log_error('pid is required for PLAYER_GAME_PROPS')
      }

      if (!metric_name) {
        return `/PLAYER_GAME_PROPS/${esbid}/${pid}/${selection_name}`
      } else {
        return `/PLAYER_GAME_PROPS/${esbid}/${pid}/${selection_name}/${metric_name}/${metric_line}`
      }
    }

    case 'PLAYER_SEASON_PROPS':
      if (start_time.isBefore(constants.season.openingDay)) {
        log_error('start time is before current season')
      }

      if (!pid) {
        log_error('pid is required for PLAYER_SEASON_PROPS')
      }

      return `/PLAYER_SEASON_PROPS/${constants.season.year}/${esbid}/${pid}/${selection_name}/${metric_name}/${metric_line}`

    default:
      throw new Error(`Invalid market_type: ${market_type}`)
  }
}
