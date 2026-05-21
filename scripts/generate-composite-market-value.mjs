import debug from 'debug'
import dayjs from 'dayjs'

import db from '#db'
import { is_main, batch_insert } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

import extract_ktc_per_asset from '#libs-server/composite-market-value/extract-ktc-per-asset.mjs'
import extract_adp_per_asset from '#libs-server/composite-market-value/extract-adp-per-asset.mjs'
import extract_rankings_per_asset from '#libs-server/composite-market-value/extract-rankings-per-asset.mjs'
import extract_props_per_asset from '#libs-server/composite-market-value/extract-props-per-asset.mjs'
import {
  load_fc_format_map, index_by_pid, latest_in_window_by_pid
} from '#libs-server/composite-market-value/utils.mjs'
import { run_cmv_script } from '#libs-server/composite-market-value/script-runner.mjs'

// Daily blender: per (format_category, date), reads each source's native
// values, applies persisted calibration onto the KTC axis, then takes a
// coverage-aware weighted average per asset (sources missing within their
// staleness window contribute 0 weight; remaining weights re-normalize).
//
// Staleness windows (days):
//   KTC      N=2
//   ADP      N=14
//   RANKINGS N=14
//   PROPS    N=30   (per Topic 1 resolution: season-long market cadence ~2 weeks)
//
// Picks: v1 emits no pick composite rows. draft_pick_model is the only intended
// pick source but slot-to-otid mapping is deferred.
//
// CRITICAL: if no calibration row exists for a non-KTC source on a given
// (format_category, date) cell, the cell is skipped with a warning rather than
// passing raw native values through. Without calibration, KTC (0-10000) and
// pts-added (0-50) would blend into garbage.

const log = debug('generate-composite-market-value')
debug.enable('generate-composite-market-value')

const SOURCES = { KTC: 1, ADP: 2, RANKINGS: 3, PROPS: 4 }
const STALENESS = { KTC: 2, ADP: 14, RANKINGS: 14, PROPS: 30 }

const generate_for_date_and_category = async ({
  date_iso, format_category, mapping, league_format_hash, scoring_format_hash,
  player_ids, weights, calibrations
}) => {
  const required_sources = [SOURCES.ADP, SOURCES.RANKINGS, SOURCES.PROPS]
  const calib_by_source = new Map(calibrations.map((c) => [c.source, c]))
  const missing = required_sources.filter((s) => !calib_by_source.has(s))
  if (missing.length === required_sources.length) {
    log(`WARN: no calibration rows for format_category=${format_category} date=${date_iso}; skipping`)
    return []
  }

  const window_start = dayjs(date_iso).subtract(35, 'day').format('YYYY-MM-DD')
  const ktc = await extract_ktc_per_asset({
    player_ids, ktc_qb_axis: mapping.ktc_qb_axis,
    start_date: window_start, end_date: date_iso
  })
  const adp = await extract_adp_per_asset({
    player_ids, adp_type: mapping.adp_type, league_format_hash,
    start_date: window_start, end_date: date_iso
  })
  const rankings = await extract_rankings_per_asset({
    player_ids, ranking_type: mapping.ranking_type, league_format_hash,
    start_date: window_start, end_date: date_iso
  })
  const props = await extract_props_per_asset({
    player_ids, scoring_format_hash,
    start_date: window_start, end_date: date_iso
  })

  const ktc_idx = index_by_pid(ktc)
  const adp_idx = index_by_pid(adp)
  const rank_idx = index_by_pid(rankings)
  const props_idx = index_by_pid(props)

  // Calibration must exist for a source to contribute; if absent, treat that
  // source as missing for this cell (so its weight redistributes).
  const apply_calib = (source_id, v) => {
    if (v == null) return null
    const c = calib_by_source.get(source_id)
    if (!c) return null
    return Number(c.scale_factor) * v + Number(c.intercept)
  }

  // Constant per call — hoist out of the per-player loop.
  const w_ktc = Number(weights.ktc_weight)
  const w_adp = Number(weights.adp_weight)
  const w_rank = Number(weights.rankings_weight)
  const w_props = Number(weights.props_weight)
  const intended_player_weight = w_ktc + w_adp + w_rank + w_props

  const rows = []
  for (const pid of player_ids) {
    const k_native = latest_in_window_by_pid(ktc_idx, pid, date_iso, STALENESS.KTC)
    const a_native = latest_in_window_by_pid(adp_idx, pid, date_iso, STALENESS.ADP)
    const r_native = latest_in_window_by_pid(rank_idx, pid, date_iso, STALENESS.RANKINGS)
    const p_native = latest_in_window_by_pid(props_idx, pid, date_iso, STALENESS.PROPS)

    const k_cal = k_native != null ? k_native : null  // KTC self-identity
    const a_cal = apply_calib(SOURCES.ADP, a_native)
    const r_cal = apply_calib(SOURCES.RANKINGS, r_native)
    const p_cal = apply_calib(SOURCES.PROPS, p_native)

    const pairs = [
      [k_cal, w_ktc],
      [a_cal, w_adp],
      [r_cal, w_rank],
      [p_cal, w_props]
    ]
    const present = pairs.filter(([v]) => v != null)
    if (!present.length) continue
    const weight_sum = present.reduce((s, [, w]) => s + w, 0)
    if (weight_sum === 0) continue
    const composite = present.reduce((s, [v, w]) => s + v * (w / weight_sum), 0)
    const coverage = intended_player_weight > 0 ? Math.min(1, weight_sum / intended_player_weight) : 0

    rows.push({
      format_category,
      asset_type: 1,
      player_id: pid,
      pick_year: null,
      pick_round: null,
      pick_original_owner_tid: null,
      date: date_iso,
      ktc_value: k_cal != null ? Number(k_cal.toFixed(1)) : null,
      adp_value: a_cal != null ? Number(a_cal.toFixed(1)) : null,
      rankings_value: r_cal != null ? Number(r_cal.toFixed(1)) : null,
      props_value: p_cal != null ? Number(p_cal.toFixed(1)) : null,
      draft_pick_model_value: null,
      composite_value: Number(composite.toFixed(1)),
      composite_coverage_score: Number(coverage.toFixed(2)),
      blend_weights_version_id: weights.version_id
    })
  }

  return rows
}

