import { randomUUID } from 'node:crypto'

import db from '#db'
import { transaction_types } from '#constants/transaction-constants.mjs'

import {
  ASSET_TYPE,
  SALARY_BASIS,
  TRANSFORMATION_TYPE,
  TERMINATED_BY
} from './constants.mjs'

// Build the full event stream for a league's lineage graph by reading
// transactions + accepted trades + draft picks + RFA wins, then emit
// holding drafts and transformation drafts in chronological order.
//
// Scope of v1 walker:
//   Players: auction, draft, PS/FA add, poach, release, extension, RFA win,
//            franchise tag, rookie tag, plus trade legs (handled via the
//            trades table, not direct trade transactions).
//   Picks:   standings endowment (synthetic event at endowment date), trade
//            legs (trades_picks), and pick conversion (selection_timestamp).
//   Slot transitions (ROSTER_ACTIVATE/DEACTIVATE, RESERVE_*, PS<->bench):
//            intra-holding, no event emitted; captured downstream by the
//            slot-week-counter pass.
//   AUCTION_BID: non-state-changing, explicitly ignored.
//   Unhandled flows (super-priority chains, decommission_reassignment,
//   failed_poach_sanctuary, auto_cap_release, season_rollover for picks):
//   accumulated as coverage_warnings; surfaced by the generator's row-count
//   oracle.

const PLAYER_ACQUISITION_TRANSACTION_TYPES = {
  [transaction_types.AUCTION_PROCESSED]: {
    transformation: TRANSFORMATION_TYPE.AUCTION,
    salary_basis: SALARY_BASIS.AUCTION
  },
  [transaction_types.DRAFT]: {
    transformation: TRANSFORMATION_TYPE.DRAFT,
    salary_basis: SALARY_BASIS.ROOKIE_CONTRACT
  },
  [transaction_types.ROSTER_ADD]: {
    transformation: TRANSFORMATION_TYPE.FA_SIGNING,
    salary_basis: SALARY_BASIS.AUCTION
  },
  [transaction_types.PRACTICE_ADD]: {
    transformation: TRANSFORMATION_TYPE.PS_SIGNING,
    salary_basis: SALARY_BASIS.PS_SALARY
  },
  [transaction_types.POACHED]: {
    transformation: TRANSFORMATION_TYPE.POACH,
    salary_basis: SALARY_BASIS.AUCTION
  },
  [transaction_types.EXTENSION]: {
    transformation: TRANSFORMATION_TYPE.EXTENSION,
    salary_basis: SALARY_BASIS.EXTENSION
  },
  [transaction_types.FRANCHISE_TAG]: {
    transformation: TRANSFORMATION_TYPE.FRANCHISE_TAG,
    salary_basis: SALARY_BASIS.FRANCHISE_TAG
  },
  [transaction_types.ROOKIE_TAG]: {
    transformation: TRANSFORMATION_TYPE.ROOKIE_TAG,
    salary_basis: SALARY_BASIS.ROOKIE_TAG
  },
  [transaction_types.RESTRICTED_FREE_AGENCY_TAG]: {
    transformation: TRANSFORMATION_TYPE.RFA_WIN,
    salary_basis: SALARY_BASIS.RFA
  }
}

const INTRA_HOLDING_TRANSACTION_TYPES = new Set([
  transaction_types.ROSTER_ACTIVATE,
  transaction_types.ROSTER_DEACTIVATE,
  transaction_types.RESERVE_IR,
  transaction_types.RESERVE_COV,
  transaction_types.RESERVE_LONG_TERM,
  transaction_types.AUCTION_BID
])

const player_key = (tid, player_id) => `p__${tid}__${player_id}`
const pick_key = (tid, pickid) => `pk__${tid}__${pickid}`

// Endowment date for a draft year. Picks for year Y are decided based on
// year (Y-1) standings; we synthesize the endowment at the prior year's
// draft_start (a reliable post-prior-season timestamp). If missing, fall
// back to Jan 1 of year Y.
const resolve_endowment_date = async ({ lid, year }) => {
  const prior = await db('seasons')
    .select('draft_start')
    .where({ lid, year: year - 1 })
    .first()
  if (prior?.draft_start) return new Date(Number(prior.draft_start) * 1000)
  return new Date(`${year}-01-01T00:00:00Z`)
}

