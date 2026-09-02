import debug from 'debug'
import db from '#db'
import { is_main } from '#libs-server'
import { play_stat_name_matches_player } from '#libs-server/resolve-play-stat-player.mjs'
import { player_could_have_played } from '#libs-server/player-era.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('backfill-play-stats-gsisid')
enable_debug_namespaces('backfill-play-stats-gsisid')

/**
 * Fill missing `nfl_play_stats.gsis_player_id` by matching the feed's
 * `player_name` against the roster of the game the row belongs to.
 *
 * This script previously matched against the WHOLE `player` table in two
 * passes: `player_name` + `current_nfl_team`, then `player_name` alone
 * accepting any globally-unique match. Both are unsafe, and the second is
 * unsafe in exactly the case it looks safest. `current_nfl_team` is the
 * player's team today, which says nothing about their team in a 2003 game. And
 * a unique name match fires precisely when the historical player is MISSING
 * from `player` and the only candidate left is a modern namesake -- the guard
 * was most permissive where it should have been most cautious.
 *
 * The replacement resolves against players independently known to have been in
 * THAT game, unique-or-abstain. Ambiguity within one game is tractable in a way
 * global ambiguity is not: Tyrone Wheatley Sr. and Jr. never appear in the same
 * game, and it is global scoping that fuses them.
 *
 * Two independent sources establish game presence, and neither is derived from
 * the column being written:
 *
 *   - play-stat rows in the same game already carrying a feed-supplied
 *     `gsis_player_id`, which is the NFL feed's own identification
 *   - `nfl_snaps`, real participation, but only from 2016 onward
 *
 * Where neither yields a roster the script resolves NOTHING rather than falling
 * back to a name match. That is a real coverage cost -- 2000-2002 carry no feed
 * `gsis_player_id` at all, so those seasons resolve zero -- and it is the
 * correct trade: the rows it would have filled are the rows it was filling
 * wrong.
 */

const build_game_rosters = async ({ esbids, season_year }) => {
  // Players the feed itself identified somewhere in this game.
  const feed_identified = await db('nfl_play_stats as ps')
    .join('player as p', 'p.gsis_player_id', 'ps.gsis_player_id')
    .whereIn('ps.esbid', esbids)
    .whereNotNull('ps.gsis_player_id')
    .distinct(
      'ps.esbid',
      'p.pid',
      'p.gsis_player_id',
      'p.formatted_name',
      'p.nfl_draft_year',
      'p.draft_round',
      'p.date_of_birth'
    )

  // Real participation, available from 2016 onward only.
  const snap_participants = await db('nfl_snaps as s')
    .join('player as p', 'p.gsis_it_player_id', 's.gsis_it_player_id')
    .whereIn('s.esbid', esbids)
    .where('s.season_year', season_year)
    .whereNotNull('p.gsis_player_id')
    .distinct(
      's.esbid',
      'p.pid',
      'p.gsis_player_id',
      'p.formatted_name',
      'p.nfl_draft_year',
      'p.draft_round',
      'p.date_of_birth'
    )

  const rosters = new Map()
  for (const row of [...feed_identified, ...snap_participants]) {
    let roster = rosters.get(row.esbid)
    if (!roster) {
      roster = new Map()
      rosters.set(row.esbid, roster)
    }
    // Keyed by pid so the two sources merge rather than double-count a player
    // both of them name.
    roster.set(row.pid, row)
  }

  log(
    `built rosters for ${rosters.size}/${esbids.length} games from ` +
      `${feed_identified.length} feed-identified and ${snap_participants.length} snap rows`
  )

  return rosters
}

/**
 * Resolve one row against its game's roster, unique-or-abstain.
 *
 * @returns {{ gsis_player_id: string, pid: string }|null}
 */
export const resolve_against_roster = ({ play_stat, roster, season_year }) => {
  if (!roster) return null

  const matches = []
  for (const player of roster.values()) {
    if (
      !play_stat_name_matches_player({
        player_name: play_stat.player_name,
        player
      })
    )
      continue
    // Roster membership already implies the player was there, so this can only
    // fire on a roster entry built from a corrupt identifier. Cheap to keep as
    // the same falsifier the resolver applies.
    if (!player_could_have_played({ player, season_year })) continue
    matches.push(player)
  }

  if (matches.length !== 1) return null

  return { gsis_player_id: matches[0].gsis_player_id, pid: matches[0].pid }
}

