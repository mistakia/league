/**
 * One-shot repair for player_gamelogs rows whose nfl_team names the OTHER SIDE
 * of the game the row belongs to.
 *
 * The value is not null and not an out-of-range franchise, so nothing that
 * inspects one row can see it: `opponent_nfl_team` is DERIVED from `nfl_team`
 * at every write site, and the pair stays internally consistent while naming
 * the wrong sides of a real matchup. The writer is the snap-only branch of
 * scripts/generate-player-gamelogs.mjs, whose first-priority evidence is the
 * existing gamelog for the same (pid, esbid) -- so a regeneration reads the bad
 * row back and rewrites it unchanged, and re-running the generator is not a
 * repair. Which inference term first wrote the bad team is NOT established; the
 * repair does not depend on it.
 *
 * ## The admissibility rule is the whole safety argument
 *
 * A row is repaired only where BOTH sources of the shipped resolver
 * (libs-server/resolve-snap-gamelog-team.mjs) spoke and named the SAME team --
 * roster continuity over the player's other weeks that season, and modal
 * scrimmage possession over his snaps -- with continuity resting on three or
 * more other weeks. That is the same rule the detector grades on
 * (libs-server/gamelog-week-team-attribution.mjs), deliberately expressed
 * through the same module so the two cannot drift: loosening it here to repair
 * more rows would repair rows the check does not consider evidence.
 *
 * Two independent sources agreeing with each other and disagreeing with the
 * stored row happens 0 times in the clean 2025 season and 43 to 90 times in
 * every season before it, which is what makes the evidence strong enough to
 * overwrite production. Everything else is REFUSED and reported rather than
 * guessed at -- a plausible wrong team is worse than a known-suspect one,
 * because it cannot be found again.
 *
 * 2025 is included rather than excluded, as a live control: it is clean for
 * feed-coverage reasons (private/scripts/import-gameday-rosters.mjs asserts each
 * dressed player's team before the generator runs), so a run that proposes any
 * 2025 repair is reporting a regression in this script rather than a finding.
 *
 * `opponent_nfl_team` is recomputed from the corrected team rather than
 * preserved. It was derived from the bad one, and on these rows it is holding
 * the team the player actually played for.
 *
 * Usage:
 *   NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
 *     node db/adhoc/2026-09-02-repair-gamelog-week-team.mjs [--dry]
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import {
  create_snap_gamelog_team_resolver,
  is_agreeing_verdict
} from '#libs-server/resolve-snap-gamelog-team.mjs'

// console.log rather than `debug`: this script's entire output IS its audit
// trail, and a repair that writes rows while printing nothing has destroyed it.
// Same reasoning as db/adhoc/2026-08-04-repair-snap-gamelog-nfl-team.mjs.
const log = (message) => console.log(message)

// nfl_snaps begins here; below it neither resolver source can speak.
const FIRST_SNAP_SEASON = 2016

// REG only. PRE and POST carry real roster churn against thin snap counts and
// read 0.93 on this same admissible population even in the clean 2025 season,
// which is why the detector emits them un-gradeable -- so the rule that earns
// the right to overwrite production does not hold there either.
const SEASON_TYPE = 'REG'

const load_candidates = async ({ season_year }) =>
  // Mirrors the detector's candidate query exactly, including the join to
  // nfl_snaps that makes this the RESOLVABLE population rather than every
  // gamelog row, and the anchor on esbid rather than week so a player who moved
  // mid-week cannot match the wrong game.
  db({ pg: 'player_gamelogs' })
    .join('nfl_games as g', 'g.esbid', 'pg.esbid')
    .join('player as pl', 'pl.pid', 'pg.pid')
    .select(
      'g.season_year',
      'g.season_type',
      'g.week',
      'g.home_nfl_team',
      'g.away_nfl_team',
      'pg.pid',
      'pg.esbid',
      'pg.nfl_team',
      'pg.opponent_nfl_team',
      'pl.gsis_it_player_id',
      'pl.primary_position'
    )
    .where('g.season_year', season_year)
    .where('g.season_type', SEASON_TYPE)
    .whereNotNull('g.week')
    .whereNotNull('pg.nfl_team')
    .whereNotNull('pl.gsis_it_player_id')
    .whereExists(function () {
      this.select(db.raw(1))
        .from('nfl_snaps as sn')
        .whereRaw('sn.esbid = pg.esbid')
        .whereRaw('sn.gsis_it_player_id = pl.gsis_it_player_id')
    })

export const repair_gamelog_week_team = async ({ dry_run = false } = {}) => {
  const season_rows = await db('nfl_games')
    .distinct('season_year')
    .where('season_year', '>=', FIRST_SNAP_SEASON)
    .whereNotNull('week')
    .orderBy('season_year')

  const totals = {
    candidates: 0,
    admissible: 0,
    disagreements: 0,
    updated: 0,
    not_updated: 0
  }
  // Aggregate rather than per-row: the refused population is the whole
  // non-admissible remainder, six figures of rows, and dumping it would bury
  // the repairs. What matters is WHICH refusal, and how many of each.
  const refusal_counts = {}
  const not_updated = []

  for (const { season_year } of season_rows) {
    const candidates = await load_candidates({ season_year })
    if (!candidates.length) continue

    const resolve = await create_snap_gamelog_team_resolver({
      candidates,
      season_year
    })

    // Every verdict for the season is computed BEFORE any write, so no repair
    // can feed the roster-continuity source of a later verdict in the same
    // season. The evidence this run acts on is exactly the evidence the
    // detector graded.
    const repairs = []
    let admissible = 0

    for (const candidate of candidates) {
      const resolved = resolve(candidate)
      const method = resolved.method || `refused:${resolved.reason}`

      if (!is_agreeing_verdict(resolved)) {
        // Both sources agreeing on too thin a continuity base is its own
        // refusal reason rather than the method name, so the report can tell a
        // near-miss from a source that never spoke.
        const reason =
          resolved.method === 'continuity_and_scrimmage'
            ? 'refused:continuity_support_below_minimum'
            : method
        refusal_counts[reason] = (refusal_counts[reason] || 0) + 1
        continue
      }

      admissible += 1

      const stored_nfl_team = fixTeam(candidate.nfl_team)
      const nfl_team = fixTeam(resolved.nfl_team)
      if (stored_nfl_team === nfl_team) continue

      const home_nfl_team = fixTeam(candidate.home_nfl_team)
      const away_nfl_team = fixTeam(candidate.away_nfl_team)

      repairs.push({
        pid: candidate.pid,
        esbid: candidate.esbid,
        week: candidate.week,
        stored_nfl_team: candidate.nfl_team,
        nfl_team,
        opponent_nfl_team:
          nfl_team === home_nfl_team ? away_nfl_team : home_nfl_team
      })
    }

    let updated = 0
    for (const repair of repairs) {
      if (dry_run) {
        log(
          `  ${season_year} week ${repair.week} ${repair.pid} esbid=${repair.esbid}: ` +
            `${repair.stored_nfl_team} -> ${repair.nfl_team} (opponent ${repair.opponent_nfl_team})`
        )
        updated += 1
        continue
      }

      // Scoped to the value being replaced, so a concurrent correct write --
      // the gameday-roster importer among them -- is never clobbered by this
      // backfill. A zero here means the row moved under the run and is
      // reported rather than retried.
      const affected = await db('player_gamelogs')
        .where({ pid: repair.pid, esbid: repair.esbid })
        .where('nfl_team', repair.stored_nfl_team)
        .update({
          nfl_team: repair.nfl_team,
          opponent_nfl_team: repair.opponent_nfl_team
        })

      if (affected) {
        updated += affected
      } else {
        not_updated.push({ season_year, ...repair })
      }
    }

    totals.candidates += candidates.length
    totals.admissible += admissible
    totals.disagreements += repairs.length
    totals.updated += updated

    log(
      `${season_year}: ${repairs.length} disagreement(s) over ${admissible} admissible of ` +
        `${candidates.length} candidate row(s), ${updated} ${
          dry_run ? 'would be ' : ''
        }repaired`
    )
  }

  totals.not_updated = not_updated.length

  log(`refusals by reason: ${JSON.stringify(refusal_counts)}`)
  log(
    `${dry_run ? 'would repair' : 'repaired'}: ${totals.updated} of ${
      totals.disagreements
    } disagreement(s), over ${totals.admissible} admissible of ${
      totals.candidates
    } candidate row(s)`
  )

  if (not_updated.length) {
    log(
      `${not_updated.length} row(s) moved under the run and were NOT written:`
    )
    for (const row of not_updated) {
      log(
        `  unwritten ${row.pid} esbid=${row.esbid} season=${row.season_year} ` +
          `(expected ${row.stored_nfl_team})`
      )
    }
  }

  return { ...totals, refusal_counts, not_updated }
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('dry', { type: 'boolean', default: false })
    .parse()

  await repair_gamelog_week_team({ dry_run: argv.dry })
  process.exit(0)
}

// Bare call rather than the `is_main` guard: everything under db/ is invoked by
// relative path and follows db/gates/check-schema-conformance-ratchet.mjs.
main()