const walk_transactions = async ({ lid }) => {
  const ctx = {
    lid,
    open: new Map(), // key -> draft_id (the current open holding for that asset+team)
    drafts_by_id: new Map(),
    holding_drafts: [],
    transformation_drafts: [],
    coverage_warnings: new Map()
  }
  const note_warning = (label) => {
    ctx.coverage_warnings.set(label, (ctx.coverage_warnings.get(label) || 0) + 1)
  }

  const open_player_holding = ({
    tid,
    player_id,
    occurred_at,
    salary_basis,
    year
  }) => {
    const draft_id = `p__${tid}__${player_id}__${occurred_at.getTime()}`
    if (ctx.drafts_by_id.has(draft_id)) {
      note_warning('duplicate_draft_id_player')
      return ctx.drafts_by_id.get(draft_id)
    }
    const draft = {
      draft_id,
      lid,
      tid,
      asset_type: ASSET_TYPE.PLAYER,
      player_id,
      pickid: null,
      pick_year: null,
      pick_round: null,
      pick_original_owner_tid: null,
      pick_draft_overall_position: null,
      period_start: occurred_at,
      period_end: null,
      salary_basis,
      year,
      terminated_by: TERMINATED_BY.STILL_HELD,
      is_rookie_tag: false,
      protected_for_year: null,
      super_priority_until: null
    }
    ctx.drafts_by_id.set(draft_id, draft)
    ctx.holding_drafts.push(draft)
    ctx.open.set(player_key(tid, player_id), draft_id)
    return draft
  }

  const open_pick_holding = ({
    tid,
    pickid,
    pick_year,
    pick_round,
    pick_original_owner_tid,
    pick_draft_overall_position,
    occurred_at
  }) => {
    const draft_id = `pk__${tid}__${pickid}__${occurred_at.getTime()}`
    if (ctx.drafts_by_id.has(draft_id)) {
      note_warning('duplicate_draft_id_pick')
      return ctx.drafts_by_id.get(draft_id)
    }
    const draft = {
      draft_id,
      lid,
      tid,
      asset_type: ASSET_TYPE.PICK,
      player_id: null,
      pickid,
      pick_year,
      pick_round,
      pick_original_owner_tid,
      pick_draft_overall_position,
      period_start: occurred_at,
      period_end: null,
      salary_basis: null,
      year: pick_year,
      terminated_by: TERMINATED_BY.STILL_HELD
    }
    ctx.drafts_by_id.set(draft_id, draft)
    ctx.holding_drafts.push(draft)
    ctx.open.set(pick_key(tid, pickid), draft_id)
    return draft
  }

  const close_open = ({ key, occurred_at, terminated_by }) => {
    const draft_id = ctx.open.get(key)
    if (!draft_id) return null
    const draft = ctx.drafts_by_id.get(draft_id)
    if (!draft) return null
    draft.period_end = occurred_at
    draft.terminated_by = terminated_by
    ctx.open.delete(key)
    return draft
  }

  const emit_edge = ({
    transformation_id,
    transformation_type,
    occurred_at,
    source_draft_id,
    target_draft_id,
    source_share,
    target_share,
    transaction_id = null
  }) => {
    ctx.transformation_drafts.push({
      transformation_id,
      lid,
      transaction_id,
      transformation_type,
      occurred_at,
      source_draft_id,
      target_draft_id,
      source_share,
      target_share
    })
  }

  // Build chronological event stream from multiple sources.
  const events = await build_event_stream({ lid })

  for (const event of events) {
    if (event.kind === 'player_acquisition') {
      const cfg = PLAYER_ACQUISITION_TRANSACTION_TYPES[event.transaction_type]
      // Acquisitions that mid-flight imply a termination on a prior owner:
      // POACHED moves player from another team; close that team's holding first.
      if (event.transaction_type === transaction_types.POACHED) {
        // Identify prior owner by scanning open holdings for this player_id on any other tid.
        for (const [key, draft_id] of ctx.open) {
          const draft = ctx.drafts_by_id.get(draft_id)
          if (
            draft &&
            draft.asset_type === ASSET_TYPE.PLAYER &&
            draft.player_id === event.player_id &&
            draft.tid !== event.tid
          ) {
            close_open({
              key,
              occurred_at: event.occurred_at,
              terminated_by: TERMINATED_BY.TRADE
            })
            break
          }
        }
      }
      // EXTENSION / FRANCHISE_TAG / ROOKIE_TAG close the prior same-team holding.
      if (
        event.transaction_type === transaction_types.EXTENSION ||
        event.transaction_type === transaction_types.FRANCHISE_TAG ||
        event.transaction_type === transaction_types.ROOKIE_TAG
      ) {
        close_open({
          key: player_key(event.tid, event.player_id),
          occurred_at: event.occurred_at,
          terminated_by: TERMINATED_BY.EXTENSION
        })
      }
      const draft = open_player_holding({
        tid: event.tid,
        player_id: event.player_id,
        occurred_at: event.occurred_at,
        salary_basis: cfg.salary_basis,
        year: event.year
      })
      if (event.transaction_type === transaction_types.ROOKIE_TAG) {
        draft.is_rookie_tag = true
      }
      emit_edge({
        transformation_id: randomUUID(),
        transformation_type: cfg.transformation,
        occurred_at: event.occurred_at,
        source_draft_id: null,
        target_draft_id: draft.draft_id,
        source_share: null,
        target_share: 1.0,
        transaction_id: event.transaction_id
      })
    } else if (event.kind === 'practice_protected') {
      // PRACTICE_PROTECTED is an intra-holding marker: decorate the open PS
      // holding with the league year for which the player is PS-protected.
      const draft_id = ctx.open.get(player_key(event.tid, event.player_id))
      const draft = draft_id ? ctx.drafts_by_id.get(draft_id) : null
      if (draft) {
        draft.protected_for_year = event.year
      } else {
        note_warning('practice_protected_no_open_holding')
      }
    } else if (event.kind === 'super_priority_resign') {
      // Type 19 SUPER_PRIORITY transaction: the original team has exercised
      // its super-priority claim on a previously-poached-then-released player.
      // Per Amend XXXIV, the window opens on the poaching team's release and
      // closes here. Decorate the most recent released holding for this pid
      // (the poaching team's released holding) with super_priority_until set
      // to the exercise timestamp. Do not open a new holding; the original
      // team's reclaimed PS ownership remains an unmodeled gap until the
      // separate super-priority-resign lineage edge is added.
      let released
      for (const candidate of ctx.holding_drafts) {
        if (candidate.asset_type !== ASSET_TYPE.PLAYER) continue
        if (candidate.player_id !== event.player_id) continue
        if (candidate.terminated_by !== TERMINATED_BY.RELEASE) continue
        if (!candidate.period_end) continue
        if (candidate.period_end.getTime() > event.occurred_at.getTime()) continue
        if (!released || candidate.period_end > released.period_end) {
          released = candidate
        }
      }
      if (released) {
        released.super_priority_until = event.occurred_at
      } else {
        note_warning('super_priority_no_released_holding')
      }
    } else if (event.kind === 'player_release') {
      const closed = close_open({
        key: player_key(event.tid, event.player_id),
        occurred_at: event.occurred_at,
        terminated_by: TERMINATED_BY.RELEASE
      })
      if (closed) {
        emit_edge({
          transformation_id: randomUUID(),
          transformation_type: TRANSFORMATION_TYPE.RELEASE,
          occurred_at: event.occurred_at,
          source_draft_id: closed.draft_id,
          target_draft_id: null,
          source_share: 1.0,
          target_share: null,
          transaction_id: event.transaction_id
        })
      }
    } else if (event.kind === 'rfa_cross_team_win') {
      const closed = close_open({
        key: player_key(event.from_tid, event.player_id),
        occurred_at: event.occurred_at,
        terminated_by: TERMINATED_BY.TRADE
      })
      const opened = open_player_holding({
        tid: event.to_tid,
        player_id: event.player_id,
        occurred_at: event.occurred_at,
        salary_basis: SALARY_BASIS.RFA,
        year: event.year
      })
      emit_edge({
        transformation_id: randomUUID(),
        transformation_type: TRANSFORMATION_TYPE.RFA_WIN,
        occurred_at: event.occurred_at,
        source_draft_id: closed?.draft_id || null,
        target_draft_id: opened.draft_id,
        source_share: closed ? 1.0 : null,
        target_share: 1.0
      })
    } else if (event.kind === 'trade') {
      apply_trade({ event, ctx, close_open, open_player_holding, open_pick_holding, emit_edge, note_warning })
    } else if (event.kind === 'pick_endowment') {
      const draft = open_pick_holding({
        tid: event.tid,
        pickid: event.pickid,
        pick_year: event.pick_year,
        pick_round: event.pick_round,
        pick_original_owner_tid: event.pick_original_owner_tid,
        pick_draft_overall_position: event.pick_draft_overall_position,
        occurred_at: event.occurred_at
      })
      emit_edge({
        transformation_id: randomUUID(),
        transformation_type: TRANSFORMATION_TYPE.STANDINGS_ENDOWMENT,
        occurred_at: event.occurred_at,
        source_draft_id: null,
        target_draft_id: draft.draft_id,
        source_share: null,
        target_share: 1.0
      })
    } else if (event.kind === 'pick_conversion') {
      // Closes pick_holding on event.tid, opened in earlier endowment / trade leg.
      const closed = close_open({
        key: pick_key(event.tid, event.pickid),
        occurred_at: event.occurred_at,
        terminated_by: TERMINATED_BY.PICK_CONVERTED
      })
      // Player holding is opened by the corresponding DRAFT transaction (player_acquisition).
      // Look it up; emit PICK_CONVERSION edge linking the two.
      const player_draft_id = ctx.open.get(player_key(event.tid, event.player_id))
      if (closed && player_draft_id) {
        emit_edge({
          transformation_id: randomUUID(),
          transformation_type: TRANSFORMATION_TYPE.PICK_CONVERSION,
          occurred_at: event.occurred_at,
          source_draft_id: closed.draft_id,
          target_draft_id: player_draft_id,
          source_share: 1.0,
          target_share: 1.0
        })
      } else if (!closed) {
        note_warning('pick_conversion_no_open_pick')
      } else if (!player_draft_id) {
        note_warning('pick_conversion_no_player_draft')
      }
    } else if (event.kind === 'coverage_warning') {
      note_warning(event.label)
    }
  }

  return {
    holding_drafts: ctx.holding_drafts,
    transformation_drafts: ctx.transformation_drafts,
    coverage_warnings: Object.fromEntries(ctx.coverage_warnings)
  }
}

