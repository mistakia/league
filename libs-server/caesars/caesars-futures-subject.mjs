import { fixTeam } from '#libs-shared/index.mjs'

// WHY THIS EXISTS: THE SUBJECT IS IN `name`, NOT IN `templateName`.
//
// A futures market about one player carries a GENERIC template and puts the
// player in the market name:
//
//   templateName  "|Player| |Total Regular Season Passing Yards|"
//   name          "|Cam Ward| |Total Regular Season Passing Yards|"
//
// The importer's existing attribution reads `metadata.player`, and 310 of the
// 318 player futures markets measured on 2026-09-04 DO NOT CARRY IT -- the feed
// is inconsistent within a single template, with 8 of the 26 sacks markets
// carrying metadata and 18 not. Attributing from metadata alone therefore leaves
// almost every player future with a null selection_pid, which collapses a whole
// template's markets onto one key. That collapse is not hypothetical; repairing
// the team-grain version of it on game markets took a full day and an adhoc
// backfill.
//
// Selections cannot supply the subject either: zero of the 13,203 futures
// selections carry any metadata at all.

const TEMPLATE_SEGMENT_SEPARATOR = '| |'

const strip_pipes = (value) => value.replaceAll('|', '').trim()

// ONLY A PLACEHOLDER LEADING SEGMENT MEANS THERE IS A SUBJECT TO READ.
//
// Multi-segment templates split three ways, measured over the 681 multi-segment
// markets on 2026-09-04:
//
//   '|Player| |...|'  318  the feed substitutes a real player into `name`
//   '|Team| |...|'    316  the feed substitutes a real team into `name`
//   literal leading    47  `name` equals `templateName`, nothing substituted
//
// That third group is overwhelmingly the STATISTIC-FIRST arrangement --
// '|Most Passing Yards| |Regular Season - Individual Player|' and 43 more like
// it -- where the leading segment is the statistic and the SELECTIONS are the
// players. Reading position blindly would attribute those markets to a player
// named 'Most Passing Yards'.
//
// So the leading segment is only a subject when it is one of these
// placeholders. The cost is three markets in that literal group that really do
// name a subject -- '|AFC| |Top Conference Seed|', its NFC twin, and
// '|Nik Bonitto| |Total Regular Season Sacks|', where the feed embedded a live
// player name in the template itself. The conference markets lose nothing, since
// a conference is not a pid and their selections are teams. Bonitto's market
// keeps a null subject, which is the honest answer: distinguishing his name from
// a statistic needs a roster lookup on every leading segment, and guessing wrong
// in the other 44 cases is far worse than declining in one.
const SUBJECT_PLACEHOLDER_SEGMENTS = new Set(['Player', 'Team'])

