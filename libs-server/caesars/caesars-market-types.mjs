import debug from 'debug'

import {
  player_prop_types,
  team_game_market_types,
  game_props_types,
  team_props_types
} from '#libs-shared/bookmaker-constants.mjs'

const log = debug('caesars:market-types')

// WHY THIS LIVES IN CORE RATHER THAN IN private/.
//
// `private/` is a submodule no workflow checks out, so on the runner and in any
// clone it is an empty directory. A `test/` spec importing it does not fail --
// it aborts the whole suite during module load with ERR_MODULE_NOT_FOUND and
// reports ZERO tests, which reads as success. Keeping the mapping here is what
// makes it testable at all. The session, fetch and cache half stays in
// `private/libs-server/caesars.mjs` and imports this module.
//
// This mirrors `libs-server/fanduel/fanduel-market-types.mjs` and
// `libs-server/draftkings/draftkings-market-types.mjs`, which already hold
// literal vendor market strings in core. The `private` boundary is about
// resolvability in a clone, not secrecy.

// THE PIPE WRAP IS LOAD-BEARING AND IT IS NOT DECORATION.
//
// The Caesars payload delivers `templateName` already wrapped in pipes, and the
// case labels below match that wire form verbatim. The IMPORTER stores the name
// with pipes STRIPPED, as segment 2 of `source_market_name`. So anything
// replaying this function over stored names must re-wrap:
//
//   get_market_type({ template_name: 'Match Spread' })    -> null
//   get_market_type({ template_name: '|Match Spread|' })  -> GAME_SPREAD
//
// Measured over all 814 distinct stored templates, the bare form types ZERO
// rows and the pipe-wrapped form types 23,046. A backfill that forgets the wrap
// runs to completion having changed nothing.

// THERE IS NO CATEGORY FALL-THROUGH FROM A TEMPLATE MISS.
//
// The template switch's `default` returns null INSIDE the `if (template_name)`
// block. A template that misses returns null and never reaches the category
// branch; only a FALSY template does. That matters to any caller reasoning
// about which of the two switches graded a market -- an empty template string
// silently takes the category branch.

