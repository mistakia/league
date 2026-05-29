import dayjs from 'dayjs'

import db from '#db'
import { roster_slot_types } from '#constants/roster-constants.mjs'
import { keeptradecut_metric_types } from '#constants'
import {
  load_pick_ktc_indexes,
  ktc_pick_at
} from '#libs-server/composite-market-value/ktc-pick-value-at.mjs'

import { ASSET_TYPE, INITIAL_SLOT_TYPE, PS_SLOT_SUBTYPE } from './constants.mjs'

// Tolerate the in-flight format-id migration: until
// db/adhoc/2026-05-28-format-id-migration.sql is applied to prod the
// physical column on the format-keyed tables is still `league_format_hash`.
// Detect once per call; remove this shim after the migration lands.
const detect_format_column = async (table_name) => {
  const row = await db('information_schema.columns')
    .select('column_name')
    .where({ table_name })
    .whereIn('column_name', ['league_format_id', 'league_format_hash'])
    .first()
  return row?.column_name || 'league_format_id'
}

// Bulk snapshot computation. Pre-loads all reference data the per-holding
// snapshots need (KTC rankings, gamelogs, rosters_players, projection values,
// draft_pick_value, esbid->week, league_formats), then iterates the holding
// drafts in-memory.
//
// Contract salary (`salary_paid`) is set at acquisition time in
// walk-transactions.mjs from the originating finalized transaction value
// (or carried forward across trade legs). This pass does not touch it; cap
// attribution (START_TEAM_BEARS) is the concern of separate queries that
// sum holdings per (tid, year), not of the holding row itself.
//
// Replaces the per-holding sequential-query approach in the four
// compute-*-snapshot.mjs helpers when invoked from the generator. The helpers
// remain useful for ad-hoc one-off lookups.

const PS_SLOT_SET = new Set([
  roster_slot_types.PS,
  roster_slot_types.PSP,
  roster_slot_types.PSD,
  roster_slot_types.PSDP
])
const ACTIVE_SLOT_SET = new Set([
  roster_slot_types.QB,
  roster_slot_types.RB,
  roster_slot_types.WR,
  roster_slot_types.TE,
  roster_slot_types.WRTE,
  roster_slot_types.RBWR,
  roster_slot_types.RBWRTE,
  roster_slot_types.QBRBWRTE,
  roster_slot_types.K,
  roster_slot_types.DST,
  roster_slot_types.BENCH
])
const STARTING_SLOT_SET = new Set([
  roster_slot_types.QB,
  roster_slot_types.RB,
  roster_slot_types.WR,
  roster_slot_types.TE,
  roster_slot_types.WRTE,
  roster_slot_types.RBWR,
  roster_slot_types.RBWRTE,
  roster_slot_types.QBRBWRTE,
  roster_slot_types.K,
  roster_slot_types.DST
])
const PS_DRAFTED_SLOT_SET = new Set([
  roster_slot_types.PSD,
  roster_slot_types.PSDP
])
const PS_SIGNED_SLOT_SET = new Set([
  roster_slot_types.PS,
  roster_slot_types.PSP
])

const initial_slot_family = (slot) => {
  if (slot == null) return null
  if (PS_SLOT_SET.has(slot)) return INITIAL_SLOT_TYPE.PRACTICE_SQUAD
  if (ACTIVE_SLOT_SET.has(slot)) return INITIAL_SLOT_TYPE.ACTIVE
  if (slot === roster_slot_types.RESERVE_SHORT_TERM)
    return INITIAL_SLOT_TYPE.RESERVE_SHORT_TERM
  if (slot === roster_slot_types.RESERVE_LONG_TERM)
    return INITIAL_SLOT_TYPE.RESERVE_LONG_TERM
  if (slot === roster_slot_types.COV) return INITIAL_SLOT_TYPE.COV
  return null
}

const ps_subtype = (slot) => {
  if (PS_DRAFTED_SLOT_SET.has(slot)) return PS_SLOT_SUBTYPE.DRAFTED_PS
  if (PS_SIGNED_SLOT_SET.has(slot)) return PS_SLOT_SUBTYPE.SIGNED_PS
  return null
}

