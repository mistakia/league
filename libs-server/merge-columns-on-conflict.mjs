/**
 * Build the column list for the UPDATE half of an upsert, holding back columns
 * this writer inserts but must not assert on an existing row.
 *
 * A bare `.merge()` asserts EVERY column the insert names. That is wrong for two
 * kinds of column, and both have caused silent data loss here:
 *
 *   - A column another script owns. `player_gamelogs.is_active` belongs to
 *     import-nflverse-weekly-rosters.mjs, which maps game-day roster status onto
 *     it. The gamelog generator hardcodes `active: true` because a player with
 *     counting stats was dressed -- right on INSERT, wrong on UPDATE, where it
 *     reverted every game-day-inactive flag the run touched.
 *
 *   - A column whose value carries no more information than what is stored.
 *     `pos` copies `player.primary_position`, and neither column has a
 *     controlled vocabulary: `OLB` and `LB`, `T`/`G`/`C` and `OL`, `SS`/`FS`/`CB`
 *     and `DB` all name the same position under different importers' spellings.
 *     Merging rewrites a stored value to a different spelling of itself --
 *     1,183 rows over one 277-game backfill, none of them a correction. Held
 *     back until user:task/league/normalize-nfl-position-values.md lands.
 *
 * The insert half is untouched, so a NEW row still gets the held-back value.
 *
 * @param {object[]} batch - the rows being upserted
 * @param {string[]} exclude - columns to omit from the UPDATE
 * @returns {string[]} the columns to merge
 */
export const merge_columns_on_conflict = ({ batch, exclude = [] }) => {
  const columns = new Set()
  for (const item of batch) {
    for (const column of Object.keys(item)) columns.add(column)
  }
  for (const column of exclude) columns.delete(column)
  return [...columns]
}

export default merge_columns_on_conflict