/**
 * Apply resolutions in chunked transactions.
 *
 * The previous form issued one UPDATE per row with a five-column WHERE and no
 * transaction, so a season was tens of thousands of round trips and a mid-run
 * failure left a partial write with no record of where it stopped.
 */
const CHUNK_SIZE = 500

const apply_updates = async ({ rows_to_fix, dry_run }) => {
  if (dry_run) {
    log(`[DRY RUN] would update ${rows_to_fix.length} rows`)
    return 0
  }

  let total_updated = 0
  for (let index = 0; index < rows_to_fix.length; index += CHUNK_SIZE) {
    const chunk = rows_to_fix.slice(index, index + CHUNK_SIZE)
    await db.transaction(async (trx) => {
      for (const row of chunk) {
        await trx('nfl_play_stats')
          .where({
            esbid: row.esbid,
            play_id: row.play_id,
            player_name: row.player_name,
            nfl_team: row.nfl_team,
            stat_id: row.stat_id
          })
          .update({ gsis_player_id: row.gsis_player_id })
      }
    })
    total_updated += chunk.length
  }

  return total_updated
}

const log_resolutions = (rows) => {
  const by_player = new Map()
  for (const row of rows) {
    const key = `${row.player_name} (${row.nfl_team})`
    const entry = by_player.get(key) || {
      gsis_player_id: row.gsis_player_id,
      pid: row.pid,
      count: 0
    }
    entry.count++
    by_player.set(key, entry)
  }

  const sorted = [...by_player.entries()].sort(
    (a, b) => b[1].count - a[1].count
  )
  for (const [name, info] of sorted) {
    log(`  ${name}: ${info.count} rows -> ${info.gsis_player_id} (${info.pid})`)
  }
}

const backfill_play_stats_gsisid = async ({
  season_year,
  dry_run = false
} = {}) => {
  log(
    `Backfilling gsis_player_id on nfl_play_stats for season_year ${season_year}`
  )

  const unresolved = await db('nfl_play_stats as ps')
    .join('nfl_games as g', 'ps.esbid', 'g.esbid')
    .where('g.season_year', season_year)
    .whereNull('ps.gsis_player_id')
    .whereNotNull('ps.player_name')
    .where('ps.player_name', '!=', '')
    .select(
      'ps.esbid',
      'ps.play_id',
      'ps.player_name',
      'ps.nfl_team',
      'ps.stat_id'
    )

  if (!unresolved.length) {
    log('no unresolved rows')
    return { updated: 0, remaining: 0 }
  }

  log(`${unresolved.length} rows carry a name and no gsis_player_id`)

  const esbids = [...new Set(unresolved.map((row) => row.esbid))]
  const rosters = await build_game_rosters({ esbids, season_year })

  const rows_to_fix = []
  let no_roster = 0
  let unresolved_against_roster = 0
  for (const play_stat of unresolved) {
    const roster = rosters.get(play_stat.esbid)
    if (!roster) {
      no_roster++
      continue
    }

    const resolution = resolve_against_roster({
      play_stat,
      roster,
      season_year
    })
    if (!resolution) {
      unresolved_against_roster++
      continue
    }

    rows_to_fix.push({ ...play_stat, ...resolution })
  }

  log(
    `resolved ${rows_to_fix.length}; ` +
      `${no_roster} in games with no roster evidence, ` +
      `${unresolved_against_roster} named nobody or more than one roster member`
  )

  if (rows_to_fix.length) log_resolutions(rows_to_fix)

  const updated = await apply_updates({ rows_to_fix, dry_run })

  const remaining = await db('nfl_play_stats as ps')
    .join('nfl_games as g', 'ps.esbid', 'g.esbid')
    .where('g.season_year', season_year)
    .whereNull('ps.gsis_player_id')
    .whereNotNull('ps.player_name')
    .where('ps.player_name', '!=', '')
    .count('* as count')
    .first()

  log(`Total updated: ${updated}, remaining unresolved: ${remaining.count}`)
  return { updated, remaining: parseInt(remaining.count, 10) }
}

const main = async () => {
  const args = process.argv.slice(2)
  const year_index = args.indexOf('--year')
  const season_year =
    year_index >= 0 ? parseInt(args[year_index + 1], 10) : null
  const dry_run = args.includes('--dry')

  if (!season_year) {
    console.error(
      'Usage: node scripts/backfill-play-stats-gsisid.mjs --year 2025 [--dry]'
    )
    process.exit(1)
  }

  let error
  try {
    await backfill_play_stats_gsisid({ season_year, dry_run })
  } catch (err) {
    error = err
    console.error(err)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default backfill_play_stats_gsisid
