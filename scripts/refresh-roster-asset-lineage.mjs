import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

import generate_roster_asset_lineage from './generate-roster-asset-lineage.mjs'

const log = debug('refresh-roster-asset-lineage')
debug.enable('refresh-roster-asset-lineage')

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('lid', {
      type: 'number',
      describe: 'restrict the sweep to one league'
    })
    .option('force', {
      type: 'boolean',
      default: false,
      describe: 'rebuild even when the fingerprint is unchanged'
    })
    .parse()

// The fingerprint must cover every table walk_transactions reads, or a change
// this script cannot see leaves the lineage graph stale until the nightly cron.
// Enumerated from the `db('<table>')` calls in
// libs-server/roster-asset-lineage/walk-transactions.mjs as of 2026-08-03:
//
//   transactions  trades  trades_transactions  trades_players
//   trades_picks  draft   restricted_free_agency_bids  seasons
//
// ADDING A READ TO THE WALKER MEANS ADDING IT HERE. There is no gate that
// couples the two -- a missed table produces no error, just silent staleness,
// which is the exact defect this script exists to remove. The columns hashed
// per table are the ones the walker selects, so a column it ignores does not
// force a rebuild.
//
// A content hash rather than a MAX(uid) watermark because the walker's inputs
// are mutated in place, not only appended to: the db/adhoc repair files
// (2026-05-21-fix-kyle-allen-release-tid.sql and siblings) UPDATE transaction
// rows, and trades carry accepted/vetoed/cancelled flags that flip after
// insert. Measured at 22.8ms for league 1 (12,058 transactions), against 2.7ms
// for the watermark it replaces -- completeness costs 20ms per poll.
const fingerprint_sql = `
SELECT md5(concat_ws('|',
  (SELECT md5(string_agg(concat_ws(':', uid, tid, pid, type, value, year, timestamp), ',' ORDER BY uid))
     FROM transactions WHERE lid = ?),
  (SELECT md5(string_agg(concat_ws(':', uid, propose_tid, accept_tid, year, offered, accepted, cancelled, rejected, vetoed), ',' ORDER BY uid))
     FROM trades WHERE lid = ?),
  (SELECT md5(string_agg(concat_ws(':', tt.tradeid, tt.transactionid), ',' ORDER BY tt.tradeid, tt.transactionid))
     FROM trades_transactions tt JOIN trades t ON t.uid = tt.tradeid WHERE t.lid = ?),
  (SELECT md5(string_agg(concat_ws(':', tp.tradeid, tp.tid, tp.pid), ',' ORDER BY tp.tradeid, tp.tid, tp.pid))
     FROM trades_players tp JOIN trades t ON t.uid = tp.tradeid WHERE t.lid = ?),
  (SELECT md5(string_agg(concat_ws(':', tk.tradeid, tk.tid, tk.pickid), ',' ORDER BY tk.tradeid, tk.tid, tk.pickid))
     FROM trades_picks tk JOIN trades t ON t.uid = tk.tradeid WHERE t.lid = ?),
  (SELECT md5(string_agg(concat_ws(':', uid, pid, round, comp, pick, tid, otid, year, selection_timestamp), ',' ORDER BY uid))
     FROM draft WHERE lid = ?),
  (SELECT md5(string_agg(concat_ws(':', uid, pid, bid, tid, year, succ, processed, cancelled, nomination_id, outcome), ',' ORDER BY uid))
     FROM restricted_free_agency_bids WHERE lid = ?),
  (SELECT md5(string_agg(concat_ws(':', year, draft_start, rookie_draft_completed_at, ext_date), ',' ORDER BY year))
     FROM seasons WHERE lid = ?)
)) AS input_hash`

const compute_input_hash = async ({ lid }) => {
  const result = await db.raw(fingerprint_sql, Array(8).fill(lid))
  return result.rows[0].input_hash
}

const refresh_roster_asset_lineage = async ({ lid = null, force = false }) => {
  const league_query = db('leagues')
    .select('uid')
    .where({ hosted: true })
    .whereNull('archived_at')
  if (lid) league_query.where('uid', lid)
  const leagues = await league_query

  const stored_rows = await db('roster_asset_lineage_refresh_state').select(
    'lid',
    'input_hash'
  )
  const stored_hash_by_lid = new Map(
    stored_rows.map((row) => [row.lid, row.input_hash])
  )

  const summary = {
    leagues_checked: 0,
    leagues_rebuilt: 0,
    leagues_skipped: 0,
    rebuilt: [],
    failures: []
  }

  for (const league of leagues) {
    summary.leagues_checked += 1
    const league_id = league.uid

    try {
      // Captured BEFORE the rebuild on purpose. A write landing mid-rebuild is
      // then still a fingerprint mismatch on the next poll, rather than being
      // absorbed into a hash taken after the fact and lost until the nightly
      // cron.
      const input_hash = await compute_input_hash({ lid: league_id })

      if (!force && stored_hash_by_lid.get(league_id) === input_hash) continue

      const result = await generate_roster_asset_lineage({ lid: league_id })

      // The generator returns early for a league whose salary_attribution_rule
      // it does not implement. Deliberately NOT recording a hash for those: if
      // the rule ships later, an unchanged fingerprint would suppress the
      // rebuild forever.
      if (result.coverage_warning) {
        summary.leagues_skipped += 1
        continue
      }

      // A fingerprint that moved must produce rows. Zero here means the walk
      // returned nothing for a league that has lineage history -- the
      // delete half of the swap succeeded and the insert half did not, which
      // is indistinguishable from a clean run by exit code alone.
      if (!result.holdings) {
        throw new Error(
          `lid=${league_id} fingerprint changed but rebuild wrote 0 holdings`
        )
      }

      await db('roster_asset_lineage_refresh_state')
        .insert({ lid: league_id, input_hash, refreshed_at: new Date() })
        .onConflict('lid')
        .merge()

      summary.leagues_rebuilt += 1
      summary.rebuilt.push({
        lid: league_id,
        holdings: result.holdings,
        transformations: result.transformations
      })
      log(
        `lid=${league_id} rebuilt: ${result.holdings} holdings, ${result.transformations} transformations`
      )
    } catch (err) {
      // One league's failure must not abort the sweep -- the others are
      // independent and their staleness is the thing this job exists to fix.
      summary.failures.push({ lid: league_id, error: err.message })
      log(`lid=${league_id} refresh failed: ${err.message}`)
    }
  }

  return summary
}

const main = async () => {
  let error
  let summary
  try {
    const argv = initialize_cli()
    summary = await refresh_roster_asset_lineage({
      lid: argv.lid || null,
      force: argv.force
    })

    // Output oracle. An idle sweep and a broken one both write nothing and both
    // exit 0, so the run has to say which it was rather than leaving the reader
    // to infer it from silence. Reports the denominator (leagues checked) so a
    // sweep that resolved no leagues at all is visible rather than reading as
    // "nothing needed doing".
    log(`ORACLE ${JSON.stringify(summary)}`)

    if (!summary.leagues_checked) {
      throw new Error(
        'sweep resolved 0 leagues; expected at least one hosted league'
      )
    }
    if (summary.failures.length) {
      throw new Error(
        `${summary.failures.length} league(s) failed to refresh: ${JSON.stringify(summary.failures)}`
      )
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.REFRESH_ROSTER_ASSET_LINEAGE,
    error
  })

  // Rethrow via a non-zero exit so the runs ledger records the outcome. A job
  // that reports its error to report_job and then returns normally exits 0 and
  // the ledger reads success -- see guideline/surface-pipeline-failures.md.
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default refresh_roster_asset_lineage