export const get_market_type = ({ template_name, market_category }) => {
  // Use template_name for more specific matching
  if (template_name) {
    switch (template_name) {
      case '|Match Spread|':
        return team_game_market_types.GAME_SPREAD
      case '|Money Line|':
        return team_game_market_types.GAME_MONEYLINE
      case '|Total Points|':
        return team_game_market_types.GAME_TOTAL

      case '|Most Regular Season Passing Yards|':
        return player_prop_types.SEASON_LEADER_PASSING_YARDS
      case '|Most Regular Season Passing Touchdowns|':
        return player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS
      case '|Most Regular Season Rushing Yards|':
        return player_prop_types.SEASON_LEADER_RUSHING_YARDS
      case '|Most Regular Season Rushing Touchdowns|':
        return player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS
      case '|Most Regular Season Receiving Yards|':
        return player_prop_types.SEASON_LEADER_RECEIVING_YARDS
      case '|Total Regular Season Passing Yards|':
        return player_prop_types.SEASON_PASSING_YARDS
      case '|Total Regular Season Touchdown Passes|':
        return player_prop_types.SEASON_PASSING_TOUCHDOWNS
      case '|Total Regular Season Rushing Yards|':
        return player_prop_types.SEASON_RUSHING_YARDS
      case '|Total Regular Season Rushing Touchdowns|':
        return player_prop_types.SEASON_RUSHING_TOUCHDOWNS
      case '|Total Regular Season Receiving Yards|':
        return player_prop_types.SEASON_RECEIVING_YARDS
      case '|Total Regular Season Receiving Touchdowns|':
        return player_prop_types.SEASON_RECEIVING_TOUCHDOWNS
      case '|Total Regular Season Sacks|':
        return player_prop_types.SEASON_DEFENSE_SACKS

      case '|First Touchdown Scorer|':
        return player_prop_types.GAME_FIRST_TOUCHDOWN_SCORER
      case '|Anytime Touchdown Scorer|':
        return player_prop_types.ANYTIME_TOUCHDOWN
      case '|Last Touchdown Scorer|':
        return player_prop_types.GAME_LAST_TOUCHDOWN_SCORER

      case '|Player Total Passing Touchdowns|':
        return player_prop_types.GAME_PASSING_TOUCHDOWNS
      case '|Player Total Passing Yards|':
        return player_prop_types.GAME_PASSING_YARDS
      case '|Player Total Rushing Yards|':
        return player_prop_types.GAME_RUSHING_YARDS
      case '|Player Total Receiving Yards|':
        return player_prop_types.GAME_RECEIVING_YARDS
      case '|Player Total Receptions|':
        return player_prop_types.GAME_RECEPTIONS
      case '|Player Total Rushing + Receiving Yards|':
        return player_prop_types.GAME_RUSHING_RECEIVING_YARDS
      case '|Player Total Passing Attempts|':
        return player_prop_types.GAME_PASSING_ATTEMPTS
      case '|Player Total Passing Completions|':
        return player_prop_types.GAME_PASSING_COMPLETIONS
      case '|Player Total Interceptions|':
        return player_prop_types.GAME_PASSING_INTERCEPTIONS
      case '|Player Longest Passing Completion|':
        return player_prop_types.GAME_PASSING_LONGEST_COMPLETION
      case '|Player Total Rushing Attempts|':
        return player_prop_types.GAME_RUSHING_ATTEMPTS
      case '|Player Longest Reception|':
        return player_prop_types.GAME_LONGEST_RECEPTION
      case '|Player Total Tackles + Assists|':
        return player_prop_types.GAME_TACKLES_ASSISTS
      case '|Alt Passing Yards|':
        return player_prop_types.GAME_ALT_PASSING_YARDS
      case '|Alt Rushing Yards|':
        return player_prop_types.GAME_ALT_RUSHING_YARDS
      case '|Alt Receiving Yards|':
        return player_prop_types.GAME_ALT_RECEIVING_YARDS
      case '|Alt Receptions|':
        return player_prop_types.GAME_ALT_RECEPTIONS
      case '|Alt Receiving + Rushing Yards|':
        return player_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS
      case '|Alt Longest Completion|':
        return player_prop_types.GAME_ALT_PASSING_LONGEST_COMPLETION
      case '|Alt Interceptions Thrown|':
        return player_prop_types.GAME_ALT_PASSING_INTERCEPTIONS
      case '|Alt Rushing Touchdowns|':
        return player_prop_types.GAME_ALT_RUSHING_TOUCHDOWNS
      case '|Alt Receiving Touchdowns|':
        return player_prop_types.GAME_ALT_RECEIVING_TOUCHDOWNS
      case '|Alt Passing Touchdowns|':
        return player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS
      case '|Alt Passing Attempts|':
        return player_prop_types.GAME_ALT_PASSING_ATTEMPTS
      case '|Alt Passing Completions|':
        return player_prop_types.GAME_ALT_PASSING_COMPLETIONS
      case '|Alt Rushing Attempts|':
        return player_prop_types.GAME_ALT_RUSHING_ATTEMPTS
      case '|Alt Longest Rush|':
        return player_prop_types.GAME_ALT_LONGEST_RUSH
      case '|Alt Longest Reception|':
        return player_prop_types.GAME_ALT_LONGEST_RECEPTION
      case '|Player Total Passing + Rushing Yards|':
        return player_prop_types.GAME_PASSING_RUSHING_YARDS
      case '|Total Receiving + Rushing Yards|':
        return player_prop_types.GAME_RUSHING_RECEIVING_YARDS
      case '|Alt Tackles + Assists|':
        return player_prop_types.GAME_ALT_TACKLES_ASSISTS
      case '|Alt Defensive Interceptions|':
        return player_prop_types.GAME_ALT_DEFENSE_INTERCEPTIONS
      case '|Alt Sacks|':
        return player_prop_types.GAME_ALT_DEFENSE_SACKS

      // Team total points markets. Caesars names these three ways: one market
      // per side ('|Total Home Points|'), and a single template whose
      // market_name carries the team ('|Seattle Seahawks Total Points|').
      case '|Total Home Points|':
      case '|Total Away Points|':
      case '|Team Total Points|':
        return team_game_market_types.GAME_TEAM_TOTAL

      case '|1st Half Spread|':
        return team_game_market_types.GAME_FIRST_HALF_SPREAD

      // Game props
      case '|Will There Be Overtime?|':
        return game_props_types.GAME_OVERTIME
      case '|Winning Margins|':
      case '|Winning Margin|':
        return game_props_types.GAME_WINNING_MARGIN
      case '|1st Scoring Play|':
        return game_props_types.GAME_FIRST_SCORING_PLAY_TYPE
      case '|Race to X Points|':
        return game_props_types.GAME_RACE_TO_POINTS
      // Selections are '<team>/<team>' pairs -- halftime leader over full-time
      // winner, which is what GAME_HALF_TIME_FULL_TIME names.
      case '|Double Result|':
        return game_props_types.GAME_HALF_TIME_FULL_TIME
      case '|First Team To Score|':
        return game_props_types.GAME_FIRST_TO_SCORE
      case '|Highest Scoring Half|':
        return game_props_types.GAME_HIGHEST_SCORING_HALF
      case '|Highest Scoring Quarter|':
        return game_props_types.GAME_HIGHEST_SCORING_QUARTER
      case '|Total Points Odd/Even|':
        return game_props_types.GAME_TOTAL_POINTS_ODD_EVEN

      // Team props -- team grain, carrying a selection_pid
      case '|Team Total Points Odd/Even|':
        return team_props_types.GAME_TEAM_TOTAL_POINTS_ODD_EVEN
      case '|Team Score First And Win|':
        return team_props_types.GAME_TEAM_TO_SCORE_FIRST_AND_WIN

      default:
        log(`no market_type match for template_name: ${template_name}`)
        return null
    }
  }

  if (market_category) {
    switch (market_category) {
      case 'PASSING_TOUCHDOWNS':
        return player_prop_types.GAME_PASSING_TOUCHDOWNS
      case 'PASSING_YARDS':
        return player_prop_types.GAME_PASSING_YARDS
      case 'RUSHING_YARDS':
        return player_prop_types.GAME_RUSHING_YARDS
      case 'RECEIVING_YARDS':
        return player_prop_types.GAME_RECEIVING_YARDS
      case 'RECEPTIONS':
        return player_prop_types.GAME_RECEPTIONS
      case 'RUSHING_RECEIVING_YARDS':
        return player_prop_types.GAME_RUSHING_RECEIVING_YARDS
      case 'PASSING_ATTEMPTS':
        return player_prop_types.GAME_PASSING_ATTEMPTS
      case 'PASSING_COMPLETIONS':
        return player_prop_types.GAME_PASSING_COMPLETIONS
      case 'INTERCEPTIONS':
        return player_prop_types.GAME_PASSING_INTERCEPTIONS
      case 'LONGEST_PASSING_COMPLETION':
        return player_prop_types.GAME_PASSING_LONGEST_COMPLETION
      case 'RUSHING_ATTEMPTS':
        return player_prop_types.GAME_RUSHING_ATTEMPTS
      case 'LONGEST_RECEPTION':
        return player_prop_types.GAME_LONGEST_RECEPTION
      case 'TACKLES_ASSISTS':
        return player_prop_types.GAME_TACKLES_ASSISTS

      default:
        log(`no market_type match for market_category: ${market_category}`)
        return null
    }
  }

  return null
}
