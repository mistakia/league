import { player_could_have_played } from './player-era.mjs'

/**
 * May a writer attach external identifiers to a player row it reached by NAME?
 *
 * The failure this exists to prevent is not a bad stat attribution -- it is a
 * permanent one. A name match that lands on the wrong same-named player, then
 * writes that player's `gsis_it_player_id` / `gsis_player_id` / `esb_player_id`
 * onto the row, MERGES two people into one row. Everything downstream then
 * reads a single conflated identity, `nfl_draft_year` included, which is the
 * input every era check depends on. See
 * user:task/league/era-scope-player-name-matchers.md.
 *
 * The write side is the right place for the guard because it has no false-drop
 * cost. Refusing an attach leaves BOTH rows intact and recoverable; refusing a
 * stat attribution silently drops data. So this may be strict in a way a read
 * path must not be.
 *
 * The evidence is the seasons the incoming identifier actually appears in. An
 * identifier observed in season Y belongs to somebody who played in season Y,
 * so a candidate row that provably had not entered the league by Y is not that
 * somebody. `player_could_have_played` is the falsifier and is used unchanged:
 * it rejects only the provably impossible and passes every uncertain case,
 * which is the property that makes it safe to put on a write path.
 *
 * Note what that inherits. A row carrying a usable birth date is decided by the
 * birth date alone, so this guard cannot fire on one -- deliberately, because a
 * draft year contradicting a birth date is evidence of a conflation rather than
 * evidence about a season. The population it protects is therefore the rows
 * with no usable birth date (the `0000-00-00` sentinel or null), which is also
 * the population that no birth-date-anchored sweep can reach.
 *
 * @param {object} params
 * @param {object} params.player_row - the candidate row the name match returned
 * @param {number[]} params.season_years - every season the incoming identifier
 *   is observed in. The EARLIEST is what falsifies: a row that could not have
 *   played in the first observed season cannot own the identifier.
 * @returns {{permitted: boolean, season_year?: number}} `permitted: false`
 *   carries the season that falsified the match, so the caller can log a reason
 *   a human can act on rather than a bare skip.
 */
export const era_permits_identifier_attach = ({ player_row, season_years }) => {
  if (!player_row || !Array.isArray(season_years) || !season_years.length) {
    return { permitted: true }
  }

  const usable_seasons = season_years
    .map(Number)
    .filter((season_year) => Number.isFinite(season_year) && season_year > 1900)

  if (!usable_seasons.length) {
    return { permitted: true }
  }

  const earliest_season = Math.min(...usable_seasons)

  if (
    player_could_have_played({
      player: player_row,
      season_year: earliest_season
    })
  ) {
    return { permitted: true }
  }

  return { permitted: false, season_year: earliest_season }
}

export default era_permits_identifier_attach