const load_indexes = async ({ lid, player_ids, years, format_hashes }) => {
  const idx = {}

  // KTC: keyed pid -> sorted array of {d, v}
  if (player_ids.length) {
    const ktc_rows = await db('keeptradecut_rankings')
      .select('pid', 'v', 'd')
      .whereIn('pid', player_ids)
      .where('qb', 2)
      .where('type', keeptradecut_metric_types.VALUE)
      .orderBy('d', 'asc')
    idx.ktc = new Map()
    for (const r of ktc_rows) {
      if (!idx.ktc.has(r.pid)) idx.ktc.set(r.pid, [])
      idx.ktc.get(r.pid).push({ d: r.d, v: Number(r.v) })
    }
  } else {
    idx.ktc = new Map()
  }

  // rosters_players: keyed `${tid}__${pid}__${year}` -> {week, slot}[]
  idx.rosters = new Map()
  if (player_ids.length && years.length) {
    const rp_rows = await db('rosters_players')
      .select('tid', 'pid', 'year', 'week', 'slot')
      .where('lid', lid)
      .whereIn('pid', player_ids)
      .whereIn('year', years)
    for (const r of rp_rows) {
      const k = `${r.tid}__${r.pid}__${r.year}`
      if (!idx.rosters.has(k)) idx.rosters.set(k, [])
      idx.rosters.get(k).push({ week: r.week, slot: r.slot })
    }
  }

  // gamelogs: keyed `${pid}__${format_hash}` -> Map(esbid -> {net, earned})
  idx.gamelogs = new Map()
  if (player_ids.length && format_hashes.length) {
    const gl_col = await detect_format_column('league_format_player_gamelogs')
    const gl_rows = await db('league_format_player_gamelogs')
      .select(
        'pid',
        'esbid',
        `${gl_col} as league_format_id`,
        'points_added_net',
        'points_added_earned'
      )
      .whereIn('pid', player_ids)
      .whereIn(gl_col, format_hashes)
    for (const r of gl_rows) {
      const k = `${r.pid}__${r.league_format_id}`
      if (!idx.gamelogs.has(k)) idx.gamelogs.set(k, new Map())
      idx.gamelogs.get(k).set(r.esbid, {
        net: r.points_added_net != null ? Number(r.points_added_net) : 0,
        earned:
          r.points_added_earned != null ? Number(r.points_added_earned) : 0
      })
    }
  }

  // esbid -> (year, week) for the year range
  idx.esbid_to_yw = new Map()
  // (year, week) -> earliest game timestamp (unix sec). Used to assign each
  // rosters_players row to the holding active at that NFL week. Week 0
  // (preseason placeholder) is synthesized as week 1 minus 7 days; weeks
  // without games keep no anchor and are skipped conservatively.
  idx.week_anchor = new Map()
  if (years.length) {
    const games = await db('nfl_games')
      .select('esbid', 'year', 'week', 'seas_type', 'timestamp')
      .whereIn('year', years)
      .whereIn('seas_type', ['REG', 'POST'])
    for (const g of games) {
      if (g.seas_type === 'REG') {
        idx.esbid_to_yw.set(g.esbid, { year: g.year, week: g.week })
      }
      const k = `${g.year}__${g.week}`
      const ts = g.timestamp != null ? Number(g.timestamp) : null
      if (ts == null) continue
      const prior = idx.week_anchor.get(k)
      if (prior == null || ts < prior) idx.week_anchor.set(k, ts)
    }
    for (const y of years) {
      const w1 = idx.week_anchor.get(`${y}__1`)
      if (w1 != null) idx.week_anchor.set(`${y}__0`, w1 - 7 * 24 * 3600)
    }
  }

  // projections: keyed `${pid}__${format_hash}__${year}` -> pts_added.
  //
  // Uses week='0' (preseason rest-of-season) rather than week='ros'. The 'ros'
  // rows are a current-state rollup that is only refreshed for the active
  // year of each league_format_id, so historical holdings never matched and
  // projected_pts_added_at_acquisition stayed NULL across all 2020-2025 player
  // holdings. week='0' is a per-year preseason ros snapshot that exists for
  // every historical year and is the projection the market was looking at the
  // start of the season -- the correct "what was knowable" oracle for the
  // offseason/early-season acquisitions that dominate the holding population.
  // The -999 sentinel indicates "no projection available" and is dropped.
  idx.projections = new Map()
  if (player_ids.length && format_hashes.length && years.length) {
    const proj_col = await detect_format_column(
      'league_format_player_projection_values'
    )
    const proj_rows = await db('league_format_player_projection_values')
      .select('pid', `${proj_col} as league_format_id`, 'year', 'pts_added')
      .whereIn('pid', player_ids)
      .whereIn(proj_col, format_hashes)
      .whereIn('year', years)
      .where('week', '0')
    for (const r of proj_rows) {
      if (r.pts_added == null) continue
      const v = Number(r.pts_added)
      if (v <= -900) continue
      const k = `${r.pid}__${r.league_format_id}__${r.year}`
      idx.projections.set(k, v)
    }
  }

  // draft_pick_value: keyed `${format_hash}__${rank}` -> value
  idx.pick_values = new Map()
  if (format_hashes.length) {
    const pv_col = await detect_format_column('league_format_draft_pick_value')
    const pv_rows = await db('league_format_draft_pick_value')
      .select(
        `${pv_col} as league_format_id`,
        'rank',
        'median_best_season_points_added_per_game'
      )
      .whereIn(pv_col, format_hashes)
    for (const r of pv_rows) {
      const k = `${r.league_format_id}__${r.rank}`
      idx.pick_values.set(
        k,
        r.median_best_season_points_added_per_game != null
          ? Number(r.median_best_season_points_added_per_game)
          : null
      )
    }
  }

  // num_teams per league_format_id
  idx.num_teams = new Map()
  if (format_hashes.length) {
    const lf_col = await detect_format_column('league_formats')
    const lf_id_col = lf_col === 'league_format_hash' ? lf_col : 'id'
    const f_rows = await db('league_formats')
      .select(`${lf_id_col} as id`, 'num_teams')
      .whereIn(lf_id_col, format_hashes)
    for (const r of f_rows) {
      idx.num_teams.set(r.id, r.num_teams)
    }
  }

  // Pick KTC indexes (superflex qb-axis; matches the player-side query above).
  // Loaded once across all picks the snapshot pass will touch.
  idx.pick_ktc = await load_pick_ktc_indexes({ qb_axis: 2 })

  return idx
}