const generate_composite_market_value = async ({ start_date, end_date, rebuild = false }) => {
  log(`generating composite market value ${start_date} -> ${end_date}`)

  const mappings = await db('format_category_signal_mapping').orderBy('format_category')
  const fc_format = await load_fc_format_map()

  const default_weights = await db('composite_market_value_blend_weights')
    .whereNull('format_category')
    .orderBy('effective_from', 'desc')
    .first()
  if (!default_weights) throw new Error('no default blend weights configured')

  const player_ids = (await db('keeptradecut_rankings')
    .distinct('pid')
    .where('d', '>=', Math.floor(new Date(start_date).getTime() / 1000) - 86400 * 35)
    .where('d', '<=', Math.floor(new Date(end_date).getTime() / 1000) + 86400)
    .where('pid', 'NOT LIKE', 'KTCPICK%')).map((r) => r.pid)
  log(`player universe size: ${player_ids.length}`)

  if (rebuild) {
    await db('composite_market_value_daily')
      .where('date', '>=', start_date)
      .where('date', '<=', end_date).del()
  }

  let total = 0
  let cur = dayjs(start_date)
  const end = dayjs(end_date)
  while (cur.isBefore(end) || cur.isSame(end)) {
    const date_iso = cur.format('YYYY-MM-DD')
    for (const m of mappings) {
      const fmt = fc_format.get(m.format_category)
      if (!fmt) continue
      const calibrations = await db('composite_market_value_calibration')
        .where('format_category', m.format_category)
        .where('date', date_iso)
      const weights_row = await db('composite_market_value_blend_weights')
        .where('format_category', m.format_category)
        .where('effective_from', '<=', date_iso)
        .orderBy('effective_from', 'desc')
        .first()
      const weights = weights_row || default_weights
      const player_rows = await generate_for_date_and_category({
        date_iso, format_category: m.format_category, mapping: m,
        league_format_hash: fmt.league_format_hash,
        scoring_format_hash: fmt.scoring_format_hash,
        player_ids, weights, calibrations
      })
      if (player_rows.length) {
        await batch_insert({
          items: player_rows,
          save: (items) => db('composite_market_value_daily')
            .insert(items)
            .onConflict(db.raw('(format_category, player_id, date) WHERE asset_type = 1'))
            .merge(),
          batch_size: 5000
        })
        total += player_rows.length
      }
    }
    cur = cur.add(1, 'day')
  }
  log(`inserted/merged ${total} composite rows`)
  return { rows: total }
}

if (is_main(import.meta.url)) {
  run_cmv_script({
    job_type: job_types.GENERATE_COMPOSITE_MARKET_VALUE,
    fn: generate_composite_market_value,
    log
  })
}

export default generate_composite_market_value
