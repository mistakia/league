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

// 2x2 cost-matrix assignment for a pair of rows that share (ts, type, pid).
// Returns two decisions keyed by overall_rank.
const decide_stage_3_pair = ({ pair, refs }) => {
  if (pair.length !== 2) return null
  const [row_a, row_b] = pair
  const scoring = SCORING_FROM_LABEL[row_a.ranking_type]
  const year_refs = refs[row_a.year]?.[scoring]
  if (!year_refs) return null
  const all_rank = year_refs.all.get(row_a.pid)
  const op_rank = year_refs.op.get(row_a.pid)
  if (all_rank == null || op_rank == null) return null

  const cost = (row, ref) => Math.abs(row.overall_rank - ref)
  // Two possible assignments:
  //   A-as-ALL, B-as-OP   -> cost_x
  //   A-as-OP,  B-as-ALL  -> cost_y
  const cost_x = cost(row_a, all_rank) + cost(row_b, op_rank)
  const cost_y = cost(row_a, op_rank) + cost(row_b, all_rank)
  const total = Math.max(cost_x, cost_y, 1)
  const gap = Math.abs(cost_x - cost_y)
  const confidence = Math.min(1.0, gap / total)
  const flagged = gap < 5

  const [a_decision, b_decision] =
    cost_x <= cost_y ? ['ALL', 'OP'] : ['OP', 'ALL']

  const base = {
    stage: 3,
    confidence,
    all_ref_rank: all_rank,
    op_ref_rank: op_rank,
    notes: `2x2 cost_x=${cost_x} cost_y=${cost_y}${flagged ? ' FLAGGED' : ''}`
  }
  return [
    { row: row_a, ...base, decision: a_decision, pair_partner_rank: row_b.overall_rank },
    { row: row_b, ...base, decision: b_decision, pair_partner_rank: row_a.overall_rank }
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

  // 2. Build FP year-level refs across the years present in scope.
  const years = Array.from(new Set(rows.map((r) => r.year))).sort()
  const scorings = ['STD', 'PPR', 'HALF']
  log(`building FP refs for years=${years.join(',')} scorings=${scorings.join(',')}`)
  const refs = await build_fp_refs({ years, scorings })

  // 3. Group rows and run the staged decision pipeline.
  const groups = group_rows(rows)
  const audit_rows = []
  const counters = {
    stage_1: 0,
    stage_2: 0,
    stage_3: 0,
    unresolved: 0
  }

  for (const [, group] of groups) {
    if (group.length === 1) {
      const row = group[0]
      // Try forced (stage 1) then set membership (stage 2).
      let decision = decide_stage_1({ row }) ?? decide_stage_2({ row, refs })
      if (decision) {
        counters[`stage_${decision.stage}`] += 1
        audit_rows.push(audit_row_from({ row, decision }))
      } else {
        counters.unresolved += 1
      }
      continue
    }
    // Pair group: try forced first (each row), then 2x2 pair assignment.
    const decisions_by_rank = new Map()
    let resolved_count = 0
    for (const row of group) {
      const d = decide_stage_1({ row })
      if (d) {
        decisions_by_rank.set(row.overall_rank, { row, decision: d })
        resolved_count += 1
      }
    }
    if (resolved_count === group.length) {
      for (const { row, decision } of decisions_by_rank.values()) {
        counters.stage_1 += 1
        audit_rows.push(audit_row_from({ row, decision }))
      }
      continue
    }
    // 2x2 assignment (handles the standard case of two non-forced rows).
    const pair_decisions = decide_stage_3_pair({ pair: group, refs })
    if (pair_decisions) {
      for (const d of pair_decisions) {
        counters.stage_3 += 1
        audit_rows.push(audit_row_from({ row: d.row, decision: d }))
      }
      continue
    }
    // Fallback: try stage 2 per row.
    let partial = 0
    for (const row of group) {
      const d = decide_stage_2({ row, refs })
      if (d) {
        counters.stage_2 += 1
        audit_rows.push(audit_row_from({ row, decision: d }))
        partial += 1
      }
    }
    counters.unresolved += group.length - partial
  }

  log(`decisions: stage_1=${counters.stage_1} stage_2=${counters.stage_2} stage_3=${counters.stage_3} unresolved=${counters.unresolved}`)

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
