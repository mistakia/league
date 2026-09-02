/*
  nfl_games stores the postseason as season_type POST with week 1-4. No feed
  encodes it that way: nflverse supplies game_type WC/DIV/CON/SB against a
  continuous week counter, NGS supplies weekNameAbbr against the same counter.

  The feed's own week is NOT a usable input to that translation. The counter
  runs straight on from the regular season, so when the regular season went to
  18 games in 2021 every postseason round shifted by one -- wild card reads 18
  through 2020 and 19 from 2021, divisional 19 then 20, and so on. The ROUND
  NAME is stable across that change and the week number is not, which is why
  this map is keyed on the name and why any matcher that compares a stored POST
  week against a feed week can never match a postseason row.

  One table, imported by both importers. A second copy is how the 2021 shift
  gets fixed in one place and not the other.
*/
export const nfl_postseason_week_by_round = Object.freeze({
  WC: 1,
  DIV: 2,
  CON: 3,
  // NGS spells the conference championship CONF; nflverse spells it CON.
  CONF: 3,
  SB: 4
})

export const is_nfl_postseason_round = (week_type) =>
  Object.hasOwn(nfl_postseason_week_by_round, week_type)

/*
  Translate a feed's (week, round-or-season-type) pair to the week nfl_games
  stores. Regular season, preseason, the Hall of Fame game and the Pro Bowl all
  keep the feed's own week; only the four postseason rounds are renumbered.

  Throws on an unmodelled week_type rather than passing the feed week through,
  because a silently-untranslated week produces a row that simply fails to match
  and is indistinguishable from a genuinely missing game.
*/
export const nfl_week_from_week_type = ({ week, week_type }) => {
  if (is_nfl_postseason_round(week_type)) {
    return nfl_postseason_week_by_round[week_type]
  }

  switch (week_type) {
    case 'PRE':
    case 'REG':
    case 'HOF':
    case 'PRO':
      return week

    default:
      throw new Error(`invalid week_type: ${week_type}`)
  }
}
