// Repair non-SF *_REDRAFT history mislabeled by the pre-8bc488c4 fantasypros
// draft importer bug. Bug: OP run's superflex flag was dropped before being
// passed to format_ranking_type, so both ALL and OP runs wrote rows under
// non-SF labels. History table has no unique constraint -> both rows survive.
// This script splits ALL vs OP per row by combining:
//   stage 1: pos in (K, DST) -> forced ALL (these positions only appear in
//            the ALL fetch).
//   stage 2: set membership against the FantasyPros year-level API refs
//            (pid in A_only -> ALL; pid in O_only -> OP).
//   stage 3: 2x2 cost-matrix assignment for the duplicate pairs (row_a, row_b)
//            using rank distance to (all_ref_rank, op_ref_rank).
// Later stages (sleeper/ktc cross-check, manual heuristics) are stubbed and
// will be filled in iteratively after reviewing dry-run results.
//
// Default mode is --dry-run: writes to fp_redraft_salvage_audit but does NOT
// touch player_rankings_history. Pass --apply to perform the relabel UPDATE
// inside a transaction.

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, find_player_row, fantasypros } from '#libs-server'

const log = debug('repair-fantasypros-redraft-history')
debug.enable('repair-fantasypros-redraft-history,fantasypros,fetch,get-player')

const FIX_EPOCH = 1779000000
const SCOPE_RANKING_TYPES = [
  'STANDARD_REDRAFT',
  'PPR_REDRAFT',
  'HALF_PPR_REDRAFT'
]
const SCORING_FROM_LABEL = {
  STANDARD_REDRAFT: 'STD',
  PPR_REDRAFT: 'PPR',
  HALF_PPR_REDRAFT: 'HALF'
}
const SF_LABEL = {
  STANDARD_REDRAFT: 'STANDARD_SUPERFLEX_REDRAFT',
  PPR_REDRAFT: 'PPR_SUPERFLEX_REDRAFT',
  HALF_PPR_REDRAFT: 'HALF_PPR_SUPERFLEX_REDRAFT'
}
const SLEEPER_ALL_TYPE = {
  STANDARD_REDRAFT: 'STANDARD_REDRAFT',
  PPR_REDRAFT: 'PPR_REDRAFT',
  HALF_PPR_REDRAFT: 'HALF_PPR_REDRAFT'
}
const SLEEPER_OP_TYPE = {
  STANDARD_REDRAFT: 'STANDARD_SUPERFLEX_REDRAFT',
  PPR_REDRAFT: 'PPR_SUPERFLEX_REDRAFT',
  HALF_PPR_REDRAFT: 'HALF_PPR_SUPERFLEX_REDRAFT'
}

// Build {pid: rank_ecr} maps from the FP year-level API. Returns a nested
// structure refs[year][scoring] = { all: Map, op: Map } where each Map is
// pid -> overall_rank.
const build_fp_refs = async ({ years, scorings }) => {
  const refs = {}
  for (const year of years) {
    refs[year] = {}
    for (const scoring of scorings) {
      const result = { all: new Map(), op: new Map() }
      for (const [pos_key, target_map] of [['ALL', result.all], ['OP', result.op]]) {
        const data = await fantasypros.get_fantasypros_rankings({
          year,
          fantasypros_scoring_type: scoring,
          fantasypros_position_type: pos_key,
          ignore_cache: false
        })
        if (!data || !data.players) {
          throw new Error(`FP ref fetch failed: year=${year} scoring=${scoring} pos=${pos_key}`)
        }
        let resolved = 0
        let missing = 0
        for (const item of data.players) {
          let player_row
          try {
            player_row = await find_player_row({
              name: item.player_name,
              team: item.player_team_id,
              pos: item.player_position_id
            })
          } catch (err) {
            missing += 1
            continue
          }
          if (!player_row) {
            missing += 1
            continue
          }
          target_map.set(player_row.pid, Number(item.rank_ecr))
          resolved += 1
        }
        log(`refs: year=${year} scoring=${scoring} pos=${pos_key} resolved=${resolved} missing=${missing}`)
      }
      refs[year][scoring] = result
    }
  }
  return refs
}

