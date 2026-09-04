import debug from 'debug'

import {
  player_prop_types,
  team_game_market_types,
  game_props_types,
  team_props_types,
  awards_prop_types,
  futures_types,
  team_season_types,
  division_specials_types,
  player_season_prop_types,
  season_high_totals_types
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

  // Both teams' field goals combined. GAME grain despite the name reading like
  // the team family above it -- the market name is a bare 'Total Field Goals'
  // with no team prefix, and it is still being published.
  '|Total Match Field Goals|': {
    market_type: team_game_market_types.GAME_TOTAL_FIELD_GOALS_MADE
  },

  // Team statistic totals. One market per team from one template, bare
  // over/under selections, the team carried only by a prefix on the market
  // name -- so the importer must set selection_pid from that prefix or the two
  // teams collapse onto one key. See
  // libs-server/caesars/caesars-team-attribution.mjs.
  //
  // Caesars has not published this family since 2025-02-07, so these entries
  // are what makes the stored history readable rather than a forward claim. The
  // ' Live' variant of the rushing-touchdowns template is deliberately absent;
  // the table is exact match, so it stays untyped.
  '|Team Total Team Touchdowns|': {
    market_type: team_game_market_types.GAME_TEAM_TOUCHDOWNS
  },
  '|Team Total Team Offense Touchdowns|': {
    market_type: team_game_market_types.GAME_TEAM_OFFENSE_TOUCHDOWNS
  },
  '|Team Total Team Passing Yards|': {
    market_type: team_game_market_types.GAME_TEAM_PASSING_YARDS
  },
  '|Team Total Team Passing Touchdowns|': {
    market_type: team_game_market_types.GAME_TEAM_PASSING_TOUCHDOWNS
  },
  '|Team Total Team Rushing Yards|': {
    market_type: team_game_market_types.GAME_TEAM_RUSHING_YARDS
  },
  '|Team Total Team Rushing Touchdowns|': {
    market_type: team_game_market_types.GAME_TEAM_RUSHING_TOUCHDOWNS
  },
  '|Team Total Team Rushing Attempts|': {
    market_type: team_game_market_types.GAME_TEAM_RUSHING_ATTEMPTS
  },
  '|Team Total Team Receiving Yards|': {
    market_type: team_game_market_types.GAME_TEAM_RECEIVING_YARDS
  },
  '|Team Total Team Receiving Touchdowns|': {
    market_type: team_game_market_types.GAME_TEAM_RECEIVING_TOUCHDOWNS
  },
  '|Team Total Team Receptions|': {
    market_type: team_game_market_types.GAME_TEAM_RECEPTIONS
  },

  // Deliberate no-maps. Present with a null type so a residue query reports
  // them as decided rather than as an unexamined gap.
  '|Team Total Team Defensive Tackles|': {
    market_type: null,
    reason:
      'Ambiguous statistic. The only player-side tackle constants are the combined GAME_TACKLES_ASSISTS and GAME_ALT_TACKLES_ASSISTS, and Caesars does not publish whether this team aggregate counts tackles plus assists or solo tackles. A settlement handler would sum whichever the constant name claimed, so coining one without the vendor terms would encode a guess as a grade.'
  },

  // ===========================================================================
  // FUTURES -- the season-long families, dark since 2025-02-20.
  // ===========================================================================
  //
  // Two key SHAPES below, and which one a template gets is not cosmetic.
  //
  // SUBJECT-FIRST templates ('|Team| |Regular Season Wins|') are keyed by their
  // STRIPPED form ('|Regular Season Wins|'), because the leading segment is the
  // subject and the feed substitutes real names into it -- '|Nik Bonitto| |Total
  // Regular Season Sacks|' is a real template. Keying the stripped form types
  // the whole family and never enumerates a player.
  //
  // STATISTIC-FIRST templates ('|Most Passing Yards| |Regular Season -
  // Individual Player|') are keyed by their FULL name, because their trailing
  // segment is a bare scope shared by twenty-one different statistics. See
  // FORBIDDEN_TEMPLATE_TABLE_KEYS below.

  // Team season totals and standings. Keyed stripped; the subject is the team,
  // carried on metadata.teamAbbr.
  '|Regular Season Wins|': {
    market_type: team_season_types.TEAM_REGULAR_SEASON_WINS
  },
  '|Regular Season Team Total Points|': {
    market_type: team_season_types.TEAM_REGULAR_SEASON_POINTS
  },
  '|To Make The Playoffs|': {
    market_type: team_season_types.TEAM_TO_MAKE_PLAYOFFS
  },
  '|Stage Of Elimination|': {
    market_type: futures_types.STAGE_OF_ELIMINATION
  },
  '|Regular Season Division Wins|': {
    market_type: division_specials_types.DIVISION_WINS
  },
  '|Best Regular Season Record|': {
    market_type: team_season_types.TEAM_MOST_REGULAR_SEASON_WINS
  },
  '|Worst Regular Season Record|': {
    market_type: team_season_types.TEAM_FEWEST_REGULAR_SEASON_WINS
  },
  '|Team To Go 17-0|': { market_type: team_season_types.TEAM_PERFECT_SEASON },
  '|Team To Go 0-17|': { market_type: team_season_types.TEAM_WINLESS_SEASON },

  // Championship and division futures.
  '|Super Bowl 61 Winner|': { market_type: futures_types.SUPER_BOWL_WINNER },
  '|Super Bowl Exacta|': { market_type: futures_types.NAME_THE_FINALISTS },
  '|Super Bowl Winning Division|': {
    market_type: futures_types.WINNING_DIVISION
  },
  '|First Time Super Bowl Winner|': {
    market_type: futures_types.FIRST_TIME_WINNER
  },
  '|Pro Football Conference Winner|': {
    market_type: futures_types.CONFERENCE_WINNER
  },
  '|Division Winner|': { market_type: futures_types.DIVISION_WINNER },
  '|Division Exacta 1-2|': {
    market_type: division_specials_types.DIVISION_STRAIGHT_FORECAST
  },
  '|Division Exact Order|': {
    market_type: division_specials_types.DIVISION_EXACT_ORDER
  },
  // Stripped from '|AFC| |Top Conference Seed|' and its NFC twin -- the
  // conference is the subject segment, so both resolve through one key.
  '|Top Conference Seed|': { market_type: futures_types.NUMBER_1_SEED },

  // Awards.
  '|Regular Season MVP|': { market_type: awards_prop_types.SEASON_MVP },
  '|Offensive Player Of The Year|': {
    market_type: awards_prop_types.OFFENSIVE_PLAYER_OF_THE_YEAR
  },
  '|Defensive Player Of The Year Award|': {
    market_type: awards_prop_types.DEFENSIVE_PLAYER_OF_THE_YEAR
  },
  '|Offensive Rookie Of The Year|': {
    market_type: awards_prop_types.OFFENSIVE_ROOKIE_OF_THE_YEAR
  },
  '|Defensive Rookie Of The Year|': {
    market_type: awards_prop_types.DEFENSIVE_ROOKIE_OF_THE_YEAR
  },
  '|Comeback Player Of The Year|': {
    market_type: awards_prop_types.COMEBACK_PLAYER_OF_THE_YEAR
  },
  '|Coach Of The Year Award|': {
    market_type: awards_prop_types.COACH_OF_THE_YEAR
  },

  // Player season totals, keyed stripped from the '|Player| |...|' family.
  '|Total Regular Season Receptions|': {
    market_type: player_season_prop_types.SEASON_RECEPTIONS
  },

  // Player season ALTERNATE thresholds -- 'X+' lines on a season total.
  '|Player To Record X+ Passing Yards|': {
    market_type: player_season_prop_types.SEASON_ALT_PASSING_YARDS
  },
  '|Player To Record X+ Passing Touchdowns|': {
    market_type: player_season_prop_types.SEASON_ALT_PASSING_TOUCHDOWNS
  },
  '|Player To Record X+ Rushing Yards|': {
    market_type: player_season_prop_types.SEASON_ALT_RUSHING_YARDS
  },
  '|Player To Record X+ Rushing Touchdowns|': {
    market_type: player_season_prop_types.SEASON_ALT_RUSHING_TOUCHDOWNS
  },
  '|Player To Record X+ Receiving Yards|': {
    market_type: player_season_prop_types.SEASON_ALT_RECEIVING_YARDS
  },
  '|Player To Record X+ Receiving Touchdowns|': {
    market_type: player_season_prop_types.SEASON_ALT_RECEIVING_TOUCHDOWNS
  },
  '|Player To Record X+ Sacks|': {
    market_type: player_season_prop_types.SEASON_ALT_SACKS
  },

  // Season leaders published as a bare single-segment template.
  '|Most Regular Season Receiving Touchdowns|': {
    market_type: player_prop_types.SEASON_LEADER_RECEIVING_TOUCHDOWNS
  },
  '|Most Regular Season Reception|': {
    market_type: player_prop_types.SEASON_LEADER_RECEPTIONS
  },
  '|Most Regular Season Sacks|': {
    market_type: player_prop_types.SEASON_LEADER_SACKS
  },
  '|Most Regular Season Interceptions Thrown|': {
    market_type: null,
    reason:
      'SEASON_LEADER_INTERCEPTIONS is the DEFENSIVE leader -- interceptions caught. This market is interceptions THROWN, the quarterback side, and the two settle from opposite columns. Mapping them together would grade every quarterback against defenders. The statistic-first twin below carries the same market under a scoped template and is typed there.'
  },
  '|Most Regular Season Tackles And Assists|': {
    market_type: null,
    reason:
      'No season-long tackles constant exists, and the game-grain GAME_TACKLES_ASSISTS is a different grain rather than a candidate. Same reason the team tackles template above is left untyped: coining one without the vendor terms would encode a guess as a grade.'
  },
  '|Most Regular Season Rookie Receiving Yards|': {
    market_type: null,
    reason:
      'Rookie-scoped leader. SEASON_LEADER_RECEIVING_YARDS is the league-wide leader and its settlement would grade against the whole league, so the two are not interchangeable. No rookie-scoped constant exists.'
  },

  // ---------------------------------------------------------------------------
  // STATISTIC-FIRST templates. Keyed by their FULL name, never by the trailing
  // scope segment they share.
  // ---------------------------------------------------------------------------
  '|Most Passing Yards| |Regular Season - Individual Player|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_PASSING_YARDS
  },
  '|Most Passing Touchdowns| |Regular Season - Individual Player|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_PASSING_TOUCHDOWNS
  },
  '|Most Rushing Yards| |Regular Season - Individual Player|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_RUSHING_YARDS
  },
  '|Most Rushing Touchdowns| |Regular Season - Individual Player|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_RUSHING_TOUCHDOWNS
  },
  '|Most Receiving Yards| |Regular Season - Individual Player|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_RECEIVING_YARDS
  },
  '|Most Receiving Touchdowns| |Regular Season - Individual Player|': {
    market_type:
      season_high_totals_types.SEASON_LEAGUE_HIGH_RECEIVING_TOUCHDOWNS
  },
  '|Most Receptions| |Regular Season - Individual Player|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_RECEPTIONS
  },
  '|Most Sacks| |Regular Season - Individual Player|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_SACKS
  },
  '|Most Interceptions By Defensive Player| |Regular Season - Individual Player|':
    {
      market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_INTERCEPTIONS
    },
  '|Most Passing Completions| |Regular Season - Individual Player|': {
    market_type: null,
    reason:
      'No season-long completions constant. SEASON_PASSING_COMPLETIONS is a per-player season total, not the league leader, so it would grade one player rather than the field.'
  },
  '|Most Interceptions Thrown| |Regular Season - Individual Player|': {
    market_type: null,
    reason:
      'No league-high constant for interceptions THROWN. SEASON_LEAGUE_HIGH_INTERCEPTIONS is the defensive side -- interceptions caught -- and grading quarterbacks against it would settle from the wrong column.'
  },

  // The single-game highs, same family, distinguished only by 'In a Single
  // Game'. These are league-wide season-long markets about the best individual
  // GAME anyone posts, which is why they are season_high_totals and not a game
  // grain.
  '|Most Passing Yards In a Single Game| |Regular Season - Individual Player|':
    {
      market_type:
        season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_PASSING_YARDS
    },
  '|Most Passing Touchdowns In a Single Game| |Regular Season - Individual Player|':
    {
      market_type:
        season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_PASSING_TOUCHDOWNS
    },
  '|Most Rush Yards In a Single Game| |Regular Season - Individual Player|': {
    market_type:
      season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_RUSHING_YARDS
  },
  '|Most Rush Touchdowns In a Single Game| |Regular Season - Individual Player|':
    {
      market_type:
        season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_RUSHING_TOUCHDOWNS
    },
  '|Most Receiving Yards In a Single Game| |Regular Season - Individual Player|':
    {
      market_type:
        season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_RECEIVING_YARDS
    },
  '|Most Receiving Touchdowns In a Single Game| |Regular Season - Individual Player|':
    {
      market_type:
        season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_RECEIVING_TOUCHDOWNS
    },
  '|Most Receptions In a Single Game| |Regular Season - Individual Player|': {
    market_type:
      season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_RECEPTIONS
  },
  '|Most Sacks In a Single Game| |Regular Season - Individual Player|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_SACKS
  },
  '|Most Interceptions By Defensive Player In Single Game| |Regular Season - Individual Player|':
    {
      market_type:
        season_high_totals_types.SEASON_LEAGUE_HIGH_SINGLE_GAME_INTERCEPTIONS
    },
  '|Most Interceptions Thrown In a Single Game| |Regular Season - Individual Player|':
    {
      market_type: null,
      reason:
        'Interceptions THROWN, not caught. Same column mismatch as its season-long twin above.'
    },
  '|Longest Rush| |Regular Season|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_LONGEST_RUSH
  },
  '|Longest Reception| |Regular Season|': {
    market_type: season_high_totals_types.SEASON_LEAGUE_LONGEST_RECEPTION
  },
  '|Total Overtime Games| |Regular Season|': {
    market_type: null,
    reason:
      'League-wide count of games going to overtime. No constant exists for a season-long league game-count proposition, and every season_high_totals member is a player statistic, so none is a candidate.'
  },
  '|Total Games Ending In a Tie| |Regular Season|': {
    market_type: null,
    reason:
      'Same family as the overtime-games count above and left untyped for the same reason.'
  },

  // ---------------------------------------------------------------------------
  // Deliberate no-maps in the futures families.
  // ---------------------------------------------------------------------------
  '|Alternate Regular Season Wins|': {
    market_type: team_season_types.TEAM_ALT_REGULAR_SEASON_WINS
  },
  '|Exact Win Total After First 5 Weeks|': {
    market_type: team_season_types.TEAM_EXACT_WINS_AFTER_FIRST_FIVE_WEEKS
  },
  '|Specials|': {
    market_type: null,
    reason:
      "Stripped from '|Team| |Specials|'. A per-team grab-bag whose selections carry the actual proposition, so one market type cannot describe it. Present as a decision rather than a gap."
  },
  '|Regular Season Specials|': {
    market_type: null,
    reason:
      'Undifferentiated specials grab-bag, same shape as the team specials above.'
  },
  '|NFL Award Specials|': {
    market_type: null,
    reason:
      'Award grab-bag spanning several awards in one market. The individual awards each have their own template and constant above; this one cannot be reduced to a single award.'
  },
  '|Rings & Recognition Specials|': {
    market_type: null,
    reason:
      'Cross-family promotional grab-bag combining championship and award propositions in one market.'
  },
  '|Highest Scoring Game|': {
    market_type: null,
    reason:
      'League-wide leader over games, not a team or player statistic. No constant covers a season-long superlative whose subject is a game.'
  },
  '|Lowest Scoring Game|': {
    market_type: null,
    reason: 'Same family as the highest-scoring-game market above.'
  },
  '|Highest Scoring Team|': {
    market_type: null,
    reason:
      'League-wide leader across teams. TEAM_REGULAR_SEASON_POINTS is a per-team season total whose settlement grades one team against a line, not teams against each other.'
  },
  '|Lowest Scoring Team|': {
    market_type: null,
    reason: 'Same family as the highest-scoring-team market above.'
  },
  '|Any Team To Go 17-0|': {
    market_type: null,
    reason:
      'League-wide yes/no. TEAM_PERFECT_SEASON is team-grain and settles per team, so mapping this to it would attach a league proposition to whichever team the selection named.'
  },
  '|Any Team To Go 0-17|': {
    market_type: null,
    reason: 'League-wide twin of the undefeated market above.'
  },
  '|Last Undefeated Team|': {
    market_type: null,
    reason:
      'Settles on WHICH team stays undefeated longest, not on whether a given team runs the table, so TEAM_PERFECT_SEASON is not a candidate.'
  },
  '|Last Winless Team|': {
    market_type: null,
    reason: 'Twin of the last-undefeated market above.'
  },
  '|Most Tight End Receiving Yards|': {
    market_type: null,
    reason:
      'Position-scoped leader. SEASON_LEADER_RECEIVING_YARDS settles across all receivers, so the two would grade different fields.'
  },
  '|Most Passing Yards|': {
    market_type: null,
    reason:
      "Bare leader template with no scope segment, published in the September Specials tab alongside its explicitly scoped twin '|Most Regular Season Passing Yards|'. Caesars does not state whether the bare form means the season or the opening window, and the two settle on different periods."
  },
  '|Most Passing Touchdowns|': {
    market_type: null,
    reason: 'Bare unscoped leader template; same ambiguity as passing yards.'
  },
  '|Most Rushing Yards|': {
    market_type: null,
    reason: 'Bare unscoped leader template; same ambiguity as passing yards.'
  },
  '|Most Rushing Touchdowns|': {
    market_type: null,
    reason: 'Bare unscoped leader template; same ambiguity as passing yards.'
  },
  '|Most Receiving Yards|': {
    market_type: null,
    reason: 'Bare unscoped leader template; same ambiguity as passing yards.'
  },
  '|Most Receiving Touchdowns|': {
    market_type: null,
    reason: 'Bare unscoped leader template; same ambiguity as passing yards.'
  },

  // The combined-statistic season totals. Four templates, all of the
  // '|Player| |Total Regular Season A + B|' shape, left untyped pending the
  // decision on whether to coin into player_season_prop_types -- the one
  // constant group that reaches a user-facing Market picker.
  '|Total Regular Season Passing + Rushing Yards|': {
    market_type: null,
    reason:
      'Combined passing and rushing yards. No constant sums two statistics, and mapping to either half would grade against half the market. Coining SEASON_PASSING_RUSHING_YARDS reaches the user-facing Market picker, so it is an operator decision rather than a free wiring.'
  },
  '|Total Regular Season Passing + Rushing Touchdowns|': {
    market_type: null,
    reason: 'Combined-statistic season total; same decision as the yards twin.'
  },
  '|Total Regular Season Rushing + Receiving Yards|': {
    market_type: null,
    reason: 'Combined-statistic season total; same decision as the yards twin.'
  },
  '|Total Regular Season Rushing + Receiving Touchdowns|': {
    market_type: null,
    reason: 'Combined-statistic season total; same decision as the yards twin.'
  }
}

