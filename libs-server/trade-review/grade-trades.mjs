import debug from 'debug'

import db from '#db'
import {
  load_pick_ktc_indexes,
  ktc_pick_at
} from '#libs-server/composite-market-value/ktc-pick-value-at.mjs'

const log = debug('grade-trades')

// Grade a league's trades by following every asset forward through the lineage
// graph to whatever it is today, and comparing what each side received against
// what it gave up -- at the moment of the trade, and now.
//
// Every trade yields exactly one record per participating team. The two records
// are sign-inverted mirrors, which is what gives a review surface its symmetric
// both-sides view for free.
//
// Three numbers per trade, and the gap between the first two is the point:
//   net_value_at_trade   value received minus value given, priced at the trade
//                        date. Whether the trade was won at the negotiating
//                        table, on information available then.
//   net_value_realized   the same comparison priced today, after following each
//                        asset through every subsequent trade and conversion.
//   net_value_change     realized minus at-trade.
//
// A team can be consistently positive on net_value_at_trade and negative on
// net_value_realized (wins negotiations, picks the wrong assets) or the
// reverse. Reporting only one of them cannot tell those apart.
//
// An asset with no still-held descendant -- released, expired, converted to a
// pick that was never used -- is worth 0 today. That is deliberate: in a
// dynasty league an asset you no longer control is not worth its last quoted
// price, it is worth nothing to you. A caller must render that as a named
// terminal state rather than a silent zero, which is what lineage_state is for.
//
// KeepTradeCut deletes a draft class once its draft has passed, so pick prices
// before 2023-09 are permanently unrecoverable. When ANY leg of a trade is
// unpriced, the whole trade's at-trade figure is withheld as null rather than
// computed from one side -- a zero there would read as an even trade.
//
// This module returns data and logs nothing but its own diagnostics; the
// win/boom/bust reporting lives in scripts/grade-trades.mjs.

// A player who has fallen off the KTC board is not quoted at his last price --
// he is off the board because he is out of the league. Anything not observed
// inside this window is worth 0.
const STALE_VALUATION_DAYS = 30

// Per-asset lineage states. An asset whose descendants are all closed values
// at zero, exactly as an asset nobody ever traded does, so the state is what
// stops a page reporting the two the same way.
//
// There is deliberately no "not computed" state. The walk view emits a
// depth-zero row for every holding and view_trade_asset_flow only yields a leg
// whose target holding exists, so a leg always has a chain. A lineage graph
// that has not caught up to a trade omits the TRADE, it does not produce an
// asset with an empty chain -- a state for that case could never fire and
// would read as a covered case that is not covered.
export const LINEAGE_STATE = {
  // Reachable, and nothing descended from it is still open. Consumed.
  no_longer_held: 'no_longer_held',
  // At least one descendant is still owned by somebody today.
  held: 'held'
}

// The identity columns every asset record carries, on the traded asset itself
// and on each thing it became.
const asset_identity = (row) => ({
  asset_type: row.asset_type,
  player_id: row.player_id,
  pick_year: row.pick_year,
  pick_round: row.pick_round,
  pick_draft_overall_position: row.pick_draft_overall_position
})

const current_player_value = ({
  player_id,
  player_valuation_by_id,
  now_unix
}) => {
  const valuation_row = player_valuation_by_id.get(player_id)
  if (!valuation_row) return 0
  const age_days = (now_unix - valuation_row.observed_unix) / 86400
  return age_days > STALE_VALUATION_DAYS ? 0 : valuation_row.value
}

const load_current_player_values = async ({ player_ids, now_unix }) => {
  const player_valuation_by_id = new Map()
  if (!player_ids.length) return player_valuation_by_id
  // DISTINCT ON gives the latest observation per pid in one pass.
  //
  // The observed_at floor is not an approximation -- it is the same
  // STALE_VALUATION_DAYS boundary current_player_value applies, moved into the
  // query. A pid whose latest observation is older than the window scores 0
  // either way: excluded here it is simply absent from the map, and the
  // missing-row branch already returns 0.
  //
  // It matters because keeptradecut_valuations holds one row per pid per day
  // over 2.35M rows, so the unbounded form read 513,004 rows to return 304 --
  // 891ms of the request, and the single dominant cost in the whole engine.
  const observed_at_floor = new Date(
    (now_unix - STALE_VALUATION_DAYS * 86400) * 1000
  )
  const rows = await db
    .select('pid', 'keeptradecut_value', 'observed_at')
    .distinctOn('pid')
    .from('keeptradecut_valuations')
    .whereIn('pid', player_ids)
    .where('is_superflex', true)
    .where('observed_at', '>=', observed_at_floor)
    .orderBy('pid')
    .orderBy('observed_at', 'desc')
  for (const valuation_row of rows) {
    player_valuation_by_id.set(valuation_row.pid, {
      observed_unix: Math.floor(valuation_row.observed_at.getTime() / 1000),
      value: Number(valuation_row.keeptradecut_value)
    })
  }
  return player_valuation_by_id
}