const ktc_at = (idx, pid, target_unix) => {
  const rows = idx.ktc.get(pid)
  if (!rows || !rows.length) return null
  // Binary search for largest d <= target_unix; small N typical, linear OK.
  let last_le = null
  for (const r of rows) {
    if (r.d <= target_unix) last_le = r
    else break
  }
  if (last_le) return last_le.v
  return rows[0].v
}

const compute_snapshot_for_draft = ({ draft, lid, idx }) => {
  const period_start = draft.period_start
  const period_end = draft.period_end
  const start_unix = Math.floor(period_start.getTime() / 1000)
  const end_unix = period_end ? Math.floor(period_end.getTime() / 1000) : null
  const result = {
    weeks_active: 0,
    weeks_practice_squad: 0,
    weeks_reserve_short_term: 0,
    weeks_reserve_long_term: 0,
    weeks_cov: 0,
    weeks_started: 0,
    initial_slot_type: null,
    ps_slot_subtype: null,
    realized_pts_added_net_through_termination: 0,
    realized_pts_added_earned_through_termination: 0,
    realized_pts_added_net_in_active_slot: 0,
    realized_pts_added_net_in_started_slot: 0,
    realized_pts_added_net_in_practice_squad_slot: 0,
    projected_pts_added_at_acquisition: null,
    composite_market_value_at_acquisition: null,
    composite_market_value_at_termination: null
  }

  if (draft.asset_type === ASSET_TYPE.PLAYER && draft.player_id) {
    result.composite_market_value_at_acquisition = ktc_at(
      idx,
      draft.player_id,
      start_unix
    )
    if (end_unix)
      result.composite_market_value_at_termination = ktc_at(
        idx,
        draft.player_id,
        end_unix
      )

    if (draft.league_format_id) {
      const proj_key = `${draft.player_id}__${draft.league_format_id}__${draft.year}`
      result.projected_pts_added_at_acquisition =
        idx.projections.get(proj_key) ?? null
    }

    // Slot weeks + realized. Each rosters_players row is bucketed to one
    // holding by anchoring (year, week) to that week's first NFL-game
    // timestamp and accepting only rows whose anchor falls within the
    // holding's [period_start, period_end) window. Without this filter
    // adjacent holdings on the same (tid, pid) double-count overlapping
    // seasons because the year iteration pulls every (tid, pid, y) row.
    const start_year = dayjs(period_start).year()
    const end_year = dayjs(period_end || new Date()).year()
    const period_end_unix =
      end_unix == null ? Number.MAX_SAFE_INTEGER : end_unix
    let first_row = null
    for (let y = start_year; y <= end_year; y++) {
      const rows = idx.rosters.get(`${draft.tid}__${draft.player_id}__${y}`)
      if (!rows) continue
      for (const r of rows) {
        const anchor = idx.week_anchor.get(`${y}__${r.week}`)
        if (anchor == null) continue
        if (anchor < start_unix) continue
        if (anchor >= period_end_unix) continue
        if (!first_row) first_row = r
        const slot = r.slot
        if (PS_SLOT_SET.has(slot)) result.weeks_practice_squad++
        else if (slot === roster_slot_types.RESERVE_SHORT_TERM)
          result.weeks_reserve_short_term++
        else if (slot === roster_slot_types.RESERVE_LONG_TERM)
          result.weeks_reserve_long_term++
        else if (slot === roster_slot_types.COV) result.weeks_cov++
        else if (ACTIVE_SLOT_SET.has(slot)) result.weeks_active++
        if (STARTING_SLOT_SET.has(slot)) result.weeks_started++

        // gamelog lookup
        if (draft.league_format_id) {
          const gl = idx.gamelogs.get(
            `${draft.player_id}__${draft.league_format_id}`
          )
          if (gl) {
            // find esbid(s) for (y, r.week)
            for (const [esbid, yw] of idx.esbid_to_yw) {
              if (yw.year !== y || yw.week !== r.week) continue
              const stats = gl.get(esbid)
              if (!stats) continue
              result.realized_pts_added_net_through_termination += stats.net
              result.realized_pts_added_earned_through_termination +=
                stats.earned
              if (ACTIVE_SLOT_SET.has(slot))
                result.realized_pts_added_net_in_active_slot += stats.net
              if (STARTING_SLOT_SET.has(slot))
                result.realized_pts_added_net_in_started_slot += stats.net
              if (PS_SLOT_SET.has(slot))
                result.realized_pts_added_net_in_practice_squad_slot +=
                  stats.net
            }
          }
        }
      }
    }
    if (first_row) {
      result.initial_slot_type = initial_slot_family(first_row.slot)
      result.ps_slot_subtype = ps_subtype(first_row.slot)
    }
  } else if (draft.asset_type === ASSET_TYPE.PICK) {
    // Pick projection: by rank if known else median of round.
    if (draft.league_format_id) {
      let rank = draft.pick_draft_overall_position
      if (rank == null && draft.pick_round != null) {
        const nt = idx.num_teams.get(draft.league_format_id)
        if (nt) rank = (draft.pick_round - 1) * nt + Math.ceil(nt / 2)
      }
      if (rank != null) {
        result.projected_pts_added_at_acquisition =
          idx.pick_values.get(`${draft.league_format_id}__${rank}`) ?? null
      }
    }
    // Pick market value via ktc_pick_at: KTC pick rankings exist from
    // 2023-09-08 onwards. The helper applies an analog-year fallback for
    // pre-data picks (matching round, slot, and years-out-from-target-date)
    // and returns null when neither path yields data.
    const nt = idx.num_teams.get(draft.league_format_id)
    if (nt && draft.pick_year != null && draft.pick_round != null) {
      result.composite_market_value_at_acquisition = ktc_pick_at({
        pick_year: draft.pick_year,
        pick_round: draft.pick_round,
        pick_overall_position: draft.pick_draft_overall_position,
        num_teams: nt,
        target_unix: start_unix,
        idx: idx.pick_ktc
      })
      if (end_unix) {
        result.composite_market_value_at_termination = ktc_pick_at({
          pick_year: draft.pick_year,
          pick_round: draft.pick_round,
          pick_overall_position: draft.pick_draft_overall_position,
          num_teams: nt,
          target_unix: end_unix,
          idx: idx.pick_ktc
        })
      }
    }
    // Realized: NULL by design for picks (salary_paid stays NULL via the
    // draft, since open_pick_holding never sets it).
    result.realized_pts_added_net_through_termination = null
    result.realized_pts_added_earned_through_termination = null
    result.realized_pts_added_net_in_active_slot = null
    result.realized_pts_added_net_in_started_slot = null
    result.realized_pts_added_net_in_practice_squad_slot = null
  }

  return result
}

const compute_snapshots_bulk = async ({ lid, holding_drafts }) => {
  const player_ids = Array.from(
    new Set(holding_drafts.filter((d) => d.player_id).map((d) => d.player_id))
  )
  const years_set = new Set()
  const format_hashes_set = new Set()
  for (const d of holding_drafts) {
    if (d.year) years_set.add(d.year)
    if (d.league_format_id) format_hashes_set.add(d.league_format_id)
  }
  const years = Array.from(years_set)
  const format_hashes = Array.from(format_hashes_set)

  const idx = await load_indexes({ lid, player_ids, years, format_hashes })

  const snapshots = []
  for (const draft of holding_drafts) {
    snapshots.push({
      draft_id: draft.draft_id,
      snapshot: compute_snapshot_for_draft({ draft, lid, idx })
    })
  }
  return snapshots
}

export default compute_snapshots_bulk
