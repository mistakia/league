import debug from 'debug'

import db from '#db'
import {
  load_pick_ktc_indexes,
  ktc_pick_at
} from '#libs-server/composite-market-value/ktc-pick-value-at.mjs'
import { derive_league_format_is_superflex } from '#libs-server/derive-league-format-is-superflex.mjs'
import { TRANSFORMATION_TYPE } from '#libs-server/roster-asset-lineage/constants.mjs'

const log = debug('grade-trades')

// Grade a league's trades: what each side received against what it gave up, at
// the moment of the trade and today.
//
// Every trade yields exactly one record per participating team. The two records
// are sign-inverted mirrors, which is what gives a review surface its symmetric
// both-sides view for free.
//
// ASSET LINEAGE AND TEAM ACCOUNTING ARE DIFFERENT TRAVERSALS OVER ONE GRAPH,
// and every value field here states which one it belongs to. roster_asset_
// transformation models a trade as a one-to-one asset move, which is the right
// model for "where did this player end up" and the wrong one for "what did this
// team get out of the deal": a team's economic interest in a trade does not end
// when it trades the acquired asset onward, it continues into whatever came
// back. Reporting on teams while traversing assets is what produced both a
// team credited with the current value of assets it no longer holds and a team
// reported at zero where it had converted the asset into something it still
// holds -- over- and under-reporting from one cause.
//
// Three per-asset value figures, each a property of something different:
//   keeptradecut_value_at_trade      what the leg was worth on the day.
//                                    A property of the LEG.
//   keeptradecut_value_still_held    what the receiving team still holds off
//                                    this asset. A property of TEAM and ASSET.
//   keeptradecut_value_proceeds      what this team's side of the trade turned
//                                    into for it, following the consideration
//                                    through every onward trade. A property of
//                                    TEAM and TRADE, and see the warning below.
//
// The unfiltered asset-line sum is an internal intermediate and deliberately
// does not reach the wire. resulting_assets already carries every open
// descendant with its holder's tid, so a caller that wants to know where the
// line went can see it directly.
//
// THE PROCEEDS FIGURE IS TRANSITIVELY ATTRIBUTED. The same value legitimately
// appears on the card of every trade along a conversion chain. Per trade it is
// right; it must NEVER be summed or averaged across a team's trades.
//
// A leg whose team disposed of the asset for nothing recoverable is worth 0
// today, which is deliberate: in a dynasty league an asset you no longer
// control is not worth its last quoted price, it is worth nothing to you. A
// caller must render that as a named state rather than a silent zero, which is
// what team_asset_state is for.
//
// KeepTradeCut deletes a draft class once its draft has passed, so pick prices
// before 2023-09 are permanently unrecoverable. When ANY leg of a trade is
// unpriced, the whole trade's at-trade figure is withheld as null rather than
// computed from one side -- a zero there would read as an even trade. The
// proceeds figure withholds on its own terms and for a different reason: an
// unpriced or incomplete outgoing bundle makes the weight a division by an
// unknown, not merely a one-sided net.
//
// This module returns data and logs nothing but its own diagnostics; the
// win/boom/bust reporting lives in scripts/grade-trades.mjs.

// A player who has fallen off the KTC board is not quoted at his last price --
// he is off the board because he is out of the league. Anything not observed
// inside this window is worth 0.
const STALE_VALUATION_DAYS = 30

// What the RECEIVING TEAM did with the asset it received. The axis is the team,
// not the lineage: two of these three describe an act by that team, and the
// state exists to stop a page reporting a converted asset and a squandered one
// the same way.
//
// Derived from the transformation type of the team's OWN TERMINATION EDGE, not
// from partitioning the open terminals. Partitioning leaves a fourth case
// unnamed and mislabelled: a team that traded an asset onward whose line then
// died has no open terminal at all, so it reads "consumed" beside a non-zero
// proceeds figure -- which is exactly the population this module was changed
// for. Deriving from the edge gives a closed set with no fourth case.
//
// The three are exhaustive but NOT mutually exclusive: a team that traded a
// line away and later reacquired it matches both traded_onward and still_held.
// TRADED_ONWARD WINS, because the proceeds figure stops at the first disposal
// and deliberately excludes the reacquired asset -- reading "still held" beside
// it would describe a figure that does not include what is being named.
//
// There is deliberately no "not computed" state. The walk view emits a
// depth-zero row for every holding and view_trade_asset_flow only yields a leg
// whose target holding exists, so a leg always has a chain.
export const TEAM_ASSET_STATE = {
  // The receiving team has an open holding in this chain.
  still_held: 'still_held',
  // The receiving team's holding terminated via a trade transformation. Note
  // the derivation must resolve the transformation TYPE and not the
  // termination reason: terminated_by = TRADE also covers poaches and
  // restricted-free-agency wins, which take an asset away for no consideration.
  traded_onward: 'traded_onward',
  // The team's holdings all ended some other way -- released, expired,
  // converted to nothing.
  consumed: 'consumed'
}