const apply_trade = ({
  event,
  ctx,
  close_open,
  open_player_holding,
  open_pick_holding,
  emit_edge,
  note_warning
}) => {
  // Build per-leg edges; all legs in the trade share one transformation_id.
  const transformation_id = randomUUID()
  const source_drafts = []
  const target_drafts = []

  for (const leg of event.legs) {
    const losing_tid = leg.from_tid
    const winning_tid = leg.to_tid
    if (leg.asset_type === ASSET_TYPE.PLAYER) {
      const closed = close_open({
        key: player_key(losing_tid, leg.player_id),
        occurred_at: event.occurred_at,
        terminated_by: TERMINATED_BY.TRADE
      })
      if (!closed) note_warning('trade_no_open_source_player')
      const opened = open_player_holding({
        tid: winning_tid,
        player_id: leg.player_id,
        occurred_at: event.occurred_at,
        salary_basis: closed?.salary_basis || null,
        year: event.year
      })
      source_drafts.push(closed?.draft_id || null)
      target_drafts.push(opened.draft_id)
    } else if (leg.asset_type === ASSET_TYPE.PICK) {
      const closed = close_open({
        key: pick_key(losing_tid, leg.pickid),
        occurred_at: event.occurred_at,
        terminated_by: TERMINATED_BY.TRADE
      })
      if (!closed) note_warning('trade_no_open_source_pick')
      const opened = open_pick_holding({
        tid: winning_tid,
        pickid: leg.pickid,
        pick_year: leg.pick_year,
        pick_round: leg.pick_round,
        pick_original_owner_tid: leg.pick_original_owner_tid,
        pick_draft_overall_position: leg.pick_draft_overall_position,
        occurred_at: event.occurred_at
      })
      source_drafts.push(closed?.draft_id || null)
      target_drafts.push(opened.draft_id)
    }
  }

  // V1 share computation: unilateral 1.0 per leg. compute-transformation-weights
  // can recompute precise market-value-derived shares in a downstream pass.
  for (let i = 0; i < source_drafts.length; i++) {
    if (source_drafts[i] == null || target_drafts[i] == null) continue
    emit_edge({
      transformation_id,
      transformation_type: TRANSFORMATION_TYPE.TRADE,
      occurred_at: event.occurred_at,
      source_draft_id: source_drafts[i],
      target_draft_id: target_drafts[i],
      source_share: 1.0,
      target_share: 1.0,
      transaction_id: null
    })
  }
}

