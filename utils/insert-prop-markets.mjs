import debug from 'debug'

import db from '#db'
import config from '#config'
import sendDiscordMessage from './send-discord-message.mjs'
import { constants } from '#common'
import diff from 'deep-diff'

const log = debug('insert-prop-market')
debug.enable('insert-prop-market')

const insert_market = async ({ timestamp, ...market }) => {
  // get existing market row in `prop_markets` table order by latest timestamp
  const existing_market = await db('prop_markets')
    .where('market_id', market.market_id)
    .orderBy('timestamp', 'desc')
    .first()

  // if market does not exist, insert it
  if (!existing_market) {
    await db('prop_markets').insert({ timestamp, ...market })

    // send notifcation to `props_market_new` channel
    const message = `New market detected on ${
      constants.sourcesTitle[market.source_id]
    } called \`${market.market_name}\` wtih ${market.runners} runners (open: ${
      market.open ? 'yes' : 'no'
    }, live: ${market.live ? 'yes' : 'no'})`
    log(message)

    await sendDiscordMessage({
      webhookUrl: config.discord_props_market_new_channel_webhook_url,
      message
    })
  } else {
    // format existing_market to convert `open` and `live` to booleans
    existing_market.open = Boolean(existing_market.open)
    existing_market.live = Boolean(existing_market.live)

    // remove timestamp from existing market
    delete existing_market.timestamp

    // get differences between existing market and new market
    const differences = diff(existing_market, market)

    if (differences && differences.length) {
      // insert market into `prop_markets` table when open, runner count, or live changes
      const update_on_change = [
        'open',
        'runners',
        'live',
        'source_market_name',
        'market_name'
      ]
      const should_update = differences.some((difference) =>
        update_on_change.includes(difference.path[0])
      )

      if (should_update) {
        await db('prop_markets')
          .insert({ timestamp, ...market })
          .onConflict()
          .merge()
      }

      const notify_on_change = ['open', 'live', 'runnners']
      // only notify on change if open, live, or runners changes
      const should_notify = differences.some((difference) =>
        notify_on_change.includes(difference.path[0])
      )

      if (should_notify) {
        // create message for discord notification based on differences
        let message = `Market \`${market.market_name}\` on ${
          constants.sourcesTitle[market.source_id]
        } has changed.`
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
        await sendDiscordMessage({
          webhookUrl: config.discord_props_market_update_channel_webhook_url,
          message
        })
      }
    }
  }

  // insert market without timestamp into index table
  await db('prop_markets_index').insert(market).onConflict().merge()
}

export default async function (markets) {
  for (const market of markets) {
    await insert_market(market)
  }
}
