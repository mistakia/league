import {
  player_game_prop_types,
  player_first_quarter_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'

export const get_selection_result = ({
  line,
  market_type,
  player_gamelog,
  strict,
  selection_type,
  selection_pid, // Player or team ID for the selection
  unsupported_market_types = new Set(),
  game_data = null // For team markets that need game outcome data
}) => {
  const compare = (value, line, selection_type) => {
    if (selection_type === 'UNDER' || selection_type === 'NO') {
      if (value < line) return 'WON'
      if (value > line) return 'LOST'
      return 'PUSH'
    } else {
      if (value > line) return 'WON'
      if (value < line) return 'LOST'
      return 'PUSH'
    }
  }

  switch (market_type) {
    case player_game_prop_types.GAME_PASSING_YARDS:
    case player_game_prop_types.GAME_ALT_PASSING_YARDS:
      if (strict) {
        return compare(player_gamelog.py, line, selection_type)
      } else {
        const cushion = Math.min(Math.round(line * 0.06), 16)
        return compare(player_gamelog.py, line - cushion, selection_type)
      }

    case player_game_prop_types.GAME_RUSHING_YARDS:
    case player_game_prop_types.GAME_ALT_RUSHING_YARDS: {
      if (strict) {
        return compare(player_gamelog.ry, line, selection_type)
      } else {
        const cushion = Math.min(Math.round(line * 0.12), 9)
        return compare(player_gamelog.ry, line - cushion, selection_type)
      }
    }

    case player_game_prop_types.GAME_RECEIVING_YARDS:
    case player_game_prop_types.GAME_ALT_RECEIVING_YARDS:
      if (strict) {
        return compare(player_gamelog.recy, line, selection_type)
      } else {
        const cushion = Math.min(Math.round(line * 0.12), 9)
        return compare(player_gamelog.recy, line - cushion, selection_type)
      }

    case player_game_prop_types.GAME_ALT_PASSING_COMPLETIONS:
    case player_game_prop_types.GAME_PASSING_COMPLETIONS:
      return compare(player_gamelog.pc, line, selection_type)

    case player_game_prop_types.GAME_ALT_PASSING_TOUCHDOWNS:
    case player_game_prop_types.GAME_PASSING_TOUCHDOWNS:
      return compare(player_gamelog.tdp, line, selection_type)

    case player_game_prop_types.GAME_ALT_RECEPTIONS:
    case player_game_prop_types.GAME_RECEPTIONS: {
      if (strict) {
        return compare(player_gamelog.rec, line, selection_type)
      } else {
        const cushion = Math.round(line * 0.15)
        return compare(player_gamelog.rec, line - cushion, selection_type)
      }
    }

    case player_game_prop_types.GAME_PASSING_INTERCEPTIONS:
      return compare(player_gamelog.ints, line, selection_type)

    case player_game_prop_types.GAME_ALT_RUSHING_ATTEMPTS:
    case player_game_prop_types.GAME_RUSHING_ATTEMPTS:
      return compare(player_gamelog.ra, line, selection_type)

    case player_game_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS:
    case player_game_prop_types.GAME_RUSHING_RECEIVING_YARDS:
      return compare(
        player_gamelog.ry + player_gamelog.recy,
        line,
        selection_type
      )

    case player_game_prop_types.GAME_RECEIVING_TOUCHDOWNS:
      return compare(player_gamelog.tdrec, line, selection_type)

    case player_game_prop_types.GAME_RUSHING_TOUCHDOWNS:
      return compare(player_gamelog.tdr, line, selection_type)

    case player_game_prop_types.GAME_PASSING_ATTEMPTS:
      return compare(player_gamelog.pa, line, selection_type)

    // player_game_prop_types.GAME_PASSING_LONGEST_COMPLETION,
    // player_game_prop_types.GAME_LONGEST_RECEPTION,

    case player_game_prop_types.ANYTIME_TOUCHDOWN:
      return compare(
        player_gamelog.tdr + player_gamelog.tdrec,
        line,
        selection_type
      )

    // player_game_prop_types.GAME_LONGEST_RUSH,

    case player_game_prop_types.GAME_PASSING_RUSHING_YARDS: {
      if (strict) {
        return compare(
          player_gamelog.py + player_gamelog.ry,
          line,
          selection_type
        )
      } else {
        const cushion = Math.min(Math.round(line * 0.06), 20)
        return compare(
          player_gamelog.py + player_gamelog.ry,
          line - cushion,
          selection_type
        )
      }
    }

    // Additional player stat markets
    case player_game_prop_types.GAME_RECEIVING_TARGETS:
      if (strict) {
        return compare(player_gamelog.trg, line, selection_type)
      } else {
        const cushion = Math.round(line * 0.15)
        return compare(player_gamelog.trg, line - cushion, selection_type)
      }

    // Longest play markets - these require play-by-play data
    case player_game_prop_types.GAME_LONGEST_RECEPTION:
      return compare(
        player_gamelog.longest_reception || 0,
        line,
        selection_type
      )

    case player_game_prop_types.GAME_LONGEST_RUSH:
      return compare(player_gamelog.longest_rush || 0, line, selection_type)

    case player_game_prop_types.GAME_PASSING_LONGEST_COMPLETION:
      return compare(player_gamelog.longest_pass || 0, line, selection_type)

    // First quarter markets - use proper constants
    case player_first_quarter_prop_types.GAME_FIRST_QUARTER_PASSING_YARDS:
    case player_game_prop_types.GAME_FIRST_QUARTER_ALT_PASSING_YARDS: {
      if (strict) {
        return compare(
          player_gamelog.first_quarter_stats?.passing_yards,
          line,
          selection_type
        )
      } else {
        const cushion = Math.min(Math.round(line * 0.06), 8)
        return compare(
          player_gamelog.first_quarter_stats?.passing_yards,
          line - cushion,
          selection_type
        )
      }
    }

    case player_first_quarter_prop_types.GAME_FIRST_QUARTER_RUSHING_YARDS:
    case player_game_prop_types.GAME_FIRST_QUARTER_ALT_RUSHING_YARDS: {
      if (strict) {
        return compare(
          player_gamelog.first_quarter_stats?.rushing_yards,
          line,
          selection_type
        )
      } else {
        const cushion = Math.min(Math.round(line * 0.12), 5)
        return compare(
          player_gamelog.first_quarter_stats?.rushing_yards,
          line - cushion,
          selection_type
        )
      }
    }

    case player_first_quarter_prop_types.GAME_FIRST_QUARTER_RECEIVING_YARDS:
    case player_game_prop_types.GAME_FIRST_QUARTER_ALT_RECEIVING_YARDS: {
      if (strict) {
        return compare(
          player_gamelog.first_quarter_stats?.receiving_yards,
          line,
          selection_type
        )
      } else {
        const cushion = Math.min(Math.round(line * 0.12), 5)
        return compare(
          player_gamelog.first_quarter_stats?.receiving_yards,
          line - cushion,
          selection_type
        )
      }
    }

    // Team game outcome markets - these require game outcome data
    case team_game_market_types.GAME_MONEYLINE:
      // For moneyline, selection_pid is the team_id, and we compare against game winner
      if (
        game_data &&
        game_data.home_score !== undefined &&
        game_data.away_score !== undefined
      ) {
        const winner =
          game_data.home_score > game_data.away_score
            ? game_data.h
            : game_data.away_score > game_data.home_score
              ? game_data.v
              : 'TIE'
        if (winner === 'TIE') {
          return 'PUSH'
        }
        return winner === selection_pid ? 'WON' : 'LOST'
      }
      return null // No game result available

    case team_game_market_types.GAME_SPREAD:
      // For spread, selection_pid is the team_id, line is the spread
      if (
        game_data &&
        game_data.home_score !== undefined &&
        game_data.away_score !== undefined &&
        selection_pid
      ) {
        const point_differential = game_data.home_score - game_data.away_score
        const adjusted_differential =
          selection_pid === game_data.h
            ? point_differential
            : -point_differential
        return compare(adjusted_differential, -line, 'OVER') // Spread is typically negative for favorites
      }
      return null

    case team_game_market_types.GAME_TOTAL:
      // For totals, we compare total points against the line using selection_type (OVER/UNDER)
      if (
        game_data &&
        game_data.home_score !== undefined &&
        game_data.away_score !== undefined
      ) {
        const total_points = game_data.home_score + game_data.away_score
        return compare(total_points, line, selection_type)
      }
      return null

    default:
      unsupported_market_types.add(market_type)
      return null
  }
}

export const is_hit = (params) => get_selection_result(params) === 'WON'
