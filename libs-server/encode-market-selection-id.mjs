import { current_season } from '#constants'

export default function encode_market_selection_id({
  market_type,
  esbid,
  pid,
  nfl_team,
  metric_name,
  metric_line,
  selection_name,
  selection_type,
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
      selection_type,
      start_time
    })
    throw new Error(msg)
  }

  switch (market_type) {
    case 'GAME_PROPS': {
      if (!esbid) {
        log_error('esbid is required for GAME_PROPS')
      }

      if (selection_type && metric_name) {
        return `/GAME_PROPS/${esbid}/${selection_type}/${metric_name}/${metric_line}`
      } else {
        return `/GAME_PROPS/${esbid}/${selection_name}`
      }
    }

    case 'TEAM_GAME_PROPS': {
      if (!esbid) {
        log_error('esbid is required for TEAM_GAME_PROPS')
      }

      if (!nfl_team) {
        log_error('nfl_team is required for TEAM_GAME_PROPS')
      }

      if (selection_type && metric_name) {
        return `/TEAM_GAME_PROPS/${esbid}/${nfl_team}/${selection_type}/${metric_name}/${metric_line}`
      } else {
        return `/TEAM_GAME_PROPS/${esbid}/${nfl_team}/${selection_name}`
      }
    }

    case 'PLAYER_GAME_PROPS': {
      if (!esbid) {
        log_error('esbid is required for PLAYER_GAME_PROPS')
      }

      if (!pid) {
        log_error('pid is required for PLAYER_GAME_PROPS')
      }

      if (selection_type && metric_name) {
        return `/PLAYER_GAME_PROPS/${esbid}/${pid}/${selection_type}/${metric_name}/${metric_line}`
      } else {
        return `/PLAYER_GAME_PROPS/${esbid}/${pid}/${selection_name}`
      }
    }

    case 'PLAYER_SEASON_PROPS':
      if (start_time.isBefore(current_season.openingDay)) {
        log_error('start time is before current season')
      }

      if (!pid) {
        log_error('pid is required for PLAYER_SEASON_PROPS')
      }

      if (!metric_name) {
        log_error('metric_name is required for PLAYER_SEASON_PROPS')
      }

      if (!metric_line) {
        log_error('metric_line is required for PLAYER_SEASON_PROPS')
      }

      if (!selection_type) {
        log_error('selection_type is required for PLAYER_SEASON_PROPS')
      }

      return `/PLAYER_SEASON_PROPS/${current_season.year}/${pid}/${selection_type}/${metric_name}/${metric_line}`

    default:
      throw new Error(`Invalid market_type: ${market_type}`)
  }
}
