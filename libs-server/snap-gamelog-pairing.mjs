/*
  Pairs a player's snaps with the gamelog for THE SAME GAME.

  Extracted from scripts/generate-player-snaps.mjs, which paired on the player
  alone. That script loads every gamelog for a whole (season, week, season_type)
  -- so `gamelogs.find(row => row.gsis_it_player_id === id)` returned the
  player's gamelog in whichever game of that week came back first, which is only
  the right game when the player appears in exactly one.

  When it was not, three wrong values landed together on one row, because the
  script takes the esbid from the SNAPS and everything else from the gamelog:

    esbid              the game the player actually played in
    opponent_nfl_team  the other game's opponent
    nfl_team           absent from the insert entirely, so the row took the
                       column DEFAULT of '' on a NOT NULL column

  Measured against production 2026-09-03, the whole footprint is two rows, both
  pid CALE-JOHN-027832 in 2024 preseason weeks 1 and 2. They are the only two
  rows in player_gamelogs carrying no `source` at all, which is this writer's
  signature -- every other writer stamps one. The player is a Jaguar; a namesake
  (CALE-JOHN-000167, also an LB) was on Cleveland's gameday roster those weeks,
  so the roster feed's CLE rows sat in the same week as his JAX snaps and were
  what `find` returned. The rows read as absences and are not: their team is JAX
  and their opponents are KC and TB.

  Pairing on (player, game) turns that mint back into the skip the script
  already performs when a player has no gamelog in the week at all --
  generate_player_gamelogs runs BEFORE this script in both entry points
  (scripts/process-stats-for-week.mjs and libs-server/finalize-game.mjs), so
  this writer should only ever be merging onto a gamelog that already exists.
  Reaching its INSERT path at all is the defect, not a case to support.
*/

/**
 * The grouping key for a player's snaps. Snaps must be grouped per GAME, not
 * per player: a player with snaps in two games of one week is the case the
 * pairing defect above turned into a wrong-game row.
 */
export const snap_group_key = ({ gsis_it_player_id, esbid }) =>
  `${gsis_it_player_id}_${esbid}`

/**
 * The gamelog belonging to this snap group, or null.
 *
 * Null is a SKIP rather than a fallback. There is no second-best gamelog here;
 * another game's row is exactly the wrong answer this function exists to stop.
 */
export const find_gamelog_for_snap_group = ({
  gamelogs,
  gsis_it_player_id,
  esbid
}) =>
  gamelogs.find(
    (row) => row.gsis_it_player_id === gsis_it_player_id && row.esbid === esbid
  ) || null
