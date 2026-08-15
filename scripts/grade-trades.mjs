import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main } from '#libs-server'
import grade_trades from '#libs-server/trade-review/grade-trades.mjs'
import format_trade_asset_label from '#libs-shared/format-trade-asset-label.mjs'

const log = debug('grade-trades')
debug.enable('grade-trades')

// Calibrated against league 1's net_value_proceeds distribution, which is not
// the distribution the old default was set against: the figure it grades is now
// what a side's assets turned into for that team rather than the unfiltered
// asset line, and the spread narrowed. Re-derive it before reading the rates as
// anything but a relative signal on another league.
const BOOM_THRESHOLD_DEFAULT = 2500

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
      default: BOOM_THRESHOLD_DEFAULT,
      describe: 'net_value_proceeds magnitude counting as a boom or a bust'
    })
    .option('min_age_days', {
      type: 'number',
      default: 0,
      describe: 'exclude trades more recent than this; outcomes need time'
    })
    .parse()

const describe_asset = (asset) => {
  const resulting = asset.resulting_assets.length
    ? asset.resulting_assets
        .map((entry) => `${format_trade_asset_label(entry)}@${entry.tid}`)
        .join(', ')
    : '-'
  // The two figures are printed distinctly and never added: still-held is what
  // this team holds off the line, proceeds is what its side turned into. A
  // withheld proceeds figure prints as such rather than as a zero.
  const proceeds =
    asset.keeptradecut_value_proceeds == null
      ? 'withheld'
      : Math.round(asset.keeptradecut_value_proceeds)
  return `${format_trade_asset_label(asset)} [${asset.team_asset_state}] -> ${resulting} (still held ${Math.round(asset.keeptradecut_value_still_held)}, proceeds ${proceeds})`
}

const report = ({ results, boom_threshold }) => {
  for (const trade of results) {
    const date = trade.occurred_at.toISOString().slice(0, 10)
    const at_trade =
      trade.net_value_at_trade == null
        ? `unpriced(${trade.unpriced_leg_count})`
        : trade.net_value_at_trade
    const proceeds =
      trade.net_value_proceeds == null ? 'withheld' : trade.net_value_proceeds
    log(
      `trade ${trade.trade_uid} ${date} tid=${trade.tid} net_value_at_trade=${at_trade} net_value_still_held=${trade.net_value_still_held} net_value_proceeds=${proceeds}`
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

  // Win, boom and bust are graded on the proceeds figure, over the records that
  // HAVE one. A withheld figure is reported separately rather than folded in as
  // a zero, which would count every withheld record as a loss.
  const attributed = results.filter((t) => t.net_value_proceeds != null)
  const withheld = graded - attributed.length
  const wins = attributed.filter((t) => t.net_value_proceeds > 0).length
  const booms = attributed.filter(
    (t) => t.net_value_proceeds >= boom_threshold
  ).length
  const busts = attributed.filter(
    (t) => t.net_value_proceeds <= -boom_threshold
  ).length
  const priced = results.filter((t) => t.net_value_at_trade != null)
  const percentage_of_attributed = (count) =>
    attributed.length ? ((100 * count) / attributed.length).toFixed(1) : '0.0'

  log('---')
  log(`graded ${graded} trade perspectives`)
  log(
    `attributed ${attributed.length}; ${withheld} withheld because an outgoing bundle was unpriced or short of the trade source tables`
  )
  log(
    `win rate     ${percentage_of_attributed(wins)}% (${wins}/${attributed.length})`
  )
  log(
    `boom rate    ${percentage_of_attributed(booms)}% (>= +${boom_threshold})`
  )
  log(
    `bust rate    ${percentage_of_attributed(busts)}% (<= -${boom_threshold})`
  )
  // No total and no mean. net_value_proceeds is transitively attributed -- the
  // same value appears on every card along a conversion chain -- so summing or
  // averaging it across a team's trades multiplies one outcome by the length of
  // the chain. Under --tid that triple counts. The lines are deleted rather
  // than repointed because there is no correct field to repoint them at.
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
