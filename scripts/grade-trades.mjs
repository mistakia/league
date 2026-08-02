import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import {
  load_pick_ktc_indexes,
  ktc_pick_at
} from '#libs-server/composite-market-value/ktc-pick-value-at.mjs'

const log = debug('grade-trades')
debug.enable('grade-trades')

// Grade a team's trades by following every asset forward through the lineage
// graph to whatever it is today, and comparing what the team received against
// what it gave up -- at the moment of the trade, and now.
//
// Two numbers per trade, and the gap between them is the point:
//   market_edge   value received minus value given, priced at the trade date.
//                 This is whether the trade was won at the negotiating table,
//                 on information available then.
//   realized_edge the same comparison priced today, after following each asset
//                 through every subsequent trade and pick conversion.
//
// A team can be consistently positive on market_edge and negative on
// realized_edge (wins negotiations, picks the wrong assets) or the reverse.
// Reporting only one of them cannot tell those apart.
//
// An asset with no still-held descendant -- released, expired, converted to a
// pick that was never used -- is worth 0 today. That is deliberate: in a
// dynasty league an asset you no longer control is not worth its last quoted
// price, it is worth nothing to you.

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('lid', { type: 'number', demandOption: true })
    .option('tid', {
      type: 'number',
      describe: 'grade from this team perspective; omit for every team'
    })
    .option('trade_uid', { type: 'number', describe: 'grade a single trade' })
    .option('year', {
      type: 'number',
      describe: 'limit to trades in this year'
    })
    .option('offseason', {
      type: 'boolean',
      default: false,
      describe: 'limit to trades made outside the September-December window'
    })
    .option('boom_threshold', {
      type: 'number',
      default: 2500,
      describe: 'realized_edge magnitude counting as a boom or a bust'
    })
    .option('min_age_days', {
      type: 'number',
      default: 0,
      describe: 'exclude trades more recent than this; outcomes need time'
    })
    .parse()

// A player who has fallen off the KTC board is not quoted at his last price --
// he is off the board because he is out of the league. Anything not observed
// inside this window is worth 0.
const STALE_VALUATION_DAYS = 30

const player_value_now = ({ player_id, ktc_now, now_unix }) => {
  const row = ktc_now.get(player_id)
  if (!row) return 0
  const age_days = (now_unix - row.d) / 86400
  return age_days > STALE_VALUATION_DAYS ? 0 : row.v
}

const load_current_player_values = async ({ player_ids }) => {
  const ktc_now = new Map()
  if (!player_ids.length) return ktc_now
  // DISTINCT ON gives the latest observation per pid in one pass.
  const rows = await db
    .select('pid', 'keeptradecut_value', 'observed_at')
    .distinctOn('pid')
    .from('keeptradecut_valuations')
    .whereIn('pid', player_ids)
    .where('is_superflex', true)
    .orderBy('pid')
    .orderBy('observed_at', 'desc')
  for (const r of rows) {
    ktc_now.set(r.pid, {
      d: Math.floor(r.observed_at.getTime() / 1000),
      v: Number(r.keeptradecut_value)
    })
  }
  return ktc_now
}

const load_num_teams_by_format = async ({ format_ids }) => {
  const by_format = new Map()
  if (!format_ids.length) return by_format
  const rows = await db('league_formats')
    .select('id', 'num_teams')
    .whereIn('id', format_ids)
  for (const r of rows) by_format.set(r.id, r.num_teams)
  return by_format
}

// Follow one traded asset forward to every holding still open today. A trade
// leg can fan out -- a pick becomes a player, a package is re-traded -- so the
// terminal set is a list, not a single row.
const load_terminal_holdings = async ({ origin_holding_ids }) => {
  const by_origin = new Map()
  if (!origin_holding_ids.length) return by_origin
  const rows = await db('view_roster_asset_lineage_walk as w')
    .join('roster_asset_holding as h', 'h.holding_id', 'w.current_holding_id')
    .whereIn('w.originating_holding_id', origin_holding_ids)
    .whereNull('h.period_end')
    .select(
      'w.originating_holding_id',
      'w.cumulative_weight',
      'h.holding_id',
      'h.tid',
      'h.asset_type',
      'h.player_id',
      'h.pick_year',
      'h.pick_round',
      'h.pick_draft_overall_position',
      'h.league_format_id'
    )
  for (const r of rows) {
    if (!by_origin.has(r.originating_holding_id)) {
      by_origin.set(r.originating_holding_id, [])
    }
    by_origin.get(r.originating_holding_id).push(r)
  }
  return by_origin
}