// WHICH POSITIONS CAN POST THIS STATISTIC -- A DISAMBIGUATOR, NOT A CLASSIFIER.
//
// The player table holds three Josh Allens (QB BUF, DL JAX, and a retired OL)
// and two active Justin Jeffersons (WR MIN, LB CLE). `_select_best_match`
// returns null on multiple matches by design rather than guessing, so those two
// names cost 9 futures markets their `selection_pid` on every run.
//
// A position set breaks the tie without introducing a guess, because the caller
// applies it as a SECOND pass and `_select_best_match` still refuses on more
// than one survivor. So the failure modes are bounded in both directions: a set
// that is too narrow leaves the null it was called to resolve, and a set that is
// too wide leaves the ambiguity that produced the null. Neither can invent a
// pid.
//
// Sets are deliberately generous, and the positions are spelled the way
// `player.primary_position` spells them -- DL, DE, DT and NT all occur, as do
// LB, ILB, OLB, MLB and EDGE. Rushing includes QB because a quarterback's
// rushing total is exactly the Josh Allen market this exists for.
const SUBJECT_POSITIONS_BY_STATISTIC = [
  [/Passing|Touchdown Passes|Interceptions Thrown/i, ['QB']],
  [/Rushing/i, ['QB', 'RB', 'FB', 'WR', 'TE']],
  [/Receiving|Receptions/i, ['WR', 'TE', 'RB', 'FB']],
  [
    /Sacks|Tackles/i,
    ['DL', 'DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'MLB', 'EDGE']
  ]
]

/**
 * Positions that could plausibly post the statistic a futures template names.
 *
 * Returns an empty array when the statistic matches nothing, which the caller
 * treats as "no disambiguation available" rather than as "no player qualifies".
 *
 * Order matters and the FIRST match wins: 'Passing + Rushing Yards' is a
 * quarterback market, and a rushing-first reading would widen it to four more
 * positions for no gain.
 */
export const get_caesars_futures_subject_positions = (statistic_segment) => {
  if (!statistic_segment) {
    return []
  }

  for (const [pattern, positions] of SUBJECT_POSITIONS_BY_STATISTIC) {
    if (pattern.test(statistic_segment)) {
      return positions
    }
  }

  return []
}

/**
 * Identify who or what a Caesars futures market is about.
 *
 * Returns one of:
 *   { player_name }  -- a market about one named player
 *   { nfl_team }     -- a market about one team, normalised to league's abbreviation
 *   null             -- the market has no single subject
 *
 * The null case is a real answer, not a failure. 861 of the 1,542 futures
 * markets are single-segment templates -- 'First Touchdown Scorer', 'Division
 * Winner', 'Regular Season MVP', yes/no propositions -- where the SELECTION is
 * the subject and the market is the question. Inventing a market-level subject
 * for those would be wrong, so this module declines rather than guesses.
 */
export const get_caesars_futures_subject = ({
  template_name,
  name,
  metadata
} = {}) => {
  if (!template_name || !name) {
    return null
  }

  const template_segments = template_name.split(TEMPLATE_SEGMENT_SEPARATOR)

  // Single-segment template: the selection carries the subject.
  if (template_segments.length === 1) {
    return null
  }

  const leading_segment = strip_pipes(template_segments[0])

  if (!SUBJECT_PLACEHOLDER_SEGMENTS.has(leading_segment)) {
    return null
  }

  const name_segments = name.split(TEMPLATE_SEGMENT_SEPARATOR)

  // THE ASSERTION IS THE GUARD, AND IT IS WHY THIS CAN PARSE BY POSITION.
  //
  // Taking `name`'s leading segment as the subject is only safe while the two
  // strings are aligned. Measured across all 318 player futures markets, the
  // trailing segment of `name` equals the trailing segment of `templateName` in
  // 318 of 318, with zero exceptions -- so a mismatch means the name shape has
  // drifted and position no longer means what it meant. Refuse rather than
  // return a confidently wrong player.
  if (
    name_segments.length !== template_segments.length ||
    name_segments[name_segments.length - 1] !==
      template_segments[template_segments.length - 1]
  ) {
    throw new Error(
      `caesars futures subject: name '${name}' does not align with template '${template_name}'. The trailing segments must match for the leading segment to be the subject.`
    )
  }

  const subject = strip_pipes(name_segments[0])

  // THE PLACEHOLDER DECIDES THE GRAIN, NOT THE METADATA.
  //
  // Eight of the 318 player markets carry a metadata.teamAbbr naming the
  // player's club. Reading team metadata before checking the placeholder would
  // attribute those eight to a TEAM -- turning eight player season totals into
  // team markets, and doing it only for the handful the feed happened to
  // enrich, which is the most confusing possible subset.
  if (leading_segment === 'Team') {
    // TEAM MARKETS NEED NO PARSE: all 316 carry metadata.teamAbbr. It still
    // goes through fixTeam, because Caesars writes the Rams as 'LAR' while
    // league's canonical abbreviation is 'LA' -- the raw value would store a
    // team code nothing else in the database uses. fixTeam maps both spellings,
    // and the full team name in the market's leading segment, onto one answer.
    const team_source = metadata?.teamAbbr
      ? strip_pipes(metadata.teamAbbr)
      : subject

    return team_source ? { nfl_team: fixTeam(team_source) } : null
  }

  if (!subject) {
    return null
  }

  // The statistic segment is the LAST one, and the alignment assertion above has
  // already proved it is the same in `name` and in `templateName`.
  return {
    player_name: subject,
    positions: get_caesars_futures_subject_positions(
      strip_pipes(template_segments[template_segments.length - 1])
    )
  }
}
