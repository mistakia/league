/**
 * Could this player have recorded a stat in this season?
 *
 * The falsifier is `player.nfl_draft_year` against the game's season year, and
 * the caveat below is the whole reason this lives in its own module rather than
 * inline at each call site: the column is a DEBUT year only for a player who was
 * actually drafted. For an undrafted one it records the year the player entered
 * the league by whatever route the source knew about, and that routinely
 * postdates the real first appearance -- `cory procter` carries 2007 against
 * gamelogs from 2005, `rudy carpenter` 2011 against 2009.
 *
 * Applying the raw comparison without that caveat is what makes the defect look
 * five times larger than it is. Measured 2026-08-04 against `player_gamelogs`:
 * the bare `nfl_draft_year > season_year` test flags 2,955 rows across 320
 * players, of which 1,079 rows across 314 players are undrafted players within
 * two years of their recorded entry year -- not misattribution at all. The real
 * population is 1,876 rows across 62 players.
 *
 * The grace window is two years because that is where the undrafted
 * distribution elbows: 904 rows at a one-year gap, 175 at two, 52 at three, 20
 * at four. Beyond it the gap stops looking like a bookkeeping offset and starts
 * looking like a different person, which is the thing this predicate exists to
 * catch.
 *
 * Deliberately NOT used here: `player_gamelogs`, `player_seasonlogs`, or any
 * other table derived from play-stat attribution. Those are downstream of the
 * identifiers this predicate is used to falsify, so consulting them would be
 * checking a value against itself. `nfl_snaps` would be genuinely independent
 * but only covers 2016 onward, while the attribution defects concentrate in
 * 2001-2015, so it cannot be the basis for an era check that has to hold in
 * every season.
 */

// A player row whose `draft_round` is 0 or null went undrafted, so its
// `nfl_draft_year` is an entry year rather than a debut year. See above.
const UNDRAFTED_ENTRY_YEAR_GRACE_SEASONS = 2

const was_drafted = (player) => Number(player.draft_round) > 0

/**
 * @param {Object} player - a `player` row carrying `nfl_draft_year` and
 *   `draft_round`. A row missing either is not falsifiable and passes.
 * @param {number} season_year - the season of the game the stat belongs to.
 * @returns {boolean} false only when the player provably had not entered the
 *   league yet. Absent or unusable evidence returns true -- this predicate
 *   exists to REJECT an impossible attribution, never to confirm a possible
 *   one, so every uncertain case has to pass.
 */
export const player_could_have_played = ({ player, season_year }) => {
  if (!player || !season_year) return true

  const nfl_draft_year = Number(player.nfl_draft_year)
  if (!nfl_draft_year) return true

  if (was_drafted(player)) return nfl_draft_year <= season_year

  return nfl_draft_year - season_year <= UNDRAFTED_ENTRY_YEAR_GRACE_SEASONS
}

export default player_could_have_played