// THE SEPARATOR BETWEEN TEMPLATE SEGMENTS.
//
// Measured over a live 2026-09-04 crawl of all 16 competition tabs: 48 of the
// 146 distinct templates carry more than one segment, and every one of them
// uses exactly this separator. Splitting on it yields segments whose OUTER
// pipes are preserved and whose inner ones are consumed, so
// '|Player| |Total Regular Season Sacks|' splits to
// ['|Player', 'Total Regular Season Sacks|'] and rejoining a suffix with a
// leading '|' restores the wire form exactly.
const TEMPLATE_SEGMENT_SEPARATOR = '| |'

// SCOPE SEGMENTS THAT MUST NEVER BECOME TABLE KEYS.
//
// The multi-segment templates come in two OPPOSITE arrangements. Most carry the
// subject first and the statistic last ('|Player| |Total Regular Season
// Sacks|'), but 26 carry the statistic FIRST and a bare scope last ('|Most
// Passing Yards| |Regular Season - Individual Player|').
//
// So a rule that looked up the TRAILING segment would collapse every statistic
// sharing a scope onto one key -- 21 distinct statistics onto 'Regular Season -
// Individual Player' alone -- and would do it SILENTLY, typing twenty-one
// different markets identically rather than failing. That is why the lookup
// below is full-key-first, and why these two keys are forbidden outright: with
// them absent, a statistic-first template can only ever resolve by its full
// name, and the retry branch can only miss.
export const FORBIDDEN_TEMPLATE_TABLE_KEYS = [
  '|Regular Season|',
  '|Regular Season - Individual Player|'
]