const load_num_teams_by_format = async ({ format_ids }) => {
  const by_format = new Map()
  if (!format_ids.length) return by_format
  const rows = await db('league_formats')
    .select('id', 'num_teams')
    .whereIn('id', format_ids)
  for (const format_row of rows) {
    by_format.set(format_row.id, format_row.num_teams)
  }
  return by_format
}

// The two sides of each trade, read from the trade record itself.
//
// view_trade_asset_flow.from_tid is the team that held the asset immediately
// before the trade, which is a derived fact about the lineage graph rather than
// a statement about who agreed to the deal. Reading the sides from
// trades.propose_tid / accept_tid means a trade has exactly two perspectives by
// construction, and no graph defect can ever invent a third team here.
//
// That is not hypothetical: the walker did emit legs naming a third team on 4
// of league 1's 735 legs until 3c13b27fc, when a pick's hop to the trading team
// was missing and its original owner stood in as the apparent counterparty.
// That defect is fixed and from_tid is now a participant on 735/735, guarded by
// the trade_leg_source_not_participant coverage warning. This function does not
// depend on either fact holding.
const load_trade_participants = async ({ lid, trade_uids }) => {
  const by_trade = new Map()
  if (!trade_uids.length) return by_trade
  const rows = await db('trades')
    .select('uid', 'propose_tid', 'accept_tid')
    .where('lid', lid)
    .whereIn('uid', trade_uids)
  for (const trade_row of rows) {
    by_trade.set(trade_row.uid, [trade_row.propose_tid, trade_row.accept_tid])
  }
  return by_trade
}

// Follow one traded asset forward through every holding it reaches, not just
// the ones still open today. Terminals are the still-open subset, derived by
// the caller rather than loaded by a second query over the same view.
//
// The transformation join MUST filter to source_holding_id IS NOT NULL. A
// drafted pick produces two rows pointing at the same target holding -- a
// pick_conversion lineage edge and a root draft edge whose source is NULL -- so
// a bare join on target_holding_id doubles every hop through a drafted pick.
const load_lineage_chains = async ({ origin_holding_ids }) => {
  const by_origin = new Map()
  if (!origin_holding_ids.length) return by_origin
  const rows = await db('view_roster_asset_lineage_walk as w')
    .join('roster_asset_holding as h', 'h.holding_id', 'w.current_holding_id')
    .leftJoin('roster_asset_transformation as t', function () {
      this.on('t.target_holding_id', '=', 'h.holding_id').andOnNotNull(
        't.source_holding_id'
      )
    })
    .whereIn('w.originating_holding_id', origin_holding_ids)
    .select(
      'w.originating_holding_id',
      'w.current_holding_id',
      'w.cumulative_weight',
      'w.depth',
      'w.root_kind',
      'h.holding_id',
      'h.tid',
      'h.asset_type',
      'h.player_id',
      'h.pick_year',
      'h.pick_round',
      'h.pick_draft_overall_position',
      'h.league_format_id',
      'h.period_start',
      'h.period_end',
      'h.terminated_by',
      'h.realized_pts_added_net_through_termination',
      'h.projected_pts_added_at_acquisition',
      'h.projected_pts_added_remaining_at_termination',
      'h.weeks_started',
      'h.weeks_active',
      'h.weeks_practice_squad',
      'h.salary_paid',
      'h.salary_basis',
      't.transformation_type',
      't.occurred_at as transformation_occurred_at',
      't.trade_uid as transformation_trade_uid',
      't.source_holding_id'
    )
    .orderBy('w.originating_holding_id')
    .orderBy('w.depth')
  for (const chain_row of rows) {
    if (!by_origin.has(chain_row.originating_holding_id)) {
      by_origin.set(chain_row.originating_holding_id, [])
    }
    by_origin.get(chain_row.originating_holding_id).push(chain_row)
  }
  return by_origin
}

const is_terminal = (chain_row) => chain_row.period_end == null

