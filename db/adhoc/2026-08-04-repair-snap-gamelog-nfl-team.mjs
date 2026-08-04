/**
 * One-shot repair for player_gamelogs rows whose nfl_team is unusable.
 *
 * These rows were written by the snap-based path of
 * scripts/generate-player-gamelogs.mjs, which resolved the team as
 *
 *   existing gamelog team || play_stats team || player.current_nfl_team
 *
 * The last term is a property of the player TODAY rather than of the game, so
 * it wrote 'INA' -- the roster-status code, not a franchise -- for every
 * retired player the first two terms did not cover. Measured 2026-08-04:
 * 1,888 rows carrying 'INA' plus 2 carrying the empty string.
 *
 * The writer is fixed in the same commit. This repairs the rows the defect
 * already produced, using the SAME resolver the writer now uses
 * (libs-server/resolve-snap-gamelog-team.mjs) so the two cannot drift.
 *
 * Rows whose team cannot be established are left alone and reported. That is
 * deliberate: an unusable team is visibly wrong and can be found again, while
 * a plausible wrong team is not, and it corrupts every team-scoped aggregate
 * that reads this table.
 *
 * `opponent_nfl_team` is recomputed rather than preserved -- it was derived
 * from the bad team, and `calculate_opponent` returns the HOME team whenever
 * the team it is given is not the home team, so every 'INA' row whose real
 * team is the home side carries the wrong opponent too.
 *
 * Usage:
 *   NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
 *     node db/adhoc/2026-08-04-repair-snap-gamelog-nfl-team.mjs [--dry]
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import { create_snap_gamelog_team_resolver } from '#libs-server/resolve-snap-gamelog-team.mjs'

// console.log rather than `debug`: this script's entire output IS its audit
// trail, and the guarded `debug.enable` pattern cannot be relied on here. ESM
// evaluates the libs-server imports first, each of which calls `debug.enable`
// and REPLACES the namespace set, and a logger already constructed cannot be
// turned back on -- so a `debug`-based report prints nothing and the run exits
// 0 having silently repaired 1,871 rows with no record of what it did.
const log = (message) => console.log(message)

const UNUSABLE_TEAMS = ['INA', '']

const count_unusable = async () => {
  const [row] = await db('player_gamelogs')
    .count('* as count')
    .whereIn('nfl_team', UNUSABLE_TEAMS)
  return Number(row.count)
}

export const repair_snap_gamelog_nfl_team = async ({
  dry_run = false
} = {}) => {
  const before = await count_unusable()
  log(`before: ${before} rows with an unusable nfl_team`)

  const targets = await db('player_gamelogs')
    .select(
      'player_gamelogs.pid',
      'player_gamelogs.esbid',
      'player_gamelogs.season_year',
      'player_gamelogs.nfl_team',
      'player.primary_position',
      'player.gsis_it_player_id'
    )
    .join('player', 'player.pid', 'player_gamelogs.pid')
    .whereIn('player_gamelogs.nfl_team', UNUSABLE_TEAMS)

  const targets_by_season_year = new Map()
  for (const target of targets) {
    if (!targets_by_season_year.has(target.season_year)) {
      targets_by_season_year.set(target.season_year, [])
    }
    targets_by_season_year.get(target.season_year).push(target)
  }

  const method_counts = {}
  const unresolved = []
  let updated = 0

  for (const [season_year, candidates] of [
    ...targets_by_season_year.entries()
  ].sort((a, b) => a[0] - b[0])) {
    const resolve = await create_snap_gamelog_team_resolver({
      candidates,
      season_year
    })

    const games = await db('nfl_games')
      .select('esbid', 'home_nfl_team', 'away_nfl_team')
      .whereIn('esbid', [...new Set(candidates.map((c) => c.esbid))])
    const game_by_esbid = new Map(games.map((game) => [game.esbid, game]))

    let season_updated = 0
    for (const candidate of candidates) {
      const resolved = resolve(candidate)
      const method = resolved.method || `refused:${resolved.reason}`

      if (!resolved.nfl_team) {
        unresolved.push({
          pid: candidate.pid,
          esbid: candidate.esbid,
          season_year,
          reason: method
        })
        continue
      }

      const game = game_by_esbid.get(candidate.esbid)
      const nfl_team = fixTeam(resolved.nfl_team)
      const opponent_nfl_team =
        nfl_team === fixTeam(game.home_nfl_team)
          ? fixTeam(game.away_nfl_team)
          : fixTeam(game.home_nfl_team)

      method_counts[method] = (method_counts[method] || 0) + 1

      if (!dry_run) {
        // scoped to the unusable value so a concurrent correct write is never
        // overwritten by this backfill
        const affected = await db('player_gamelogs')
          .where({ pid: candidate.pid, esbid: candidate.esbid })
          .whereIn('nfl_team', UNUSABLE_TEAMS)
          .update({ nfl_team, opponent_nfl_team })
        season_updated += affected
      } else {
        season_updated += 1
      }
    }
    updated += season_updated
    log(
      `${season_year}: ${season_updated}/${candidates.length} ${
        dry_run ? 'would be ' : ''
      }repaired`
    )
  }

  log(`resolution methods: ${JSON.stringify(method_counts)}`)
  log(`${dry_run ? 'would repair' : 'repaired'}: ${updated}`)
  log(`left unrepaired: ${unresolved.length}`)
  for (const row of unresolved) {
    log(
      `  unrepaired ${row.pid} esbid=${row.esbid} season=${row.season_year} (${row.reason})`
    )
  }

  const after = await count_unusable()
  log(`after: ${after} rows with an unusable nfl_team`)

  return { before, after, updated, unresolved, method_counts }
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('dry', { type: 'boolean', default: false })
    .parse()

  await repair_snap_gamelog_nfl_team({ dry_run: argv.dry })
  process.exit(0)
}

// Bare call rather than the `is_main` guard the `scripts/` convention uses:
// `is_main` compares `process.argv[1]` verbatim against the resolved module
// path, and argv[1] is the path AS TYPED -- so a relative invocation, which is
// how every recipe in this repo spells a db/adhoc run, silently does nothing
// and exits 0. Matches check-schema-conformance-ratchet.mjs.
main()
