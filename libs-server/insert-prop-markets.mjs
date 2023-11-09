import debug from 'debug'

import db from '#db'
import config from '#config'
import sendDiscordMessage from './send-discord-message.mjs'
import insert_prop_market_selections from './insert-prop-market-selections.mjs'
import diff from 'deep-diff'

const log = debug('insert-prop-markets')
debug.enable('insert-prop-markets')

const insert_market = async ({ timestamp, selections, ...market }) => {
  // get existing market row in `prop_markets_history` table order by latest timestamp
  const existing_market = await db('prop_markets_history')
    .where('source_market_id', market.source_market_id)
    .orderBy('timestamp', 'desc')
    .first()

  // if market does not exist, insert it
  if (!existing_market) {
    const {
      source_id,
      source_market_id,
      source_market_name,
      open,
      live,
      selection_count
    } = market
    await db('prop_markets_history').insert({
      source_id,
      source_market_id,
      source_market_name,
      open,
      live,
      selection_count,
      timestamp
    })

    await db('prop_markets_index_new').insert({
      ...market,
      timestamp,
      time_type: 'OPEN'
    })
    await db('prop_markets_index_new').insert({
      ...market,
      timestamp,
      time_type: 'CLOSE'
    })

    // send notifcation to `props_market_new` channel
    const message = `New market detected on ${market.source_id} called \`${
      market.source_market_name
    }\` wtih ${market.selection_count} selections (open: ${
      market.open ? 'yes' : 'no'
    }, live: ${market.live ? 'yes' : 'no'})`

    log(message)

    await sendDiscordMessage({
      webhookUrl: config.discord_props_market_new_channel_webhook_url,
      message
    })
  } else {
    // format existing_market to convert `open` and `live` to booleans for comparison
    existing_market.open = Boolean(existing_market.open)
    existing_market.live = Boolean(existing_market.live)

    // remove timestamp from existing market
    delete existing_market.timestamp

    // get differences between existing market and new market
    const differences = diff(existing_market, market)

    if (differences && differences.length) {
      // insert market into `prop_markets_history` table when open, selection_count, or live changes
      const update_on_change = [
        'open',
        'selection_count',
        'live',
        'source_market_name'
      ]
      const should_update = differences.some((difference) =>
        update_on_change.includes(difference.path[0])
      )

      if (should_update) {
        const {
          source_id,
          source_market_id,
          source_market_name,
          open,
          live,
          selection_count
        } = market
        await db('prop_markets_history')
          .insert({
            timestamp,
            source_id,
            source_market_id,
            source_market_name,
            open,
            live,
            selection_count
          })
          .onConflict()
          .merge()
      }

      const notify_on_change = ['open', 'selection_count']
      // only notify on change if open or selection_count changes
      const should_notify = differences.some((difference) =>
        notify_on_change.includes(difference.path[0])
      )

      if (should_notify) {
        // create message for discord notification based on differences
        let message = `Market \`${market.source_market_name}\` on ${market.source_id} has changed.`
        for (const difference of differences) {
          const { kind, path, lhs, rhs } = difference
          if (kind === 'E') {
            message += `\n\`${path.join(
              '.'
            )}\` changed from \`${lhs}\` to \`${rhs}\``
          } else if (kind === 'N') {
            message += `\n\`${path.join('.')}\` added with value \`${rhs}\``
          } else if (kind === 'D') {
            message += `\n\`${path.join('.')}\` deleted with value \`${lhs}\``
          }
        }

        log(message)

        // send notification to `props_market_update` channel
        // await sendDiscordMessage({
        //   webhookUrl: config.discord_props_market_update_channel_webhook_url,
        //   message
        // })
      }
    }

    // update market in `prop_markets_index` table
    await db('prop_markets_index_new')
      .insert({ ...market, timestamp, time_type: 'CLOSE' })
      .onConflict()
      .merge()

    const selection_results = await insert_prop_market_selections({
      timestamp,
      selections,
      existing_market
    })

    // log(selection_results)
  }
}

export default async function (markets) {
  for (const market of markets) {
    await insert_market(market)
  }
}
