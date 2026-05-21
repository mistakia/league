import debug from 'debug'
import dayjs from 'dayjs'

import db from '#db'
import { is_main, batch_insert } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

import extract_ktc_per_asset from '#libs-server/composite-market-value/extract-ktc-per-asset.mjs'
import extract_adp_per_asset from '#libs-server/composite-market-value/extract-adp-per-asset.mjs'
import extract_rankings_per_asset from '#libs-server/composite-market-value/extract-rankings-per-asset.mjs'
import extract_props_per_asset from '#libs-server/composite-market-value/extract-props-per-asset.mjs'
import { load_fc_format_map, index_by_pid } from '#libs-server/composite-market-value/utils.mjs'
import { run_cmv_script } from '#libs-server/composite-market-value/script-runner.mjs'

// Nightly per-(source, format_category, date) linear calibration of native
// source values onto the KTC axis. OLS regression on the overlap set; falls
// back to scale=1, intercept=0 when:
//   - overlap_sample_size < 30  -> fallback_reason = 'calibration_undersized'
//   - r_squared < 0.5           -> fallback_reason = 'calibration_low_r_squared'
//
// Persisted in composite_market_value_calibration for reproducibility.
// Topic 3 resolution: OLS tail-flattening is documented v1 limitation;
// v2 follow-up evaluates isotonic / rank-percentile.

const log = debug('calibrate-composite-market-value-sources')
debug.enable('calibrate-composite-market-value-sources')

const SOURCES = { KTC: 1, ADP: 2, RANKINGS: 3, PROPS: 4 }
const OVERLAP_FLOOR = 30
const R_SQUARED_FLOOR = 0.5

const ols = (xs, ys) => {
  const n = xs.length
  if (n < 2) return { scale: 1, intercept: 0, r2: null }
  let sx = 0; let sy = 0; let sxx = 0; let sxy = 0; let syy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i]
    sxx += xs[i] * xs[i]
    sxy += xs[i] * ys[i]
    syy += ys[i] * ys[i]
  }
  const denom = n * sxx - sx * sx
  if (denom === 0) return { scale: 1, intercept: 0, r2: null }
  const scale = (n * sxy - sx * sy) / denom
  const intercept = (sy - scale * sx) / n
  const ss_tot = syy - (sy * sy) / n
  const ss_res = syy - intercept * sy - scale * sxy
  const r2 = ss_tot > 0 ? Math.max(0, 1 - ss_res / ss_tot) : null
  return { scale, intercept, r2 }
}

const latest_in_window = (pid_idx, pid) => {
  const arr = pid_idx.get(pid)
  if (!arr || !arr.length) return null
  return arr[arr.length - 1].v
}

const calibrate_for_date_and_category = async ({
  date_iso, format_category, mapping, league_format_hash, scoring_format_hash, player_ids
}) => {
  const window_start = dayjs(date_iso).subtract(30, 'day').format('YYYY-MM-DD')
  const ktc = await extract_ktc_per_asset({
    player_ids, ktc_qb_axis: mapping.ktc_qb_axis, start_date: window_start, end_date: date_iso
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
    player_ids, scoring_format_hash, start_date: window_start, end_date: date_iso
  })

  const ktc_idx = index_by_pid(ktc)
  const adp_idx = index_by_pid(adp)
  const rank_idx = index_by_pid(rankings)
  const props_idx = index_by_pid(props)

  const rows = []
  for (const [source_id, source_idx] of [
    [SOURCES.ADP, adp_idx],
    [SOURCES.RANKINGS, rank_idx],
    [SOURCES.PROPS, props_idx]
  ]) {
    const xs = []; const ys = []
    for (const pid of player_ids) {
      const s = latest_in_window(source_idx, pid)
      const k = latest_in_window(ktc_idx, pid)
      if (s != null && k != null) { xs.push(s); ys.push(k) }
    }
    const n = xs.length
    let scale = 1; let intercept = 0; let r2 = null; let fallback = null
    if (n < OVERLAP_FLOOR) {
      fallback = 'calibration_undersized'
    } else {
      const fit = ols(xs, ys)
      if (fit.r2 != null && fit.r2 < R_SQUARED_FLOOR) {
        fallback = 'calibration_low_r_squared'
        r2 = fit.r2
      } else {
        scale = fit.scale; intercept = fit.intercept; r2 = fit.r2
      }
    }
    rows.push({
      source: source_id,
      format_category,
      date: date_iso,
      scale_factor: Number(scale.toFixed(4)),
      intercept: Number(intercept.toFixed(3)),
      overlap_sample_size: n,
      r_squared: r2 != null ? Number(r2.toFixed(3)) : null,
      fallback_reason: fallback
    })
  }

  // KTC self-calibration is identity by definition
  rows.push({
    source: SOURCES.KTC,
    format_category,
    date: date_iso,
    scale_factor: 1.0,
    intercept: 0,
    overlap_sample_size: ktc_idx.size,
    r_squared: null,
    fallback_reason: null
  })

  return rows
}

const calibrate_composite_market_value_sources = async ({ start_date, end_date, rebuild = false }) => {
  log(`calibrating composite market value sources ${start_date} -> ${end_date}`)

  const mappings = await db('format_category_signal_mapping').orderBy('format_category')
  const fc_format = await load_fc_format_map()

  const player_ids = (await db('keeptradecut_rankings')
    .distinct('pid')
    .where('d', '>=', Math.floor(new Date(start_date).getTime() / 1000))
    .where('d', '<=', Math.floor(new Date(end_date).getTime() / 1000) + 86400)
    .where('pid', 'NOT LIKE', 'KTCPICK%')).map((r) => r.pid)

  if (rebuild) {
    await db('composite_market_value_calibration')
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
      const rows = await calibrate_for_date_and_category({
        date_iso, format_category: m.format_category, mapping: m,
        league_format_hash: fmt.league_format_hash,
        scoring_format_hash: fmt.scoring_format_hash, player_ids
      })
      await batch_insert({
        items: rows,
        save: (items) => db('composite_market_value_calibration')
          .insert(items)
          .onConflict(['source', 'format_category', 'date'])
          .merge(),
        batch_size: 1000
      })
      total += rows.length
    }
    cur = cur.add(1, 'day')
  }
  log(`inserted/merged ${total} calibration rows`)
  return { rows: total }
}

if (is_main(import.meta.url)) {
  run_cmv_script({
    job_type: job_types.CALIBRATE_COMPOSITE_MARKET_VALUE_SOURCES,
    fn: calibrate_composite_market_value_sources,
    log
  })
}

export default calibrate_composite_market_value_sources