// Identify the set of buggy timestamps (those that have at least one duplicate
// pid cluster under the non-SF *_REDRAFT labels, timestamp < FIX_EPOCH).
const get_buggy_timestamps = async () => {
  const rows = await db.raw(`
    SELECT DISTINCT timestamp FROM (
      SELECT timestamp, ranking_type, pid, COUNT(*) AS k
      FROM player_rankings_history
      WHERE source_id = 'FANTASYPROS'
        AND ranking_type IN ('STANDARD_REDRAFT','PPR_REDRAFT','HALF_PPR_REDRAFT')
        AND timestamp < ?
      GROUP BY timestamp, ranking_type, pid
    ) x WHERE k > 1
    ORDER BY timestamp
  `, [FIX_EPOCH])
  return rows.rows.map((r) => r.timestamp)
}

// Load all in-scope rows for the buggy timestamps.
const load_scope_rows = async ({ buggy_timestamps }) => {
  if (buggy_timestamps.length === 0) return []
  const rows = await db('player_rankings_history')
    .select('timestamp', 'pid', 'pos', 'year', 'ranking_type', 'overall_rank', 'min', 'max')
    .where({ source_id: 'FANTASYPROS' })
    .whereIn('ranking_type', SCOPE_RANKING_TYPES)
    .whereIn('timestamp', buggy_timestamps)
  return rows
}

