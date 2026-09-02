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
// keys below are that wire form verbatim. The IMPORTER stores the name with
// pipes STRIPPED, as segment 2 of `source_market_name`. So anything replaying
// this function over stored names must re-wrap:
//
//   get_market_type({ template_name: 'Match Spread' })    -> null
//   get_market_type({ template_name: '|Match Spread|' })  -> GAME_SPREAD
//
// Measured over all 814 distinct stored templates, the bare form types ZERO
// rows and the pipe-wrapped form types 23,046. A backfill that forgets the wrap
// runs to completion having changed nothing.

// A KEY PRESENT WITH A NULL TYPE IS A DECISION; A KEY ABSENT IS A GAP.
//
// That is the whole reason this is a table rather than a switch. A residue
// query over stored templates can then separate the families deliberately left
// untyped, each carrying the reason it was left, from the ones nobody has
// looked at yet. A switch reports both as one undifferentiated pile.

// THERE IS NO market_category FALLBACK, DELIBERATELY.
//
// The retired category switch carried fourteen labels and had never typed a
// market. Two independent measurements: of 451,674 stored Caesars rows only 16
// have a template segment falsy enough to have reached it, and none of the 16
// is typed; and on a live 2026-09-02 payload the only markets lacking a
// `templateName` are empty market objects that carry no `marketCategory`
// either. A market either has a template or has nothing.