for (const forbidden_key of FORBIDDEN_TEMPLATE_TABLE_KEYS) {
  if (Object.hasOwn(caesars_market_type_by_template, forbidden_key)) {
    throw new Error(
      `caesars-market-types: '${forbidden_key}' is a bare SCOPE segment shared by many distinct statistics, not a market template. Keying it silently types every statistic under that scope identically. Key the full template name instead.`
    )
  }
}

/**
 * Resolve a Caesars `templateName` to a market type.
 *
 * Full verbatim lookup FIRST, subject-stripped retry SECOND. The order is the
 * whole design:
 *
 *  1. The statistic-first templates carry their scope in the trailing segment
 *     and are keyed by their full name, so they resolve at step one and never
 *     reach the retry.
 *  2. The subject-first templates ('|Player| |...|', '|Team| |...|') are keyed
 *     by the stripped generic form, so they resolve at step two.
 *
 * Step two is also what absorbs proper-name churn. `templateName` is not a
 * closed enum -- the feed embeds live player names in it, so
 * '|Nik Bonitto| |Total Regular Season Sacks|' appears alongside the generic
 * '|Player| |Total Regular Season Sacks|'. Both strip to the same generic key,
 * and the table never has to enumerate a player who will be gone next season.
 */
export const get_market_type = ({ template_name }) => {
  if (!template_name) {
    return null
  }

  // hasOwn rather than a bare lookup: a template that happened to be named
  // 'constructor' would otherwise resolve off Object.prototype and return a
  // function instead of null.
  if (Object.hasOwn(caesars_market_type_by_template, template_name)) {
    return caesars_market_type_by_template[template_name].market_type
  }

  const segments = template_name.split(TEMPLATE_SEGMENT_SEPARATOR)

  if (segments.length > 1) {
    const subject_stripped_key = `|${segments.slice(1).join(TEMPLATE_SEGMENT_SEPARATOR)}`

    if (Object.hasOwn(caesars_market_type_by_template, subject_stripped_key)) {
      return caesars_market_type_by_template[subject_stripped_key].market_type
    }
  }

  log(`no table entry for template_name: ${template_name}`)
  return null
}
