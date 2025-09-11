import debug from 'debug'

import db from '#db'
import insert_prop_market_selections from './insert-prop-market-selections.mjs'
import diff from 'deep-diff'

const log = debug('insert-prop-markets')
debug.enable('insert-prop-markets')

const insert_market = async ({ timestamp, selections, ...market }) => {
  const { source_id, source_market_id } = market

  if (!source_id) {
    throw new Error('source_id is required')
  }

  if (!source_market_id) {
    throw new Error('source_market_id is required')
  }

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

    await db('prop_markets_index').insert({
      ...market,
      timestamp,
      time_type: 'OPEN'
    })
    if (!live) {
      await db('prop_markets_index').insert({
        ...market,
        timestamp,
        time_type: 'CLOSE'
      })
    }

    const message = `New market detected on ${market.source_id} called \`${
      market.source_market_name
    }\` wtih ${market.selection_count} selections (open: ${
      market.open ? 'yes' : 'no'
    }, live: ${market.live ? 'yes' : 'no'})`

    log(message)
  } else {
    // existing market might be newer than this current market snapshot
    const previous_market_row = await db('prop_markets_history')
      .where('source_market_id', market.source_market_id)
      .where('timestamp', '<=', timestamp)
      .orderBy('timestamp', 'desc')
      .first()

    if (!previous_market_row) {
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
        .onConflict(['source_id', 'source_market_id', 'timestamp'])
        .merge()
    } else {
      // format previous_market_row to convert `open` and `live` to booleans for comparison
      previous_market_row.open = Boolean(previous_market_row.open)
      previous_market_row.live = Boolean(previous_market_row.live)

      // remove timestamp from existing market
      delete previous_market_row.timestamp

      // get differences between existing market and new market
      const differences = diff(previous_market_row, market)

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
            .onConflict(['source_id', 'source_market_id', 'timestamp'])
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
        }
      }
    }

    if (!market.live && timestamp > existing_market.timestamp) {
      await db('prop_markets_index')
        .insert({ ...market, timestamp, time_type: 'CLOSE' })
        .onConflict(['source_id', 'source_market_id', 'time_type'])
        .merge()
    }

    // TODO use return value for notifications
    await insert_prop_market_selections({
      timestamp,
      selections,
      existing_market: previous_market_row,
      market
    })
  }
}

export default async function (markets) {
  for (const market of markets) {
    try {
      await insert_market(market)
    } catch (err) {
      log(market)
      console.log(err)
      log(err)
    }
  }
}