export const caesars_market_type_by_template = {
  '|Match Spread|': { market_type: team_game_market_types.GAME_SPREAD },
  '|Money Line|': { market_type: team_game_market_types.GAME_MONEYLINE },
  '|Total Points|': { market_type: team_game_market_types.GAME_TOTAL },
  '|Most Regular Season Passing Yards|': {
    market_type: player_prop_types.SEASON_LEADER_PASSING_YARDS
  },
  '|Most Regular Season Passing Touchdowns|': {
    market_type: player_prop_types.SEASON_LEADER_PASSING_TOUCHDOWNS
  },
  '|Most Regular Season Rushing Yards|': {
    market_type: player_prop_types.SEASON_LEADER_RUSHING_YARDS
  },
  '|Most Regular Season Rushing Touchdowns|': {
    market_type: player_prop_types.SEASON_LEADER_RUSHING_TOUCHDOWNS
  },
  '|Most Regular Season Receiving Yards|': {
    market_type: player_prop_types.SEASON_LEADER_RECEIVING_YARDS
  },
  '|Total Regular Season Passing Yards|': {
    market_type: player_prop_types.SEASON_PASSING_YARDS
  },
  '|Total Regular Season Touchdown Passes|': {
    market_type: player_prop_types.SEASON_PASSING_TOUCHDOWNS
  },
  '|Total Regular Season Rushing Yards|': {
    market_type: player_prop_types.SEASON_RUSHING_YARDS
  },
  '|Total Regular Season Rushing Touchdowns|': {
    market_type: player_prop_types.SEASON_RUSHING_TOUCHDOWNS
  },
  '|Total Regular Season Receiving Yards|': {
    market_type: player_prop_types.SEASON_RECEIVING_YARDS
  },
  '|Total Regular Season Receiving Touchdowns|': {
    market_type: player_prop_types.SEASON_RECEIVING_TOUCHDOWNS
  },
  '|Total Regular Season Sacks|': {
    market_type: player_prop_types.SEASON_DEFENSE_SACKS
  },
  '|First Touchdown Scorer|': {
    market_type: player_prop_types.GAME_FIRST_TOUCHDOWN_SCORER
  },
  '|Anytime Touchdown Scorer|': {
    market_type: player_prop_types.ANYTIME_TOUCHDOWN
  },
  '|Last Touchdown Scorer|': {
    market_type: player_prop_types.GAME_LAST_TOUCHDOWN_SCORER
  },
  '|Player Total Passing Touchdowns|': {
    market_type: player_prop_types.GAME_PASSING_TOUCHDOWNS
  },
  '|Player Total Passing Yards|': {
    market_type: player_prop_types.GAME_PASSING_YARDS
  },
  '|Player Total Rushing Yards|': {
    market_type: player_prop_types.GAME_RUSHING_YARDS
  },
  '|Player Total Receiving Yards|': {
    market_type: player_prop_types.GAME_RECEIVING_YARDS
  },
  '|Player Total Receptions|': {
    market_type: player_prop_types.GAME_RECEPTIONS
  },
  '|Player Total Rushing + Receiving Yards|': {
    market_type: player_prop_types.GAME_RUSHING_RECEIVING_YARDS
  },
  '|Player Total Passing Attempts|': {
    market_type: player_prop_types.GAME_PASSING_ATTEMPTS
  },
  '|Player Total Passing Completions|': {
    market_type: player_prop_types.GAME_PASSING_COMPLETIONS
  },
  '|Player Total Interceptions|': {
    market_type: player_prop_types.GAME_PASSING_INTERCEPTIONS
  },
  '|Player Longest Passing Completion|': {
    market_type: player_prop_types.GAME_PASSING_LONGEST_COMPLETION
  },
  '|Player Total Rushing Attempts|': {
    market_type: player_prop_types.GAME_RUSHING_ATTEMPTS
  },
  '|Player Longest Reception|': {
    market_type: player_prop_types.GAME_LONGEST_RECEPTION
  },
  '|Player Total Tackles + Assists|': {
    market_type: player_prop_types.GAME_TACKLES_ASSISTS
  },
  '|Alt Passing Yards|': {
    market_type: player_prop_types.GAME_ALT_PASSING_YARDS
  },
  '|Alt Rushing Yards|': {
    market_type: player_prop_types.GAME_ALT_RUSHING_YARDS
  },
  '|Alt Receiving Yards|': {
    market_type: player_prop_types.GAME_ALT_RECEIVING_YARDS
  },
  '|Alt Receptions|': { market_type: player_prop_types.GAME_ALT_RECEPTIONS },
  '|Alt Receiving + Rushing Yards|': {
    market_type: player_prop_types.GAME_ALT_RUSHING_RECEIVING_YARDS
  },
  '|Alt Longest Completion|': {
    market_type: player_prop_types.GAME_ALT_PASSING_LONGEST_COMPLETION
  },
  '|Alt Interceptions Thrown|': {
    market_type: player_prop_types.GAME_ALT_PASSING_INTERCEPTIONS
  },
  '|Alt Rushing Touchdowns|': {
    market_type: player_prop_types.GAME_ALT_RUSHING_TOUCHDOWNS
  },
  '|Alt Receiving Touchdowns|': {
    market_type: player_prop_types.GAME_ALT_RECEIVING_TOUCHDOWNS
  },
  '|Alt Passing Touchdowns|': {
    market_type: player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS
  },
  '|Alt Passing Attempts|': {
    market_type: player_prop_types.GAME_ALT_PASSING_ATTEMPTS
  },
  '|Alt Passing Completions|': {
    market_type: player_prop_types.GAME_ALT_PASSING_COMPLETIONS
  },
  '|Alt Rushing Attempts|': {
    market_type: player_prop_types.GAME_ALT_RUSHING_ATTEMPTS
  },
  '|Alt Longest Rush|': {
    market_type: player_prop_types.GAME_ALT_LONGEST_RUSH
  },
  '|Alt Longest Reception|': {
    market_type: player_prop_types.GAME_ALT_LONGEST_RECEPTION
  },
  '|Player Total Passing + Rushing Yards|': {
    market_type: player_prop_types.GAME_PASSING_RUSHING_YARDS
  },
  '|Total Receiving + Rushing Yards|': {
    market_type: player_prop_types.GAME_RUSHING_RECEIVING_YARDS
  },
  '|Alt Tackles + Assists|': {
    market_type: player_prop_types.GAME_ALT_TACKLES_ASSISTS
  },
  '|Alt Defensive Interceptions|': {
    market_type: player_prop_types.GAME_ALT_DEFENSE_INTERCEPTIONS
  },
  '|Alt Sacks|': { market_type: player_prop_types.GAME_ALT_DEFENSE_SACKS },
  // Team total points markets. Caesars names these three ways: one market
  // per side ('|Total Home Points|'), and a single template whose market_name
  // carries the team ('|Seattle Seahawks Total Points|').
  '|Total Home Points|': {
    market_type: team_game_market_types.GAME_TEAM_TOTAL
  },
  '|Total Away Points|': {
    market_type: team_game_market_types.GAME_TEAM_TOTAL
  },
  '|Team Total Points|': {
    market_type: team_game_market_types.GAME_TEAM_TOTAL
  },
  '|1st Half Spread|': {
    market_type: team_game_market_types.GAME_FIRST_HALF_SPREAD
  },
  '|Will There Be Overtime?|': { market_type: game_props_types.GAME_OVERTIME },
  '|Winning Margins|': { market_type: game_props_types.GAME_WINNING_MARGIN },
  '|Winning Margin|': { market_type: game_props_types.GAME_WINNING_MARGIN },
  '|1st Scoring Play|': {
    market_type: game_props_types.GAME_FIRST_SCORING_PLAY_TYPE
  },
  '|Race to X Points|': { market_type: game_props_types.GAME_RACE_TO_POINTS },
  // Selections are <team>/<team> pairs -- halftime leader over full-time
  // winner, which is what GAME_HALF_TIME_FULL_TIME names.
  '|Double Result|': { market_type: game_props_types.GAME_HALF_TIME_FULL_TIME },
  '|First Team To Score|': {
    market_type: game_props_types.GAME_FIRST_TO_SCORE
  },
  '|Highest Scoring Half|': {
    market_type: game_props_types.GAME_HIGHEST_SCORING_HALF
  },
  '|Highest Scoring Quarter|': {
    market_type: game_props_types.GAME_HIGHEST_SCORING_QUARTER
  },
  '|Total Points Odd/Even|': {
    market_type: game_props_types.GAME_TOTAL_POINTS_ODD_EVEN
  },
  '|Team Total Points Odd/Even|': {
    market_type: team_props_types.GAME_TEAM_TOTAL_POINTS_ODD_EVEN
  },
  '|Team Score First And Win|': {
    market_type: team_props_types.GAME_TEAM_TO_SCORE_FIRST_AND_WIN
  },

  // Kicking. Still published in the v4 era, unlike the team stat totals and
  // SB Micro families. '|Player Total Made Field Goals|' needed no new
  // constant -- GAME_FIELD_GOALS_MADE already existed and was simply never
  // wired to a template.
  '|Player Total Kicking Points|': {
    market_type: player_prop_types.GAME_KICKING_POINTS
  },
  '|Player Total Made Field Goals|': {
    market_type: player_prop_types.GAME_FIELD_GOALS_MADE
  },
  '|Player Total Made Extra Points|': {
    market_type: player_prop_types.GAME_EXTRA_POINTS_MADE
  },
  '|Alt Kicking Points|': {
    market_type: player_prop_types.GAME_ALT_KICKING_POINTS
  },
  '|Alt Made Field Goals|': {
    market_type: player_prop_types.GAME_ALT_FIELD_GOALS_MADE
  },
  '|Alt Made Extra Points|': {
    market_type: player_prop_types.GAME_ALT_EXTRA_POINTS_MADE
  },

  // Period-scoped game lines. Caesars renamed its second-half markets between
  // eras -- the stored rows carry the explicit '(Inc. OT)' suffix and the live
  // v4 feed carries the bare name -- so both forms are keyed to one type.
  '|1st Half Money Line|': {
    market_type: team_game_market_types.GAME_FIRST_HALF_MONEYLINE
  },
  '|1st Half Total Points|': {
    market_type: team_game_market_types.GAME_FIRST_HALF_TOTAL
  },
  '|2nd Half Spread|': {
    market_type: team_game_market_types.GAME_SECOND_HALF_SPREAD
  },
  '|2nd Half Spread (Inc. OT)|': {
    market_type: team_game_market_types.GAME_SECOND_HALF_SPREAD
  },
  '|2nd Half Money Line|': {
    market_type: team_game_market_types.GAME_SECOND_HALF_MONEYLINE
  },
  '|2nd Half Total Points|': {
    market_type: team_game_market_types.GAME_SECOND_HALF_TOTAL
  },
  '|2nd Half Total Points (Inc. OT)|': {
    market_type: team_game_market_types.GAME_SECOND_HALF_TOTAL
  },
  '|1st Quarter Money Line|': {
    market_type: team_game_market_types.GAME_FIRST_QUARTER_MONEYLINE
  },
  '|1st Quarter Spread|': {
    market_type: team_game_market_types.GAME_FIRST_QUARTER_SPREAD
  },
  '|1st Quarter Total Points|': {
    market_type: team_game_market_types.GAME_FIRST_QUARTER_TOTAL
  },

  // Deliberate no-maps. Present with a null type so a residue query reports
  // them as decided rather than as an unexamined gap.
  '|Team Total Team Defensive Tackles|': {
    market_type: null,
    reason:
      'Ambiguous statistic. The only player-side tackle constants are the combined GAME_TACKLES_ASSISTS and GAME_ALT_TACKLES_ASSISTS, and Caesars does not publish whether this team aggregate counts tackles plus assists or solo tackles. A settlement handler would sum whichever the constant name claimed, so coining one without the vendor terms would encode a guess as a grade.'
  }
}

export const get_market_type = ({ template_name }) => {
  if (!template_name) {
    return null
  }

  // hasOwn rather than a bare lookup: a template that happened to be named
  // 'constructor' would otherwise resolve off Object.prototype and return a
  // function instead of null.
  if (!Object.hasOwn(caesars_market_type_by_template, template_name)) {
    log(`no table entry for template_name: ${template_name}`)
    return null
  }

  return caesars_market_type_by_template[template_name].market_type
}