const build_event_stream = async ({ lid }) => {
  const events = []

  // 1. Trade lookup: trades_transactions links transactionid -> tradeid.
  const trade_transactionids = await db('trades_transactions')
    .join('trades', 'trades.uid', 'trades_transactions.tradeid')
    .where('trades.lid', lid)
    .whereNotNull('trades.accepted')
    .select('trades_transactions.transactionid')
  const trade_tran_ids = new Set(
    trade_transactionids.map((r) => r.transactionid)
  )

  // Cross-team RFA wins are emitted from restricted_free_agency_bids; the
  // corresponding transactions table RESTRICTED_FREE_AGENCY_TAG row would
  // open a second holding on the winning team at the same timestamp (same
  // draft_id key) and orphan the first. Build the suppression set keyed by
  // (winning_tid, pid, processed_ts).
  const cross_team_rfa_wins = await db('restricted_free_agency_bids')
    .where({ lid, succ: true })
    .whereNotNull('processed')
    .whereRaw('tid != player_tid')
    .select('tid', 'pid', 'processed')
  const cross_team_rfa_key_set = new Set(
    cross_team_rfa_wins.map((r) => `${r.tid}__${r.pid}__${r.processed}`)
  )

  // 2. Player transactions (excluding those that resolve via a trade).
  const transactions = await db('transactions')
    .select('uid', 'tid', 'pid', 'type', 'timestamp', 'year', 'value')
    .where('lid', lid)
    .whereNotNull('pid')
    .orderBy('timestamp', 'asc')
  for (const tran of transactions) {
    if (trade_tran_ids.has(tran.uid)) continue
    // The trades table is the canonical source for trade lineage. Some older
    // TRADE-type transactions (pre-linking import) lack trades_transactions
    // rows; we still skip them here so the trade walker resolves the basket
    // once per trade rather than per leg.
    if (tran.type === transaction_types.TRADE) continue
    const ts = new Date(tran.timestamp * 1000)
    if (INTRA_HOLDING_TRANSACTION_TYPES.has(tran.type)) continue
    if (tran.type === transaction_types.PRACTICE_PROTECTED) {
      events.push({
        sort_ts: tran.timestamp,
        sort_priority: 5, // after acquisitions/releases at the same timestamp
        kind: 'practice_protected',
        tid: tran.tid,
        player_id: tran.pid,
        occurred_at: ts,
        year: tran.year,
        transaction_id: tran.uid
      })
      continue
    }
    if (tran.type === transaction_types.SUPER_PRIORITY) {
      events.push({
        sort_ts: tran.timestamp,
        sort_priority: 5, // after releases (priority 1) at the same timestamp
        kind: 'super_priority_resign',
        tid: tran.tid,
        player_id: tran.pid,
        occurred_at: ts,
        year: tran.year,
        transaction_id: tran.uid
      })
      continue
    }
    if (
      tran.type === transaction_types.RESTRICTED_FREE_AGENCY_TAG &&
      cross_team_rfa_key_set.has(`${tran.tid}__${tran.pid}__${tran.timestamp}`)
    ) {
      // Cross-team RFA win: the rfa_cross_team_win event from
      // restricted_free_agency_bids handles open/close. Skip the transactions
      // row to avoid emitting a duplicate holding with the same draft_id.
      events.push({
        sort_ts: tran.timestamp,
        sort_priority: 5,
        kind: 'coverage_warning',
        label: 'rfa_tag_cross_team_dual_path_skipped',
        occurred_at: ts
      })
      continue
    }
    if (tran.type === transaction_types.ROSTER_RELEASE) {
      events.push({
        sort_ts: tran.timestamp,
        sort_priority: 1,
        kind: 'player_release',
        tid: tran.tid,
        player_id: tran.pid,
        occurred_at: ts,
        transaction_id: tran.uid
      })
    } else if (PLAYER_ACQUISITION_TRANSACTION_TYPES[tran.type]) {
      events.push({
        sort_ts: tran.timestamp,
        sort_priority: 2,
        kind: 'player_acquisition',
        tid: tran.tid,
        player_id: tran.pid,
        transaction_type: tran.type,
        occurred_at: ts,
        year: tran.year,
        value: tran.value,
        transaction_id: tran.uid
      })
    } else if (tran.type === transaction_types.RESTRICTED_FREE_AGENCY_TAG) {
      // RFA tag rows are emitted via rfa_cross_team_win events below
      // (same-team tag is intra-roster and treated as a new salary_basis=rfa holding).
      events.push({
        sort_ts: tran.timestamp,
        sort_priority: 2,
        kind: 'player_acquisition',
        tid: tran.tid,
        player_id: tran.pid,
        transaction_type: tran.type,
        occurred_at: ts,
        year: tran.year,
        value: tran.value,
        transaction_id: tran.uid
      })
    } else {
      events.push({
        sort_ts: tran.timestamp,
        sort_priority: 5,
        kind: 'coverage_warning',
        label: `unhandled_transaction_type_${tran.type}`,
        occurred_at: ts
      })
    }
  }

  // 3. RFA cross-team wins.
  const rfa = await db('restricted_free_agency_bids')
    .select('pid', 'tid', 'player_tid', 'processed', 'year')
    .where({ lid, succ: true })
    .whereNotNull('processed')
  for (const r of rfa) {
    if (r.tid === r.player_tid) continue
    events.push({
      sort_ts: r.processed,
      sort_priority: 2,
      kind: 'rfa_cross_team_win',
      player_id: r.pid,
      from_tid: r.player_tid,
      to_tid: r.tid,
      occurred_at: new Date(r.processed * 1000),
      year: r.year
    })
  }

  // 4. Trades (group baskets per trade).
  const trades = await db('trades')
    .where({ lid })
    .whereNotNull('accepted')
    .select('uid', 'propose_tid', 'accept_tid', 'year', 'accepted')
    .orderBy('accepted', 'asc')
  const trade_ids = trades.map((t) => t.uid)
  const trade_players = trade_ids.length
    ? await db('trades_players').whereIn('tradeid', trade_ids)
    : []
  const trade_picks = trade_ids.length
    ? await db('trades_picks').whereIn('tradeid', trade_ids)
    : []
  // Pre-resolve trades_picks.pickid -> pick metadata.
  const pickids = Array.from(new Set(trade_picks.map((p) => p.pickid)))
  const picks_meta = pickids.length
    ? await db('draft')
        .whereIn('uid', pickids)
        .select('uid', 'round', 'year', 'otid', 'pick')
    : []
  const pick_meta_by_id = new Map(picks_meta.map((p) => [p.uid, p]))
  for (const trade of trades) {
    const legs = []
    for (const tp of trade_players.filter((r) => r.tradeid === trade.uid)) {
      legs.push({
        asset_type: ASSET_TYPE.PLAYER,
        player_id: tp.pid,
        from_tid: tp.tid,
        to_tid: tp.tid === trade.propose_tid ? trade.accept_tid : trade.propose_tid
      })
    }
    for (const tpi of trade_picks.filter((r) => r.tradeid === trade.uid)) {
      const meta = pick_meta_by_id.get(tpi.pickid)
      if (!meta) {
        // Stray trades_picks row pointing at a draft row that no longer exists
        // (or never did). Without metadata we cannot open a typed pick holding;
        // skip the leg and surface as a coverage warning rather than emit a
        // holding with NULL pick_year/round/otid.
        events.push({
          sort_ts: trade.accepted,
          sort_priority: 5,
          kind: 'coverage_warning',
          label: 'trade_pick_meta_missing',
          occurred_at: new Date(trade.accepted * 1000)
        })
        continue
      }
      legs.push({
        asset_type: ASSET_TYPE.PICK,
        pickid: tpi.pickid,
        pick_year: meta.year,
        pick_round: meta.round,
        pick_original_owner_tid: meta.otid,
        pick_draft_overall_position: meta.pick,
        from_tid: tpi.tid,
        to_tid: tpi.tid === trade.propose_tid ? trade.accept_tid : trade.propose_tid
      })
    }
    events.push({
      sort_ts: trade.accepted,
      sort_priority: 3,
      kind: 'trade',
      occurred_at: new Date(trade.accepted * 1000),
      year: trade.year,
      legs
    })
  }

  // 5. Pick endowment + conversion.
  const all_picks = await db('draft').where({ lid }).select('uid', 'pid', 'tid', 'otid', 'round', 'pick', 'year', 'selection_timestamp')
  // Default endowment timestamp by year (prior-year draft_start).
  const years_for_picks = Array.from(new Set(all_picks.map((p) => p.year)))
  const endowment_by_year = new Map()
  for (const y of years_for_picks) {
    endowment_by_year.set(y, await resolve_endowment_date({ lid, year: y }))
  }
  // Per-pick override: if a pick was traded before its default endowment, push
  // the endowment back so the pre-trade ownership window exists.
  const earliest_trade_by_pickid = new Map()
  for (const trade of trades) {
    for (const tpi of trade_picks.filter((r) => r.tradeid === trade.uid)) {
      const prior = earliest_trade_by_pickid.get(tpi.pickid)
      if (prior == null || trade.accepted < prior) {
        earliest_trade_by_pickid.set(tpi.pickid, trade.accepted)
      }
    }
  }
  for (const pick of all_picks) {
    let endow_date = endowment_by_year.get(pick.year)
    const earliest_trade = earliest_trade_by_pickid.get(pick.uid)
    if (earliest_trade && earliest_trade * 1000 < endow_date.getTime()) {
      endow_date = new Date(earliest_trade * 1000 - 60_000)
    }
    events.push({
      sort_ts: Math.floor(endow_date.getTime() / 1000),
      sort_priority: 0, // process endowments first so trades-of-picks find an open source
      kind: 'pick_endowment',
      tid: pick.otid, // endowed to the original-owner team
      pickid: pick.uid,
      pick_year: pick.year,
      pick_round: pick.round,
      pick_original_owner_tid: pick.otid,
      pick_draft_overall_position: pick.pick,
      occurred_at: endow_date
    })
    if (pick.selection_timestamp && pick.pid) {
      events.push({
        sort_ts: pick.selection_timestamp,
        sort_priority: 4, // after DRAFT-transaction acquisition (priority 2) so the player draft exists
        kind: 'pick_conversion',
        tid: pick.tid,
        pickid: pick.uid,
        player_id: pick.pid,
        occurred_at: new Date(pick.selection_timestamp * 1000)
      })
    }
  }

  // Immediate-release flow (process-poach.mjs): when the poaching team lacks
  // roster space, the POACHED transaction is followed at the same timestamp
  // by a ROSTER_RELEASE on the same (tid, pid). Bump the release priority so
  // it processes after the acquisition, otherwise the release fires against
  // a not-yet-opened holding and the released period never gets recorded --
  // which then orphans any later super-priority resign.
  const poach_keys = new Set()
  for (const ev of events) {
    if (
      ev.kind === 'player_acquisition' &&
      ev.transaction_type === transaction_types.POACHED
    ) {
      poach_keys.add(`${ev.sort_ts}__${ev.tid}__${ev.player_id}`)
    }
  }
  for (const ev of events) {
    if (
      ev.kind === 'player_release' &&
      poach_keys.has(`${ev.sort_ts}__${ev.tid}__${ev.player_id}`)
    ) {
      ev.sort_priority = 6
    }
  }

  events.sort((a, b) => {
    if (a.sort_ts !== b.sort_ts) return a.sort_ts - b.sort_ts
    return a.sort_priority - b.sort_priority
  })
  return events
}

export default walk_transactions