// A team's holding can only reach a depth this far down a conversion chain in a
// graph that has a defect. Production maxes out at 9.
const MAX_PROCEEDS_DEPTH = 40

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

const load_current_player_values = async ({
  player_ids,
  now_unix,
  is_superflex
}) => {
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
    .where('is_superflex', is_superflex)
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
    .select('id', 'number_teams')
    .whereIn('id', format_ids)
  for (const format_row of rows) {
    by_format.set(format_row.id, format_row.number_teams)
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
    .select('trade_id', 'propose_tid', 'accept_tid')
    .where('lid', lid)
    .whereIn('trade_id', trade_uids)
  for (const trade_row of rows) {
    by_trade.set(trade_row.trade_id, [
      trade_row.propose_tid,
      trade_row.accept_tid
    ])
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
      't.trade_id as transformation_trade_id',
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

// Trades whose lineage legs are short of what the trade source tables record.
//
// view_trade_asset_flow yields a leg only where both the source and the target
// holding exist, so a gap in the lineage graph silently drops one. That matters
// only for the proceeds weight, and it matters a lot: a missing outgoing leg
// understates the bundle, inflating the weight toward 1.0 where the true share
// is a fraction. It never trips the unpriced rule, because a missing leg is not
// an unpriced one -- there is nothing there to be null.
const load_short_bundle_trade_uids = async ({ lid, legs_by_trade }) => {
  const short = new Set()
  const trade_uids = [...legs_by_trade.keys()].filter((uid) => uid != null)
  if (!trade_uids.length) return short

  const source_counts = new Map()
  for (const table of ['trades_players', 'trades_picks']) {
    const rows = await db(table)
      .whereIn('trade_id', trade_uids)
      .groupBy('trade_id')
      .select('trade_id')
      .count('* as count')
    for (const row of rows) {
      source_counts.set(
        row.trade_id,
        (source_counts.get(row.trade_id) || 0) + Number(row.count)
      )
    }
  }

  for (const uid of trade_uids) {
    const flow_count = legs_by_trade.get(uid).length
    if (flow_count < (source_counts.get(uid) || 0)) short.add(uid)
  }
  if (short.size) {
    log(
      `${short.size} trades have fewer lineage legs than trade source rows; their proceeds figures are withheld`
    )
  }
  return short
}

const is_terminal = (chain_row) => chain_row.period_end == null

// What a team actually got out of what it received, in production and in cost,
// as distinct from what the market says the assets were worth.
//
// A chain follows an asset PAST this team -- a player traded onward keeps
// accruing holdings under whoever holds him next -- so only rows belonging to
// this team are counted. Anything else would credit a team with points another
// roster scored.
//
// This is the one figure the list route cannot derive for itself: chains are
// stripped from the list payload, so a collapsed row has nothing to sum.
const production_while_held = ({ assets, tid }) => {
  let realized_points_added = 0
  let salary_paid = 0
  for (const asset of assets) {
    for (const chain_row of asset.chain) {
      if (chain_row.tid !== tid) continue
      realized_points_added += Number(
        chain_row.realized_pts_added_net_through_termination ?? 0
      )
      salary_paid += Number(chain_row.salary_paid ?? 0)
    }
  }
  return {
    realized_points_added: Math.round(realized_points_added * 10) / 10,
    salary_paid: Math.round(salary_paid)
  }
}

const grade_trades = async ({
  lid,
  tid = null,
  trade_id = null,
  year = null,
  offseason = false,
  min_age_days = 0
}) => {
  const now_unix = Math.floor(Date.now() / 1000)

  // The league's WHOLE leg set, deliberately unnarrowed by trade_id. The
  // consideration traversal walks from a trade into later trades, so a leg set
  // narrowed before the walk truncates it silently: the figure collapses to
  // still-held on the detail route and loses records that cross a year boundary
  // on a year-filtered list, and both fail as a smaller number rather than as a
  // null, which mirror symmetry cannot see. Filtering is applied to the OUTPUT
  // records below instead.
  const all_legs = await db('view_trade_asset_flow')
    .where('lid', lid)
    .select('*')
  if (!all_legs.length) {
    log(`no trade legs found for lid=${lid}`)
    return []
  }

  const legs = all_legs.filter((leg) => {
    if (trade_id != null && leg.trade_id !== trade_id) return false
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

  // legs_by_trade drives which records are EMITTED and is filtered.
  // all_legs_by_trade drives the traversal and is not.
  const legs_by_trade = new Map()
  for (const leg of legs) {
    if (!legs_by_trade.has(leg.trade_id)) legs_by_trade.set(leg.trade_id, [])
    legs_by_trade.get(leg.trade_id).push(leg)
  }
  const all_legs_by_trade = new Map()
  const leg_by_source_holding = new Map()
  for (const leg of all_legs) {
    if (!all_legs_by_trade.has(leg.trade_id)) {
      all_legs_by_trade.set(leg.trade_id, [])
    }
    all_legs_by_trade.get(leg.trade_id).push(leg)
    leg_by_source_holding.set(leg.source_holding_id, leg)
  }

  const participants_by_trade = await load_trade_participants({
    lid,
    trade_uids: [...legs_by_trade.keys()]
  })

  const short_bundle_trade_uids = await load_short_bundle_trade_uids({
    lid,
    legs_by_trade: all_legs_by_trade
  })

  const chains_by_origin = await load_lineage_chains({
    origin_holding_ids: all_legs.map((leg) => leg.target_holding_id)
  })

  const chain_rows = [...chains_by_origin.values()].flat()
  const is_superflex = await derive_league_format_is_superflex({ lid })
  const player_valuation_by_id = await load_current_player_values({
    player_ids: [
      ...new Set(chain_rows.map((row) => row.player_id).filter(Boolean))
    ],
    now_unix,
    is_superflex
  })
  const num_teams_by_format = await load_num_teams_by_format({
    format_ids: [
      ...new Set(chain_rows.map((row) => row.league_format_id).filter(Boolean))
    ]
  })
  const pick_ktc = await load_pick_ktc_indexes({ is_superflex })

  const terminal_value = (terminal_row) => {
    if (terminal_row.player_id) {
      return current_player_value({
        player_id: terminal_row.player_id,
        player_valuation_by_id,
        now_unix
      })
    }
    const number_teams = num_teams_by_format.get(terminal_row.league_format_id)
    if (!number_teams) return 0
    return (
      ktc_pick_at({
        pick_year: terminal_row.pick_year,
        pick_round: terminal_row.pick_round,
        pick_overall_position: terminal_row.pick_draft_overall_position,
        number_teams,
        target_unix: now_unix,
        idx: pick_ktc
      }) ?? 0
    )
  }

  // The child edge of each holding within one chain. A chain row carries the
  // transformation that CREATED it, so how a holding ENDED is a fact about its
  // child. Chains do not branch on today's corpus, but the schema permits it
  // and "the first disposal" is ill-defined if they ever do.
  let branching_holdings = 0
  const child_edges_of = (chain) => {
    const by_source = new Map()
    for (const chain_row of chain) {
      if (chain_row.source_holding_id == null) continue
      if (by_source.has(chain_row.source_holding_id)) branching_holdings += 1
      by_source.set(chain_row.source_holding_id, chain_row)
    }
    return by_source
  }

  const team_asset_state_of = ({ chain, owner_tid }) => {
    const child_of = child_edges_of(chain)
    const traded_onward = chain.some(
      (chain_row) =>
        chain_row.tid === owner_tid &&
        child_of.get(chain_row.holding_id)?.transformation_type ===
          TRANSFORMATION_TYPE.TRADE
    )
    if (traded_onward) return TEAM_ASSET_STATE.traded_onward
    const still_held = chain.some(
      (chain_row) => chain_row.tid === owner_tid && is_terminal(chain_row)
    )
    if (still_held) return TEAM_ASSET_STATE.still_held
    return TEAM_ASSET_STATE.consumed
  }

  // keeptradecut_value_proceeds for the leg whose origin holding is
  // origin_holding_id, received by owner_tid.
  //
  // Walks DOWN the chain and stops at the team's FIRST disposal. Iterating
  // every own-team row instead double counts a reacquisition: it adds both what
  // the team received in exchange and the same asset coming back, never netting
  // the reacquisition cost. Anything the team did with the line after trading
  // it away belongs to a later trade's card, not to this one.
  //
  // Withholding is whole and returns null, never a partial sum beside a flag:
  // an unpriced or short outgoing bundle makes the weight a division by an
  // unknown, so there is no term to be partially right about.
  let cycle_guard_hits = 0
  let depth_guard_hits = 0
  const proceeds_memo = new Map()

  const proceeds_of = ({ origin_holding_id, owner_tid, depth, visiting }) => {
    if (depth > MAX_PROCEEDS_DEPTH) {
      depth_guard_hits += 1
      return { value: null, guard_hit: true }
    }
    const key = `${origin_holding_id}__${owner_tid}`
    if (proceeds_memo.has(key)) return proceeds_memo.get(key)
    if (visiting.has(key)) {
      cycle_guard_hits += 1
      return { value: null, guard_hit: true }
    }
    visiting.add(key)

    const chain = chains_by_origin.get(origin_holding_id) || []
    const by_holding_id = new Map(
      chain.map((chain_row) => [chain_row.holding_id, chain_row])
    )
    const child_of = child_edges_of(chain)

    let value = 0
    let withheld = false
    let guard_hit = false
    let current = by_holding_id.get(origin_holding_id)

    while (current && current.tid === owner_tid) {
      if (is_terminal(current)) {
        value += terminal_value(current)
        break
      }

      const child = child_of.get(current.holding_id)
      // The line died under this team -- released, expired, converted to
      // nothing. Worth zero to it, which is a real answer rather than a gap.
      if (!child) break

      // A pick conversion or an extension keeps the asset with this team, so
      // keep walking. A poach or a restricted-free-agency win takes it away for
      // no consideration, which the owner check at the top of the loop catches.
      if (child.transformation_type !== TRANSFORMATION_TYPE.TRADE) {
        current = child
        continue
      }

      const onward_uid = child.transformation_trade_id
      const onward_legs = onward_uid ? all_legs_by_trade.get(onward_uid) : null
      const sent = onward_legs
        ? onward_legs.filter((leg) => leg.to_tid !== owner_tid)
        : []
      const received = onward_legs
        ? onward_legs.filter((leg) => leg.to_tid === owner_tid)
        : []

      // The team demonstrably traded the asset away and what it got is not
      // recoverable. Zero would read as "got nothing", a different and false
      // claim.
      if (!onward_legs || !sent.length || !received.length) {
        withheld = true
        break
      }
      if (short_bundle_trade_uids.has(onward_uid)) {
        withheld = true
        break
      }

      const total_sent = sent.reduce(
        (sum, leg) =>
          sum +
          (leg.keeptradecut_value_at_trade == null
            ? NaN
            : Number(leg.keeptradecut_value_at_trade)),
        0
      )
      const outgoing_leg = leg_by_source_holding.get(current.holding_id)
      const outgoing_value =
        outgoing_leg && outgoing_leg.keeptradecut_value_at_trade != null
          ? Number(outgoing_leg.keeptradecut_value_at_trade)
          : NaN

      if (
        !Number.isFinite(total_sent) ||
        !Number.isFinite(outgoing_value) ||
        total_sent === 0
      ) {
        withheld = true
        break
      }

      const weight = outgoing_value / total_sent
      for (const inbound of received) {
        const onward = proceeds_of({
          origin_holding_id: inbound.target_holding_id,
          owner_tid,
          depth: depth + 1,
          visiting
        })
        if (onward.guard_hit) guard_hit = true
        if (onward.value == null) {
          withheld = true
          continue
        }
        value += weight * onward.value
      }
      break
    }

    visiting.delete(key)
    const outcome = { value: withheld ? null : value, guard_hit }
    // An entry whose subtree hit a guard is conditional on the path that
    // reached it, so memoizing it poisons every later reader.
    if (!guard_hit) proceeds_memo.set(key, outcome)
    return outcome
  }

  const build_asset_outcome = (leg) => {
    const chain = chains_by_origin.get(leg.target_holding_id) || []
    const terminals = chain.filter(is_terminal)
    // The RECEIVING team, read off the leg rather than threaded through from
    // the perspective. The same leg is built from both perspectives with the
    // same to_tid, which is what keeps the two records exact mirrors.
    const owner_tid = leg.to_tid
    return {
      ...asset_identity(leg),
      origin_holding_id: leg.target_holding_id,
      // An explicit null check, not a truthiness test: a stored 0 is a real
      // quote for a player off the KeepTradeCut board on the trade date, and
      // treating it as unpriced withholds the whole trade's at-trade figure
      // and change over complete data.
      keeptradecut_value_at_trade:
        leg.keeptradecut_value_at_trade == null
          ? null
          : Number(leg.keeptradecut_value_at_trade),
      keeptradecut_value_still_held: terminals
        .filter((terminal_row) => terminal_row.tid === owner_tid)
        .reduce((sum, terminal_row) => sum + terminal_value(terminal_row), 0),
      keeptradecut_value_proceeds: proceeds_of({
        origin_holding_id: leg.target_holding_id,
        owner_tid,
        depth: 0,
        visiting: new Set()
      }).value,
      // Every open descendant, whoever holds it, each carrying its holder's
      // tid. This is the asset LINE rather than the team's stake in it, and it
      // is the reason the unfiltered value sum needs no field of its own.
      resulting_assets: terminals.map((terminal_row) => ({
        ...asset_identity(terminal_row),
        holding_id: terminal_row.holding_id,
        tid: terminal_row.tid
      })),
      team_asset_state: team_asset_state_of({ chain, owner_tid }),
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
      // A withheld leg withholds the whole side, matching the policy
      // net_value_at_trade already applies -- though for a different reason:
      // there a one-sided net would read as a verdict, here the weight is
      // undefined and there is no partial figure to report.
      const side_proceeds = (assets) =>
        assets.some((asset) => asset.keeptradecut_value_proceeds == null)
          ? null
          : sum_of(assets, 'keeptradecut_value_proceeds')
      const unpriced_leg_count =
        acquired_assets.filter((a) => a.keeptradecut_value_at_trade == null)
          .length +
        sent_assets.filter((a) => a.keeptradecut_value_at_trade == null).length
      const net_value_at_trade =
        sum_of(acquired_assets, 'keeptradecut_value_at_trade') -
        sum_of(sent_assets, 'keeptradecut_value_at_trade')
      const net_value_still_held =
        sum_of(acquired_assets, 'keeptradecut_value_still_held') -
        sum_of(sent_assets, 'keeptradecut_value_still_held')
      const acquired_proceeds = side_proceeds(acquired_assets)
      const sent_proceeds = side_proceeds(sent_assets)
      const net_value_proceeds =
        acquired_proceeds == null || sent_proceeds == null
          ? null
          : Math.round(acquired_proceeds - sent_proceeds)

      const production = production_while_held({
        assets: acquired_assets,
        tid: perspective_tid
      })

      results.push({
        trade_id: uid,
        realized_points_added_while_held: production.realized_points_added,
        salary_paid_while_held: production.salary_paid,
        tid: perspective_tid,
        counterparty_tid: participants.find((t) => t !== perspective_tid),
        occurred_at: trade_legs[0].occurred_at,
        acquired_assets,
        sent_assets,
        unpriced_leg_count,
        net_value_at_trade: unpriced_leg_count
          ? null
          : Math.round(net_value_at_trade),
        net_value_still_held: Math.round(net_value_still_held),
        net_value_proceeds,
        net_value_proceeds_change:
          unpriced_leg_count || net_value_proceeds == null
            ? null
            : Math.round(net_value_proceeds - net_value_at_trade)
      })
    }
  }

  // Assertions rather than assumptions. Both are zero on today's corpus and
  // both are silent-corruption shapes if they ever stop being: a cycle poisons
  // the memo, and a branching chain makes "the first disposal" ill-defined.
  if (cycle_guard_hits || depth_guard_hits) {
    log(
      `proceeds traversal hit its guards: ${cycle_guard_hits} cycles, ${depth_guard_hits} depth caps. Those figures are withheld.`
    )
  }
  if (branching_holdings) {
    log(
      `${branching_holdings} holdings carry more than one child edge; the disposal boundary is ill-defined for them`
    )
  }

  return results.sort((a, b) => a.occurred_at - b.occurred_at || a.tid - b.tid)
}

export default grade_trades