// Group rows by (timestamp, ranking_type, pid) so we can tell singletons from
// pairs in a single linear pass.
const group_rows = (rows) => {
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.timestamp}|${row.ranking_type}|${row.pid}`
    let g = groups.get(key)
    if (!g) {
      g = []
      groups.set(key, g)
    }
    g.push(row)
  }
  return groups
}

const decide_stage_1 = ({ row }) => {
  if (row.pos === 'K' || row.pos === 'DST') {
    return { decision: 'ALL', stage: 1, confidence: 1.0, notes: 'pos=K/DST forced ALL' }
  }
  return null
}

const decide_stage_2 = ({ row, refs }) => {
  const scoring = SCORING_FROM_LABEL[row.ranking_type]
  const year_refs = refs[row.year]?.[scoring]
  if (!year_refs) return null
  const in_all = year_refs.all.has(row.pid)
  const in_op = year_refs.op.has(row.pid)
  if (in_all && !in_op) {
    return {
      decision: 'ALL',
      stage: 2,
      confidence: 0.95,
      all_ref_rank: year_refs.all.get(row.pid),
      op_ref_rank: null,
      notes: 'pid in A_only ref set'
    }
  }
  if (!in_all && in_op) {
    return {
      decision: 'OP',
      stage: 2,
      confidence: 0.95,
      all_ref_rank: null,
      op_ref_rank: year_refs.op.get(row.pid),
      notes: 'pid in O_only ref set'
    }
  }
  return null
}

// Generic 2x2 cost-matrix assignment given an ALL-bucket reference rank and
// an OP-bucket reference rank for the pair's shared pid. Used by stages 3
// (FP year refs), 4 (Sleeper nearest-ts ranks), and 5 (KTC qb1/qb2 ranks).
const assign_pair = ({ pair, all_ref_rank, op_ref_rank, stage, note_prefix }) => {
  if (pair.length !== 2) return null
  if (all_ref_rank == null || op_ref_rank == null) return null
  const [row_a, row_b] = pair
  const cost = (row, ref) => Math.abs(row.overall_rank - ref)
  const cost_x = cost(row_a, all_ref_rank) + cost(row_b, op_ref_rank)
  const cost_y = cost(row_a, op_ref_rank) + cost(row_b, all_ref_rank)
  const total = Math.max(cost_x, cost_y, 1)
  const gap = Math.abs(cost_x - cost_y)
  const confidence = Math.min(1.0, gap / total)
  const flagged = gap < 5
  const [a_decision, b_decision] =
    cost_x <= cost_y ? ['ALL', 'OP'] : ['OP', 'ALL']
  const base = {
    stage,
    confidence,
    all_ref_rank,
    op_ref_rank,
    notes: `${note_prefix} cost_x=${cost_x} cost_y=${cost_y}${flagged ? ' FLAGGED' : ''}`
  }
  return [
    { row: row_a, ...base, decision: a_decision, pair_partner_rank: row_b.overall_rank },
    { row: row_b, ...base, decision: b_decision, pair_partner_rank: row_a.overall_rank }
  ]
}

const decide_stage_3_pair = ({ pair, refs }) => {
  const scoring = SCORING_FROM_LABEL[pair[0].ranking_type]
  const year_refs = refs[pair[0].year]?.[scoring]
  if (!year_refs) return null
  return assign_pair({
    pair,
    all_ref_rank: year_refs.all.get(pair[0].pid),
    op_ref_rank: year_refs.op.get(pair[0].pid),
    stage: 3,
    note_prefix: '2x2 fp'
  })
}

// Single-row variant: decides one row based on which ref rank it's closer to.
const decide_single_by_refs = ({ row, all_ref_rank, op_ref_rank, stage, note_prefix }) => {
  if (all_ref_rank == null && op_ref_rank == null) return null
  if (all_ref_rank == null) {
    return {
      decision: 'OP', stage, confidence: 0.5, all_ref_rank: null,
      op_ref_rank, notes: `${note_prefix} OP-only ref`
    }
  }
  if (op_ref_rank == null) {
    return {
      decision: 'ALL', stage, confidence: 0.5, all_ref_rank,
      op_ref_rank: null, notes: `${note_prefix} ALL-only ref`
    }
  }
  const d_all = Math.abs(row.overall_rank - all_ref_rank)
  const d_op = Math.abs(row.overall_rank - op_ref_rank)
  const total = Math.max(d_all, d_op, 1)
  const gap = Math.abs(d_all - d_op)
  const confidence = Math.min(1.0, gap / total)
  const flagged = gap < 5
  return {
    decision: d_all <= d_op ? 'ALL' : 'OP',
    stage,
    confidence,
    all_ref_rank,
    op_ref_rank,
    notes: `${note_prefix} d_all=${d_all} d_op=${d_op}${flagged ? ' FLAGGED' : ''}`
  }
}

// Stage 4 refs: Sleeper ADP at the nearest snapshot to each buggy timestamp.
// Returns a structure:
//   sleeper[buggy_ts] = {
//     sleeper_ts,
//     STD:  { all: Map(pid -> rank), op: Map(pid -> rank) },
//     PPR:  { all: Map(pid -> rank), op: Map(pid -> rank) },
//     HALF: { all: Map(pid -> rank), op: Map(pid -> rank) }
//   }
// Each map is built by sorting all sleeper-snapshot rows by adp ascending and
// assigning 1..N. ADP rank is robustly comparable to FP overall_rank.
const build_sleeper_refs = async ({ buggy_timestamps }) => {
  // Pick the nearest sleeper snapshot per buggy ts. We do this by loading all
  // distinct sleeper timestamps for one type (they're identical across types)
  // then matching nearest.
  const ts_rows = await db('player_adp_history')
    .distinct('timestamp')
    .where({ source_id: 'SLEEPER', adp_type: 'PPR_REDRAFT' })
    .whereBetween('timestamp', [
      Math.min(...buggy_timestamps) - 7 * 86400,
      Math.max(...buggy_timestamps) + 7 * 86400
    ])
    .orderBy('timestamp')
  const all_ts = ts_rows.map((r) => r.timestamp)
  if (all_ts.length === 0) {
    log('sleeper: no snapshots in buggy window')
    return {}
  }
  // For each buggy ts, find nearest sleeper ts (binary search style).
  const nearest = new Map()
  for (const ts of buggy_timestamps) {
    let best = all_ts[0]
    let best_d = Math.abs(ts - best)
    for (const st of all_ts) {
      const d = Math.abs(ts - st)
      if (d < best_d) {
        best = st
        best_d = d
      }
      if (st > ts && d > best_d) break
    }
    nearest.set(ts, best)
  }
  const sleeper_ts_set = new Set(nearest.values())
  log(`sleeper: ${sleeper_ts_set.size} distinct nearest snapshots for ${buggy_timestamps.length} buggy ts`)

  // Load all sleeper rows for those nearest snapshots, across the 6 types.
  const adp_types = [
    'STANDARD_REDRAFT', 'PPR_REDRAFT', 'HALF_PPR_REDRAFT',
    'STANDARD_SUPERFLEX_REDRAFT', 'PPR_SUPERFLEX_REDRAFT', 'HALF_PPR_SUPERFLEX_REDRAFT'
  ]
  const rows = await db('player_adp_history')
    .select('timestamp', 'pid', 'adp_type', 'adp')
    .where({ source_id: 'SLEEPER' })
    .whereIn('adp_type', adp_types)
    .whereIn('timestamp', Array.from(sleeper_ts_set))
  log(`sleeper: loaded ${rows.length} adp rows`)

  // Bucket by (sleeper_ts, adp_type) -> [{pid, adp}], then sort, then
  // assign ranks.
  const buckets = new Map()
  for (const r of rows) {
    const key = `${r.timestamp}|${r.adp_type}`
    let b = buckets.get(key)
    if (!b) { b = []; buckets.set(key, b) }
    b.push({ pid: r.pid, adp: Number(r.adp) })
  }
  const sleeper_ranks = new Map()
  for (const [key, list] of buckets) {
    list.sort((a, b) => a.adp - b.adp)
    const m = new Map()
    for (let i = 0; i < list.length; i++) m.set(list[i].pid, i + 1)
    sleeper_ranks.set(key, m)
  }
  // Assemble per-buggy-ts view.
  const result = {}
  for (const ts of buggy_timestamps) {
    const st = nearest.get(ts)
    result[ts] = {
      sleeper_ts: st,
      STD: {
        all: sleeper_ranks.get(`${st}|STANDARD_REDRAFT`) ?? new Map(),
        op: sleeper_ranks.get(`${st}|STANDARD_SUPERFLEX_REDRAFT`) ?? new Map()
      },
      PPR: {
        all: sleeper_ranks.get(`${st}|PPR_REDRAFT`) ?? new Map(),
        op: sleeper_ranks.get(`${st}|PPR_SUPERFLEX_REDRAFT`) ?? new Map()
      },
      HALF: {
        all: sleeper_ranks.get(`${st}|HALF_PPR_REDRAFT`) ?? new Map(),
        op: sleeper_ranks.get(`${st}|HALF_PPR_SUPERFLEX_REDRAFT`) ?? new Map()
      }
    }
  }
  return result
}

// Stage 5 refs: KTC qb=1 and qb=2 ranks per day. KTC is dynasty-flavored but
// SF-lift (rank_qb1 - rank_qb2) reliably indicates whether a pid is QB-ish.
// We sort values descending to derive ranks (1 = highest value).
const build_ktc_refs = async ({ buggy_timestamps }) => {
  const ts_rows = await db('keeptradecut_rankings')
    .distinct('d')
    .where({ type: 1 })
    .whereBetween('d', [
      Math.min(...buggy_timestamps) - 7 * 86400,
      Math.max(...buggy_timestamps) + 7 * 86400
    ])
    .orderBy('d')
  const all_d = ts_rows.map((r) => r.d)
  if (all_d.length === 0) {
    log('ktc: no snapshots in buggy window')
    return {}
  }
  const nearest = new Map()
  for (const ts of buggy_timestamps) {
    let best = all_d[0]
    let best_d = Math.abs(ts - best)
    for (const d of all_d) {
      const diff = Math.abs(ts - d)
      if (diff < best_d) { best = d; best_d = diff }
      if (d > ts && diff > best_d) break
    }
    nearest.set(ts, best)
  }
  const ktc_d_set = new Set(nearest.values())
  log(`ktc: ${ktc_d_set.size} distinct nearest snapshots for ${buggy_timestamps.length} buggy ts`)

  const rows = await db('keeptradecut_rankings')
    .select('d', 'pid', 'qb', 'v')
    .where({ type: 1 })
    .whereIn('d', Array.from(ktc_d_set))
  log(`ktc: loaded ${rows.length} value rows`)

  const buckets = new Map()
  for (const r of rows) {
    const key = `${r.d}|${r.qb}`
    let b = buckets.get(key)
    if (!b) { b = []; buckets.set(key, b) }
    b.push({ pid: r.pid, v: r.v })
  }
  const ktc_ranks = new Map()
  const ktc_values = new Map()
  for (const [key, list] of buckets) {
    list.sort((a, b) => b.v - a.v)
    const rm = new Map()
    const vm = new Map()
    for (let i = 0; i < list.length; i++) {
      rm.set(list[i].pid, i + 1)
      vm.set(list[i].pid, list[i].v)
    }
    ktc_ranks.set(key, rm)
    ktc_values.set(key, vm)
  }
  const result = {}
  for (const ts of buggy_timestamps) {
    const d = nearest.get(ts)
    result[ts] = {
      ktc_d: d,
      qb1_ranks: ktc_ranks.get(`${d}|1`) ?? new Map(),
      qb2_ranks: ktc_ranks.get(`${d}|2`) ?? new Map(),
      qb1_values: ktc_values.get(`${d}|1`) ?? new Map(),
      qb2_values: ktc_values.get(`${d}|2`) ?? new Map()
    }
  }
  return result
}

const decide_stage_4_pair = ({ pair, sleeper_refs }) => {
  const row = pair[0]
  const scoring = SCORING_FROM_LABEL[row.ranking_type]
  const refs = sleeper_refs[row.timestamp]?.[scoring]
  if (!refs) return null
  const decisions = assign_pair({
    pair,
    all_ref_rank: refs.all.get(row.pid),
    op_ref_rank: refs.op.get(row.pid),
    stage: 4,
    note_prefix: '2x2 sleeper'
  })
  if (decisions) {
    for (const d of decisions) {
      d.sleeper_all_rank = refs.all.get(row.pid) ?? null
      d.sleeper_op_rank = refs.op.get(row.pid) ?? null
      d.sleeper_ts = sleeper_refs[row.timestamp].sleeper_ts
    }
  }
  return decisions
}

const decide_stage_4_single = ({ row, sleeper_refs }) => {
  const scoring = SCORING_FROM_LABEL[row.ranking_type]
  const refs = sleeper_refs[row.timestamp]?.[scoring]
  if (!refs) return null
  const all_rank = refs.all.get(row.pid)
  const op_rank = refs.op.get(row.pid)
  if (all_rank == null && op_rank == null) return null
  const dec = decide_single_by_refs({
    row, all_ref_rank: all_rank, op_ref_rank: op_rank,
    stage: 4, note_prefix: 'sleeper'
  })
  if (dec) {
    dec.sleeper_all_rank = all_rank ?? null
    dec.sleeper_op_rank = op_rank ?? null
    dec.sleeper_ts = sleeper_refs[row.timestamp].sleeper_ts
  }
  return dec
}

const decide_stage_5_pair = ({ pair, ktc_refs }) => {
  const row = pair[0]
  const refs = ktc_refs[row.timestamp]
  if (!refs) return null
  const decisions = assign_pair({
    pair,
    all_ref_rank: refs.qb1_ranks.get(row.pid),
    op_ref_rank: refs.qb2_ranks.get(row.pid),
    stage: 5,
    note_prefix: '2x2 ktc'
  })
  if (decisions) {
    for (const d of decisions) {
      d.ktc_value_1qb = refs.qb1_values.get(row.pid) ?? null
      d.ktc_value_sf = refs.qb2_values.get(row.pid) ?? null
      d.ktc_d = refs.ktc_d
    }
  }
  return decisions
}

const decide_stage_5_single = ({ row, ktc_refs }) => {
  const refs = ktc_refs[row.timestamp]
  if (!refs) return null
  const v1 = refs.qb1_values.get(row.pid)
  const v2 = refs.qb2_values.get(row.pid)
  if (v1 == null && v2 == null) return null
  // SF-lift: positive lift (v1 > v2) => non-QB => row at this rank is closer
  // to ALL bucket (because ALL is the larger-pool, lower-rank bucket which
  // typically demotes non-QBs less than OP does). For singletons we can't do
  // 2x2; fall back to closer-rank assignment using KTC ranks.
  const dec = decide_single_by_refs({
    row,
    all_ref_rank: refs.qb1_ranks.get(row.pid),
    op_ref_rank: refs.qb2_ranks.get(row.pid),
    stage: 5,
    note_prefix: 'ktc'
  })
  if (dec) {
    dec.ktc_value_1qb = v1 ?? null
    dec.ktc_value_sf = v2 ?? null
    dec.ktc_d = refs.ktc_d
  }
  return dec
}

// Last resort for singletons: assume ALL-only fringe (OP run is shorter
// overall and the singleton-at-buggy-ts pattern matches an ALL-only pid).
const decide_stage_6_single = ({ row }) => ({
  decision: 'ALL',
  stage: 6,
  confidence: 0.2,
  notes: 'residual single -> ALL'
})

// Last resort for pairs with no cross-source data. Non-QB positions have
// OP rank > ALL rank (QBs displace them in superflex), so within a pair the
// lower rank is ALL and the higher rank is OP. Only triggers for fringe pids
// that miss every ref source (FP year refs, Sleeper, KTC); in the dry-run
// these are exclusively non-QB (RB/WR/TE) deep bench.
const decide_stage_6_pair = ({ pair }) => {
  if (pair.length !== 2) return null
  const [row_a, row_b] = pair
  if (row_a.pos === 'QB' || row_b.pos === 'QB') {
    // QB pair fallback inverts the rule, but in practice these are unreachable
    // (Stage 1 K/DST and Stages 3-5 cover all QBs in scope).
    const [low, high] =
      row_a.overall_rank <= row_b.overall_rank ? [row_a, row_b] : [row_b, row_a]
    return [
      { row: low, decision: 'OP', stage: 6, confidence: 0.2, notes: 'residual pair QB low->OP' },
      { row: high, decision: 'ALL', stage: 6, confidence: 0.2, notes: 'residual pair QB high->ALL' }
    ]
  }
  const [low, high] =
    row_a.overall_rank <= row_b.overall_rank ? [row_a, row_b] : [row_b, row_a]
  return [
    { row: low, decision: 'ALL', stage: 6, confidence: 0.3, notes: 'residual pair non-QB low->ALL' },
    { row: high, decision: 'OP', stage: 6, confidence: 0.3, notes: 'residual pair non-QB high->OP' }
  ]
}

const audit_row_from = ({ row, decision }) => ({
  timestamp: row.timestamp,
  pid: row.pid,
  ranking_type: row.ranking_type,
  overall_rank: row.overall_rank,
  min: row.min,
  max: row.max,
  pos: row.pos,
  year: row.year,
  decision: decision.decision,
  stage: decision.stage,
  confidence: decision.confidence,
  all_ref_rank: decision.all_ref_rank ?? null,
  op_ref_rank: decision.op_ref_rank ?? null,
  pair_partner_rank: decision.pair_partner_rank ?? null,
  sleeper_all_rank: null,
  sleeper_op_rank: null,
  sleeper_ts: null,
  ktc_value_1qb: null,
  ktc_value_sf: null,
  ktc_d: null,
  notes: decision.notes ?? null
})

const main_repair = async ({ dry_run = true, apply = false }) => {
  if (apply && dry_run) {
    throw new Error('cannot pass --apply with --dry-run')
  }

  log(`starting repair, dry_run=${dry_run} apply=${apply}`)

  // 1. Identify buggy timestamps and load all in-scope rows up front.
  const buggy_timestamps = await get_buggy_timestamps()
  log(`buggy_timestamps=${buggy_timestamps.length}`)
  const rows = await load_scope_rows({ buggy_timestamps })
  log(`scope rows=${rows.length}`)

  // 2. Build references in parallel: FP year-level + Sleeper nearest-snapshot + KTC.
  const years = Array.from(new Set(rows.map((r) => r.year))).sort()
  const scorings = ['STD', 'PPR', 'HALF']
  log(`building FP refs for years=${years.join(',')} scorings=${scorings.join(',')}`)
  const refs = await build_fp_refs({ years, scorings })
  log('building Sleeper refs')
  const sleeper_refs = await build_sleeper_refs({ buggy_timestamps })
  log('building KTC refs')
  const ktc_refs = await build_ktc_refs({ buggy_timestamps })

  // 3. Group rows and run the staged decision pipeline.
  const groups = group_rows(rows)
  const audit_rows = []
  const counters = { stage_1: 0, stage_2: 0, stage_3: 0, stage_4: 0, stage_5: 0, stage_6: 0, unresolved: 0 }
  const push_audit = (row, decision) => {
    counters[`stage_${decision.stage}`] += 1
    audit_rows.push(audit_row_from({ row, decision }))
  }

  for (const [, group] of groups) {
    if (group.length === 1) {
      const row = group[0]
      // Singletons: 1 -> 2 (fp set) -> 4 (sleeper) -> 5 (ktc) -> 6 (residual).
      const decision =
        decide_stage_1({ row }) ??
        decide_stage_2({ row, refs }) ??
        decide_stage_4_single({ row, sleeper_refs }) ??
        decide_stage_5_single({ row, ktc_refs }) ??
        decide_stage_6_single({ row })
      push_audit(row, decision)
      continue
    }
    // Pair group: try stage 1 (forced) on both, else 2x2 with fp/sleeper/ktc.
    const forced = group.map((row) => decide_stage_1({ row }))
    if (forced.every((d) => d != null)) {
      for (let i = 0; i < group.length; i++) push_audit(group[i], forced[i])
      continue
    }
    // Evaluate FP, Sleeper, KTC and pick whichever has the highest confidence.
    // This breaks Stage-3 ties (~26% of pairs have FP cost_x=cost_y where the
    // pid's ref ranks sit between the two row ranks).
    const candidates = [
      decide_stage_3_pair({ pair: group, refs }),
      decide_stage_4_pair({ pair: group, sleeper_refs }),
      decide_stage_5_pair({ pair: group, ktc_refs })
    ].filter((c) => c != null)
    let pair_decisions = null
    if (candidates.length > 0) {
      pair_decisions = candidates[0]
      for (const cand of candidates) {
        if (cand[0].confidence > pair_decisions[0].confidence) pair_decisions = cand
      }
    } else {
      pair_decisions = decide_stage_6_pair({ pair: group })
    }
    if (pair_decisions) {
      for (const d of pair_decisions) push_audit(d.row, d)
      continue
    }
    // Unreachable: stage_6_pair always returns a decision for length=2.
    for (const row of group) {
      push_audit(row, decide_stage_6_single({ row }))
    }
  }

  log(`decisions: stage_1=${counters.stage_1} stage_2=${counters.stage_2} stage_3=${counters.stage_3} stage_4=${counters.stage_4} stage_5=${counters.stage_5} stage_6=${counters.stage_6} unresolved=${counters.unresolved}`)

  // 4. Persist audit rows in batches.
  await db('fp_redraft_salvage_audit').del()
  const batch_size = 500
  for (let i = 0; i < audit_rows.length; i += batch_size) {
    const chunk = audit_rows.slice(i, i + batch_size)
    try {
      await db('fp_redraft_salvage_audit').insert(chunk)
    } catch (err) {
      log(`insert failed at batch starting ${i}: ${err.code} ${err.detail || err.message}`)
      log(`first row of failing batch: ${JSON.stringify(chunk[0])}`)
      throw err
    }
  }
  log(`audit table populated: ${audit_rows.length} rows`)

  // 5. Dry-run report aggregates.
  const aggs = await db('fp_redraft_salvage_audit')
    .select('stage', 'ranking_type', 'decision')
    .count({ n: '*' })
    .avg({ avg_conf: 'confidence' })
    .groupBy('stage', 'ranking_type', 'decision')
    .orderBy(['stage', 'ranking_type', 'decision'])
  log('aggregates by (stage, ranking_type, decision):')
  for (const a of aggs) {
    log(`  stage=${a.stage} ${a.ranking_type} ${a.decision} n=${a.n} avg_conf=${Number(a.avg_conf).toFixed(3)}`)
  }

  if (!apply) {
    log('dry-run complete. re-run with --apply (and without --dry-run) to perform the UPDATE.')
    return
  }

  // 6. Apply (transaction): UPDATE all rows where decision='OP' to the SF label.
  await db.transaction(async (trx) => {
    const result = await trx.raw(`
      UPDATE player_rankings_history h
      SET ranking_type = CASE h.ranking_type::text
          WHEN 'STANDARD_REDRAFT' THEN 'STANDARD_SUPERFLEX_REDRAFT'::rankings_type
          WHEN 'PPR_REDRAFT'      THEN 'PPR_SUPERFLEX_REDRAFT'::rankings_type
          WHEN 'HALF_PPR_REDRAFT' THEN 'HALF_PPR_SUPERFLEX_REDRAFT'::rankings_type
        END
      FROM fp_redraft_salvage_audit a
      WHERE a.timestamp = h.timestamp
        AND a.pid = h.pid
        AND a.ranking_type = h.ranking_type::text
        AND a.overall_rank = h.overall_rank
        AND a.min = h.min
        AND a.max = h.max
        AND a.decision = 'OP'
        AND h.source_id = 'FANTASYPROS'
    `)
    log(`apply: UPDATE affected ${result.rowCount} rows`)
  })
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('dry-run', { type: 'boolean', default: true })
      .option('apply', { type: 'boolean', default: false })
      .parse()
    await main_repair({ dry_run: argv['dry-run'] && !argv.apply, apply: argv.apply })
  } catch (err) {
    error = err
    console.log(err)
  }
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default main_repair
