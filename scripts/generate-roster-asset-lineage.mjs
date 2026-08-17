import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, batch_insert, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

import walk_transactions from '#libs-server/roster-asset-lineage/walk-transactions.mjs'
import compute_snapshots_bulk from '#libs-server/roster-asset-lineage/compute-snapshots-bulk.mjs'
import refresh_extension_state from '#libs-server/roster-asset-lineage/refresh-extension-state.mjs'
import audit_corrections from '#libs-server/roster-asset-lineage/audit-corrections-seed.mjs'

import {
  SALARY_ATTRIBUTION_RULE,
  TERMINATED_BY
} from '#libs-server/roster-asset-lineage/constants.mjs'

const log = debug('generate-roster-asset-lineage')
debug.enable('generate-roster-asset-lineage')

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('lid', { type: 'number' })
    .option('year', { type: 'number' })
    .option('all', { type: 'boolean', default: false })
    .option('skip_snapshots', { type: 'boolean', default: false })
    .parse()

const BATCH_SIZE = 1000

const resolve_league_format_id = async ({ lid, year }) => {
  const seasons_row = await db('seasons')
    .select('league_format_id')
    .where({ lid, season_year: year })
    .first()
  if (seasons_row?.league_format_id) return seasons_row.league_format_id
  // Fall back to the most-recent seasons row for this league.
  const latest = await db('seasons')
    .select('league_format_id')
    .where('lid', lid)
    .whereNotNull('league_format_id')
    .orderBy('season_year', 'desc')
    .first()
  return latest?.league_format_id || null
}

