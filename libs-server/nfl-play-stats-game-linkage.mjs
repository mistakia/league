/*
  Every `nfl_play_stats` row's esbid resolves to an `nfl_games` row.

  ## Why this is a check and not an un-gradeable footnote

  Three registered checks already meet this population and each hands it on
  rather than owning it. `nfl-team-abbreviation-conformance` emits it as a
  zero-denominator un-gradeable row, correctly, because it genuinely cannot date
  those rows and so cannot judge their abbreviations.
  `gamelogs-games-season-agreement` and `nfl-plays-games-season-agreement` name
  the same games in their calibrations and decline them in the same words: "a
  GROWING orphan population means games are missing and is a different condition
  with a different owner". This module is that owner.

  The consequence of nobody owning it was measured rather than assumed. The
  population sat behind a console line and a signal that fires only inside the
  runner's coverage-collapse branch, so it could grow by an order of magnitude
  with nothing firing -- and it HAD already grown, twice, unnoticed.

  ## The prevailing description of this population was wrong

  Those calibrations call these "missing PRE-season games", and the settlement
  that conformed the team abbreviations recorded the surviving era tokens among
  them as CORRECT to hold, "because they have no joinable nfl_games row so
  nothing can date them".

  The games are not missing. Measured against production 2026-09-03, all 130 of
  the 2013 and 2014 orphan esbids resolve to a real PRE game at `esbid + 50`,
  130 for 130, with the team pair agreeing on 114 outright and the remaining 16
  agreeing under canonical resolution -- they are exactly the STL and SD rows,
  which read as disagreements only because the abbreviation conform reached
  `nfl_games` through the very esbid join that cannot reach these rows.

  So the defect is a FORKED KEY, not an absent game: the play-stats importer
  minted an esbid from a date and a sequence rather than resolving one against
  `nfl_games`, and used the regular-season `00+` sequence for two preseason
  slates whose games carry the `50+` convention. The two later singletons are
  the same mechanism meeting a moving schedule -- 2020112602 is the Thanksgiving
  slot of a BAL at PIT game that was postponed and now lives at 2020120200, and
  2021122201 is a SEA at LA game that `nfl_games` carries one calendar day
  earlier at 2021122101.

  That is why these rows are debt with an owning repair rather than an
  adjudication: every one of them names a game we hold, so a repair can land.

  ## Row shape, and why it is one row per esbid rather than one per orphan

  The runner's detector-health floor counts EMITTED ROWS. A check emitting only
  its violations emits nothing when the corpus is clean, which reads as a
  collapsed scan -- the tautology inverted. So every distinct esbid in
  `nfl_play_stats` is emitted, carrying its own play-stat row count as the
  denominator and a numerator of 1 when it resolves to no game.

  The numerator is deliberately 1 rather than the orphan's row count. `max_count`
  is a budget over the check's whole unsuppressed violation count, so a numerator
  of 1 at a grain of `esbid` makes that budget count GAMES, which is the unit the
  repair acts on and the unit a parked entry is keyed by. A row count would make
  the budget six figures and unreadable.
*/

import db from '#db'

/*
  One row per distinct esbid in nfl_play_stats.

  The denominator is derived from this check's OWN scan -- the same grouped
  count the predicate runs over -- rather than borrowed from a sibling, so it
  cannot keep reading a healthy number after the scan collapses.
*/
const linkage_query = `
  select
    ps.esbid,
    count(*) as denominator,
    case when g.esbid is null then 1 else 0 end as numerator
  from nfl_play_stats ps
  left join nfl_games g on g.esbid = ps.esbid
  group by ps.esbid, g.esbid
`

/**
 * Rows for the `nfl-play-stats-game-linkage` registered check.
 *
 * One row per esbid: `denominator` is the play-stat rows that esbid carries,
 * `numerator` is 1 when no `nfl_games` row answers to it and 0 otherwise.
 */
export const nfl_play_stats_game_linkage_rows = async () => {
  const { rows } = await db.raw(linkage_query)

  return rows.map((row) => ({
    esbid: Number(row.esbid),
    numerator: Number(row.numerator),
    denominator: Number(row.denominator)
  }))
}