const grade_trades = async ({
  lid,
  tid = null,
  trade_uid = null,
  year = null,
  offseason = false,
  boom_threshold = 2500,
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

  const terminal_by_origin = await load_terminal_holdings({
    origin_holding_ids: legs.map((leg) => leg.target_holding_id)
  })

  const terminal_rows = [...terminal_by_origin.values()].flat()
  const ktc_now = await load_current_player_values({
    player_ids: [
      ...new Set(terminal_rows.map((r) => r.player_id).filter(Boolean))
    ]
  })
  const num_teams_by_format = await load_num_teams_by_format({
    format_ids: [
      ...new Set(terminal_rows.map((r) => r.league_format_id).filter(Boolean))
    ]
  })
  const pick_ktc = await load_pick_ktc_indexes({ is_superflex: true })

  const terminal_value = (row) => {
    if (row.player_id) {
      return player_value_now({ player_id: row.player_id, ktc_now, now_unix })
    }
    const num_teams = num_teams_by_format.get(row.league_format_id)
    if (!num_teams) return 0
    return (
      ktc_pick_at({
        pick_year: row.pick_year,
        pick_round: row.pick_round,
        pick_overall_position: row.pick_draft_overall_position,
        num_teams,
        target_unix: now_unix,
        idx: pick_ktc
      }) ?? 0
    )
  }

  const describe_terminal = (row) =>
    row.player_id || `${row.pick_year} R${row.pick_round} pick`

  const by_trade = new Map()
  for (const leg of legs) {
    // With --tid the perspective is that team; without it, the proposing side
    // of each leg is arbitrary, so grade from the receiving team's view.
    const perspective_tid = tid ?? leg.to_tid
    const is_acquired = leg.to_tid === perspective_tid
    const key = `${leg.trade_uid}__${perspective_tid}`
    if (!by_trade.has(key)) {
      by_trade.set(key, {
        trade_uid: leg.trade_uid,
        tid: perspective_tid,
        occurred_at: leg.occurred_at,
        acquired: [],
        sent: []
      })
    }
    const terminals = terminal_by_origin.get(leg.target_holding_id) || []
    const entry = {
      label: leg.player_id || `${leg.pick_year} R${leg.pick_round} pick`,
      market_value_at_trade: leg.market_value_at_trade
        ? Number(leg.market_value_at_trade)
        : null,
      value_now: terminals.reduce((sum, row) => sum + terminal_value(row), 0),
      became: terminals.map(describe_terminal)
    }
    by_trade.get(key)[is_acquired ? 'acquired' : 'sent'].push(entry)
  }

  const sum_of = (entries, field) =>
    entries.reduce((total, entry) => total + (entry[field] ?? 0), 0)

  const results = [...by_trade.values()]
    .map((trade) => {
      const unpriced =
        trade.acquired.filter((e) => e.market_value_at_trade == null).length +
        trade.sent.filter((e) => e.market_value_at_trade == null).length
      const market_edge =
        sum_of(trade.acquired, 'market_value_at_trade') -
        sum_of(trade.sent, 'market_value_at_trade')
      const realized_edge =
        sum_of(trade.acquired, 'value_now') - sum_of(trade.sent, 'value_now')
      return {
        ...trade,
        unpriced_legs: unpriced,
        market_edge: unpriced ? null : Math.round(market_edge),
        realized_edge: Math.round(realized_edge),
        swing: unpriced ? null : Math.round(realized_edge - market_edge)
      }
    })
    .sort((a, b) => a.occurred_at - b.occurred_at)

  for (const trade of results) {
    const date = trade.occurred_at.toISOString().slice(0, 10)
    const market =
      trade.market_edge == null
        ? `unpriced(${trade.unpriced_legs})`
        : trade.market_edge
    log(
      `trade ${trade.trade_uid} ${date} tid=${trade.tid} market_edge=${market} realized_edge=${trade.realized_edge}`
    )
    for (const entry of trade.acquired) {
      const became = entry.became.length ? entry.became.join(', ') : 'gone'
      log(`   in  ${entry.label} -> ${became} (now ${entry.value_now})`)
    }
    for (const entry of trade.sent) {
      const became = entry.became.length ? entry.became.join(', ') : 'gone'
      log(`   out ${entry.label} -> ${became} (now ${entry.value_now})`)
    }
  }

  const graded = results.length
  const wins = results.filter((t) => t.realized_edge > 0).length
  const booms = results.filter((t) => t.realized_edge >= boom_threshold).length
  const busts = results.filter((t) => t.realized_edge <= -boom_threshold).length
  const priced = results.filter((t) => t.market_edge != null)
  const total_realized = results.reduce((sum, t) => sum + t.realized_edge, 0)
  const pct = (count) => ((100 * count) / graded).toFixed(1)

  log('---')
  log(`graded ${graded} trades`)
  log(`win rate     ${pct(wins)}% (${wins}/${graded})`)
  log(`boom rate    ${pct(booms)}% (>= +${boom_threshold})`)
  log(`bust rate    ${pct(busts)}% (<= -${boom_threshold})`)
  log(`total realized_edge ${total_realized}`)
  log(`mean realized_edge  ${Math.round(total_realized / graded)}`)
  if (priced.length) {
    const mean_market = Math.round(
      priced.reduce((sum, t) => sum + t.market_edge, 0) / priced.length
    )
    log(
      `mean market_edge    ${mean_market} (over ${priced.length} fully priced)`
    )
  }
  if (priced.length < graded) {
    log(
      `${graded - priced.length} trades have a leg with no market value at the trade date; their market_edge is withheld rather than computed from one side`
    )
  }

  return results
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await grade_trades({
      lid: argv.lid,
      tid: argv.tid ?? null,
      trade_uid: argv.trade_uid ?? null,
      year: argv.year ?? null,
      offseason: argv.offseason,
      boom_threshold: argv.boom_threshold,
      min_age_days: argv.min_age_days
    })
  } catch (err) {
    error = err
    log(error)
  }
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default grade_trades
