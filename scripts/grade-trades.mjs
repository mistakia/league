import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main } from '#libs-server'
import grade_trades from '#libs-server/trade-review/grade-trades.mjs'
import format_trade_asset_label from '#libs-shared/format-trade-asset-label.mjs'

const log = debug('grade-trades')
debug.enable('grade-trades')

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
      describe: 'net_value_realized magnitude counting as a boom or a bust'
    })
    .option('min_age_days', {
      type: 'number',
      default: 0,
      describe: 'exclude trades more recent than this; outcomes need time'
    })
    .parse()

const describe_asset = (asset) => {
  const resulting = asset.resulting_assets.length
    ? asset.resulting_assets.map(format_trade_asset_label).join(', ')
    : asset.lineage_state
  return `${format_trade_asset_label(asset)} -> ${resulting} (now ${asset.current_market_value})`
}

const report = ({ results, boom_threshold }) => {
  for (const trade of results) {
    const date = trade.occurred_at.toISOString().slice(0, 10)
    const at_trade =
      trade.net_value_at_trade == null
        ? `unpriced(${trade.unpriced_leg_count})`
        : trade.net_value_at_trade
    log(
      `trade ${trade.trade_uid} ${date} tid=${trade.tid} net_value_at_trade=${at_trade} net_value_realized=${trade.net_value_realized}`
    )
    for (const asset of trade.acquired_assets) {
      log(`   in  ${describe_asset(asset)}`)
    }
    for (const asset of trade.sent_assets) {
      log(`   out ${describe_asset(asset)}`)
    }
  }

  const graded = results.length
  if (!graded) return

  const wins = results.filter((t) => t.net_value_realized > 0).length
  const booms = results.filter(
    (t) => t.net_value_realized >= boom_threshold
  ).length
  const busts = results.filter(
    (t) => t.net_value_realized <= -boom_threshold
  ).length
  const priced = results.filter((t) => t.net_value_at_trade != null)
  const total_realized = results.reduce(
    (sum, t) => sum + t.net_value_realized,
    0
  )
  const percentage_of_graded = (count) => ((100 * count) / graded).toFixed(1)

  log('---')
  log(`graded ${graded} trade perspectives`)
  log(`win rate     ${percentage_of_graded(wins)}% (${wins}/${graded})`)
  log(`boom rate    ${percentage_of_graded(booms)}% (>= +${boom_threshold})`)
  log(`bust rate    ${percentage_of_graded(busts)}% (<= -${boom_threshold})`)
  log(`total net_value_realized ${total_realized}`)
  log(`mean net_value_realized  ${Math.round(total_realized / graded)}`)
  if (priced.length) {
    const mean_at_trade = Math.round(
      priced.reduce((sum, t) => sum + t.net_value_at_trade, 0) / priced.length
    )
    log(
      `mean net_value_at_trade  ${mean_at_trade} (over ${priced.length} fully priced)`
    )
  }
  if (priced.length < graded) {
    log(
      `${graded - priced.length} trade perspectives have a leg with no market value at the trade date; their net_value_at_trade is withheld rather than computed from one side`
    )
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const results = await grade_trades({
      lid: argv.lid,
      tid: argv.tid ?? null,
      trade_uid: argv.trade_uid ?? null,
      year: argv.year ?? null,
      offseason: argv.offseason,
      min_age_days: argv.min_age_days
    })
    report({ results, boom_threshold: argv.boom_threshold })
  } catch (err) {
    error = err
    log(error)
  }
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