// Regeneration is always a full per-league rebuild: `walk_transactions` replays
// the league's entire history, so there is no delta to apply. The old
// `rebuild: false` path skipped the delete and inserted the full result on top
// of the existing rows -- no upsert, no conflict target -- which duplicated
// every holding and transformation. It had no callers; the flag only ever
// selected between "correct" and "silently corrupt".
//
// The write is one transaction. Readers must never observe the window between
// the delete and the inserts: `roster_asset_holding` is left-joined by the
// `player_extended_salary` data-view column, and an empty table there renders
// every player's salary as $0 rather than as missing. The expensive reads (the
// walk, the snapshot recompute) run BEFORE the transaction opens so the write
// holds its locks for about a second rather than the 9-25s the whole job takes.
const generate_roster_asset_lineage = async ({
  lid,
  year = null,
  skip_snapshots = false
}) => {
  log(`generating roster asset lineage for league ${lid}`)

  const league = await db('leagues')
    .select('uid', 'salary_attribution_rule')
    .where('uid', lid)
    .first()
  if (!league) {
    log(`league ${lid} not found`)
    return { coverage_warning: 'league_not_found' }
  }
  if (
    league.salary_attribution_rule !== SALARY_ATTRIBUTION_RULE.START_TEAM_BEARS
  ) {
    log(
      `coverage_warning: salary_attribution_rule=${league.salary_attribution_rule} not implemented; skipping lid=${lid}`
    )
    return {
      coverage_warning: 'unsupported_rule',
      rule: league.salary_attribution_rule
    }
  }

  const { holding_drafts, transformation_drafts, coverage_warnings } =
    await walk_transactions({ lid })

  log(
    `walked ${holding_drafts.length} holding drafts, ${transformation_drafts.length} transformation drafts`
  )
  if (Object.keys(coverage_warnings).length) {
    log(
      `coverage_warnings (uncovered transaction_types): ${JSON.stringify(coverage_warnings)}`
    )
  }

  const draft_to_year_format = new Map()
  for (const draft of holding_drafts) {
    const draft_year = draft.year
    if (!draft_to_year_format.has(draft_year)) {
      const hash = await resolve_league_format_id({ lid, year: draft_year })
      draft_to_year_format.set(draft_year, hash)
    }
    draft.league_format_id = draft_to_year_format.get(draft_year)
  }

  // Snapshot computation: bulk-loaded reference indexes + in-memory iteration.
  const filtered_drafts = year
    ? holding_drafts.filter((d) => d.year === year)
    : holding_drafts
  log(`computing snapshots for ${filtered_drafts.length} holding drafts`)
  const snapshots_by_draft_id = new Map()
  if (!skip_snapshots) {
    const snapshots = await compute_snapshots_bulk({
      lid,
      holding_drafts: filtered_drafts
    })
    for (const s of snapshots) {
      snapshots_by_draft_id.set(s.draft_id, s.snapshot)
    }
    log(`computed ${snapshots.length} snapshots`)
  }

  const holding_rows = filtered_drafts.map((draft) => {
    const snap = snapshots_by_draft_id.get(draft.draft_id) || {}
    return {
      lid,
      tid: draft.tid,
      asset_type: draft.asset_type,
      player_id: draft.player_id || null,
      pick_year: draft.pick_year || null,
      pick_round: draft.pick_round || null,
      pick_original_owner_tid: draft.pick_original_owner_tid || null,
      pick_draft_overall_position: draft.pick_draft_overall_position || null,
      period_start: draft.period_start,
      period_end: draft.period_end,
      league_format_id: draft.league_format_id,
      salary_paid: draft.salary_paid ?? null,
      salary_basis: draft.salary_basis,
      initial_slot_type: snap.initial_slot_type ?? null,
      ps_slot_subtype: snap.ps_slot_subtype ?? null,
      weeks_active: snap.weeks_active || 0,
      weeks_practice_squad: snap.weeks_practice_squad || 0,
      weeks_reserve_short_term: snap.weeks_reserve_short_term || 0,
      weeks_reserve_long_term: snap.weeks_reserve_long_term || 0,
      weeks_covid_reserve: snap.weeks_covid_reserve || 0,
      weeks_started: snap.weeks_started || 0,
      projected_pts_added_at_acquisition:
        snap.projected_pts_added_at_acquisition ?? null,
      realized_pts_added_net_through_termination:
        snap.realized_pts_added_net_through_termination ?? null,
      realized_pts_added_earned_through_termination:
        snap.realized_pts_added_earned_through_termination ?? null,
      realized_pts_added_net_in_active_slot:
        snap.realized_pts_added_net_in_active_slot ?? null,
      realized_pts_added_net_in_started_slot:
        snap.realized_pts_added_net_in_started_slot ?? null,
      realized_pts_added_net_in_practice_squad_slot:
        snap.realized_pts_added_net_in_practice_squad_slot ?? null,
      projected_pts_added_remaining_at_termination: null,
      keeptradecut_value_at_acquisition:
        snap.keeptradecut_value_at_acquisition ?? null,
      keeptradecut_value_at_termination:
        snap.keeptradecut_value_at_termination ?? null,
      terminated_by: draft.terminated_by || TERMINATED_BY.STILL_HELD,
      is_rookie_tag: draft.is_rookie_tag === true,
      protected_for_year: draft.protected_for_year ?? null,
      super_priority_until: draft.super_priority_until ?? null,
      is_audit_corrected: false,
      correction_note: null,
      __draft_id: draft.draft_id
    }
  })

  // Everything above this point is read-only. The swap below -- clear the
  // league's three lineage tables and repopulate them -- is the only part that
  // must be atomic, so it is the only part inside the transaction.
  let audit_corrections_applied = 0
  let refreshed = 0
  let transformation_row_count = 0

  await db.transaction(async (trx) => {
    await trx('roster_asset_transformation').where('lid', lid).del()
    await trx('roster_asset_holding').where('lid', lid).del()
    await trx('player_team_extension_state').where('lid', lid).del()

    // Persist holdings; capture generated holding_ids by __draft_id for edge resolution.
    const draft_id_to_holding_id = new Map()
    if (holding_rows.length) {
      for (let i = 0; i < holding_rows.length; i += BATCH_SIZE) {
        const slice = holding_rows.slice(i, i + BATCH_SIZE).map((r) => {
          const { __draft_id, ...rest } = r
          return rest
        })
        const draft_ids = holding_rows
          .slice(i, i + BATCH_SIZE)
          .map((r) => r.__draft_id)
        const inserted = await trx('roster_asset_holding')
          .insert(slice)
          .returning('holding_id')
        inserted.forEach((row, idx) => {
          draft_id_to_holding_id.set(draft_ids[idx], row.holding_id)
        })
      }
    }
    log(`inserted ${holding_rows.length} roster_asset_holding rows`)

    // Resolve transformation source/target holding_id references.
    const transformation_rows = transformation_drafts.map((t) => ({
      transformation_id: t.transformation_id,
      lid: t.lid,
      transaction_id: t.transaction_id,
      trade_uid: t.trade_uid ?? null,
      transformation_type: t.transformation_type,
      occurred_at: t.occurred_at,
      source_holding_id: t.source_draft_id
        ? draft_id_to_holding_id.get(t.source_draft_id) || null
        : null,
      target_holding_id: t.target_draft_id
        ? draft_id_to_holding_id.get(t.target_draft_id) || null
        : null,
      source_share: t.source_share,
      target_share: t.target_share,
      is_audit_corrected: false
    }))
    transformation_row_count = transformation_rows.length
    if (transformation_rows.length) {
      await batch_insert({
        items: transformation_rows,
        save: (items) => trx('roster_asset_transformation').insert(items),
        batch_size: BATCH_SIZE
      })
    }
    log(
      `inserted ${transformation_rows.length} roster_asset_transformation rows`
    )

    // Apply audit-corrections seed: flag holdings keyed by (lid, tid, player_id,
    // period_start_ts) with is_audit_corrected=true and a correction_note. Each
    // entry is expected to match exactly one holding; mismatches surface as
    // log warnings rather than errors so a rebuild on a different league does
    // not fail on unrelated seed entries.
    for (const entry of audit_corrections) {
      if (entry.lid !== lid) continue
      const period_start = new Date(entry.period_start_ts * 1000)
      const updated = await trx('roster_asset_holding')
        .where({
          lid: entry.lid,
          tid: entry.tid,
          player_id: entry.player_id,
          period_start
        })
        .update({
          is_audit_corrected: true,
          correction_note: entry.correction_note
        })
      if (updated === 0) {
        log(
          `audit-correction seed did not match any holding: lid=${entry.lid} tid=${entry.tid} player_id=${entry.player_id} period_start_ts=${entry.period_start_ts}`
        )
      } else {
        audit_corrections_applied += updated
      }
    }
    log(`applied ${audit_corrections_applied} audit-correction seed entries`)

    // Final pass: refresh denormalized extension state, on the same
    // transaction so it commits with the holdings it is derived from.
    refreshed = await refresh_extension_state({ lid, trx })
    log(`refreshed ${refreshed} player_team_extension_state rows`)
  })

  return {
    holdings: holding_rows.length,
    transformations: transformation_row_count,
    extension_state_rows: refreshed,
    coverage_warnings
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    if (argv.all) {
      const leagues = await db('leagues')
        .select('uid')
        .where({ is_hosted: true })
        .whereNull('archived_at')
      for (const league of leagues) {
        await generate_roster_asset_lineage({
          lid: league.uid,
          year: argv.year || null
        })
      }
    } else if (argv.lid) {
      await generate_roster_asset_lineage({
        lid: argv.lid,
        year: argv.year || null,
        skip_snapshots: argv.skip_snapshots
      })
    } else {
      throw new Error('must pass --lid or --all')
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_ROSTER_ASSET_LINEAGE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_roster_asset_lineage
