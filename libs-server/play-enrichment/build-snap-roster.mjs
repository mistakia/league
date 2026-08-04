import db from '#db'
import { player_could_have_played } from '../player-era.mjs'

/**
 * Build the week-accurate participation index `enrich_player_identifications`
 * takes as `snap_roster_by_esbid`: who was actually on the field in each game,
 * keyed `esbid -> Map(normalized short_name -> [{ pid, gsisid }])`.
 *
 * It exists so the enrichment can recover the actor on a role stat row whose
 * `gsis_player_id` the NFL feed left NULL, without mutating the NFL-owned
 * `nfl_play_stats` table. See user:text/league/data-quality-and-validation.md.
 *
 * This lived in `scripts/process-plays.mjs` until 2026-08-04, which put the
 * only producer of a library's parameter inside one of that library's callers.
 * The predictable happened: `scripts/backfill-role-pids.mjs` also calls
 * `enrich_player_identifications` and had no way to build the index, so it
 * passed nothing and silently lost the fallback -- a caller opting out of a
 * correctness feature by omission rather than by decision.
 *
 * Note `nfl_snaps` begins in 2016. For any earlier season this returns an empty
 * index rather than failing, and the enrichment's unique-or-abstain fallback
 * simply never fires -- so this is not a usable roster source for the historical
 * seasons where play-stat attribution defects concentrate.
 */
export const build_snap_roster_by_esbid = async (esbids) => {
  const roster_by_esbid = new Map()
  if (!esbids || esbids.length === 0) return roster_by_esbid

  const rows = await db('nfl_snaps as s')
    .join('player as p', 'p.gsis_it_player_id', 's.gsis_it_id')
    .whereIn('s.esbid', esbids)
    .whereNotNull('p.gsis_player_id')
    .distinct(
      's.esbid',
      's.season_year',
      'p.pid',
      'p.gsis_player_id',
      'p.short_name',
      'p.date_of_birth',
      'p.nfl_draft_year',
      'p.draft_round'
    )

  for (const row of rows) {
    // `gsis_it_player_id` is a third identifier column that can name the wrong
    // player, the same defect `resolve_play_stat_player` and the gamelog
    // generator's snap path both falsify on: a `player` row can hold an
    // identifier belonging to an earlier player of the same name, and this join
    // then places that player on a field they were not yet in the league for.
    // Measured on production 2026-08-04, the unfiltered join yielded
    // era-impossible entries for 4 players across 39 games and 1,328 snap rows.
    // An index feeding a name-keyed fallback is exactly where such an entry
    // does damage -- it can be the unique match the fallback resolves to.
    if (
      !player_could_have_played({
        player: row,
        season_year: row.season_year
      })
    ) {
      continue
    }

    const name_key = (row.short_name || '').toString().trim().toLowerCase()
    if (!name_key) continue
    let by_name = roster_by_esbid.get(row.esbid)
    if (!by_name) {
      by_name = new Map()
      roster_by_esbid.set(row.esbid, by_name)
    }
    const list = by_name.get(name_key) || []
    list.push({ pid: row.pid, gsisid: row.gsis_player_id })
    by_name.set(name_key, list)
  }

  return roster_by_esbid
}

export default build_snap_roster_by_esbid