const grade_trades = async ({
  lid,
  tid = null,
  trade_uid = null,
  year = null,
  offseason = false,
  min_age_days = 0
}) => {
  const now_unix = Math.floor(Date.now() / 1000)

  let legs_query = db('view_trade_asset_flow').where('lid', lid)
  if (trade_uid) legs_query = legs_query.where('trade_uid', trade_uid)
  const all_legs = await legs_query.select('*')
  if (!all_legs.length) {
    log(`no trade legs found for lid=${lid}`)
    return []
  }

  const legs = all_legs.filter((leg) => {
    if (tid != null && leg.from_tid !== tid && leg.to_tid !== tid) return false
    const occurred = leg.occurred_at
    if (year != null && occurred.getUTCFullYear() !== year) return false
    // Month is 0-indexed; 8-11 is September through December.
    const month = occurred.getUTCMonth()
    if (offseason && month >= 8 && month <= 11) return false
    const age_days = (now_unix - Math.floor(occurred.getTime() / 1000)) / 86400
    if (age_days < min_age_days) return false
    return true
  })
  if (!legs.length) {
    log('no trade legs matched the given filters')
    return []
  }

  const legs_by_trade = new Map()
  for (const leg of legs) {
    if (!legs_by_trade.has(leg.trade_uid)) legs_by_trade.set(leg.trade_uid, [])
    legs_by_trade.get(leg.trade_uid).push(leg)
  }

  const participants_by_trade = await load_trade_participants({
    lid,
    trade_uids: [...legs_by_trade.keys()]
  })

  const chains_by_origin = await load_lineage_chains({
    origin_holding_ids: legs.map((leg) => leg.target_holding_id)
  })

  const chain_rows = [...chains_by_origin.values()].flat()
  const player_valuation_by_id = await load_current_player_values({
    player_ids: [
      ...new Set(chain_rows.map((row) => row.player_id).filter(Boolean))
    ],
    now_unix
  })
  const num_teams_by_format = await load_num_teams_by_format({
    format_ids: [
      ...new Set(chain_rows.map((row) => row.league_format_id).filter(Boolean))
    ]
  })
  const pick_ktc = await load_pick_ktc_indexes({ is_superflex: true })

  const terminal_value = (terminal_row) => {
    if (terminal_row.player_id) {
      return current_player_value({
        player_id: terminal_row.player_id,
        player_valuation_by_id,
        now_unix
      })
    }
    const num_teams = num_teams_by_format.get(terminal_row.league_format_id)
    if (!num_teams) return 0
    return (
      ktc_pick_at({
        pick_year: terminal_row.pick_year,
        pick_round: terminal_row.pick_round,
        pick_overall_position: terminal_row.pick_draft_overall_position,
        num_teams,
        target_unix: now_unix,
        idx: pick_ktc
      }) ?? 0
    )
  }

  const build_asset_outcome = (leg) => {
    const chain = chains_by_origin.get(leg.target_holding_id) || []
    const terminals = chain.filter(is_terminal)
    const lineage_state = terminals.length
      ? LINEAGE_STATE.held
      : LINEAGE_STATE.no_longer_held
    return {
      ...asset_identity(leg),
      origin_holding_id: leg.target_holding_id,
      market_value_at_trade: leg.market_value_at_trade
        ? Number(leg.market_value_at_trade)
        : null,
      current_market_value: terminals.reduce(
        (sum, terminal_row) => sum + terminal_value(terminal_row),
        0
      ),
      resulting_assets: terminals.map((terminal_row) => ({
        ...asset_identity(terminal_row),
        holding_id: terminal_row.holding_id,
        tid: terminal_row.tid
      })),
      lineage_state,
      // 0 means the asset is sitting where it landed and never moved again.
      // The chain always holds at least the asset's own depth-zero row.
      hop_count: chain.length ? chain.length - 1 : 0,
      chain
    }
  }

  // For perspective team T the acquired side is legs where to_tid = T, and the
  // sent side is everything else in the trade. to_tid is a participant on every
  // leg, so with exactly two participants this partitions the legs cleanly.
  const results = []
  for (const [uid, trade_legs] of legs_by_trade) {
    const participants = participants_by_trade.get(uid)
    if (!participants) {
      log(`trade ${uid} has legs but no trades row; skipping`)
      continue
    }
    const perspectives =
      tid == null ? participants : participants.filter((t) => t === tid)
    for (const perspective_tid of perspectives) {
      const acquired_assets = trade_legs
        .filter((leg) => leg.to_tid === perspective_tid)
        .map(build_asset_outcome)
      const sent_assets = trade_legs
        .filter((leg) => leg.to_tid !== perspective_tid)
        .map(build_asset_outcome)

      const sum_of = (assets, field) =>
        assets.reduce((total, asset) => total + (asset[field] ?? 0), 0)
      const unpriced_leg_count =
        acquired_assets.filter((a) => a.market_value_at_trade == null).length +
        sent_assets.filter((a) => a.market_value_at_trade == null).length
      const net_value_at_trade =
        sum_of(acquired_assets, 'market_value_at_trade') -
        sum_of(sent_assets, 'market_value_at_trade')
      const net_value_realized =
        sum_of(acquired_assets, 'current_market_value') -
        sum_of(sent_assets, 'current_market_value')

      results.push({
        trade_uid: uid,
        tid: perspective_tid,
        counterparty_tid: participants.find((t) => t !== perspective_tid),
        occurred_at: trade_legs[0].occurred_at,
        acquired_assets,
        sent_assets,
        unpriced_leg_count,
        net_value_at_trade: unpriced_leg_count
          ? null
          : Math.round(net_value_at_trade),
        net_value_realized: Math.round(net_value_realized),
        net_value_change: unpriced_leg_count
          ? null
          : Math.round(net_value_realized - net_value_at_trade)
      })
    }
  }

  return results.sort((a, b) => a.occurred_at - b.occurred_at || a.tid - b.tid)
}

export default grade_trades
