import diff from 'deep-diff'
import debug from 'debug'

import db from '#db'

const log = debug('insert-prop-market-selections')

const insert_market_selection = async ({
  timestamp,
  selection,
  existing_market,
  market
}) => {
  const save_new_selection = async () => {
    const {
      source_id,
      source_market_id,
      source_selection_id,
      selection_name,
      selection_metric_line,
      odds_decimal,
      odds_american
    } = selection
    await db('prop_market_selections_history').insert({
      source_id,
      source_market_id,
      source_selection_id,
      selection_name,
      selection_metric_line,
      odds_decimal,
      odds_american,
      timestamp
    })

    if (!source_id) {
      throw new Error('source_id is required')
    }

    if (!source_market_id) {
      throw new Error('source_market_id is required')
    }

    if (!source_selection_id) {
      throw new Error('source_selection_id is required')
    }

    if (!odds_american) {
      throw new Error('odds_american is required')
    }

    if (!odds_decimal) {
      throw new Error('odds_decimal is required')
    }

    if (!timestamp) {
      throw new Error('timestamp is required')
    }

    await db('prop_market_selections_index').insert({
      ...selection,
      timestamp,
      time_type: 'OPEN'
    })
    if (!market.live) {
      await db('prop_market_selections_index').insert({
        ...selection,
        timestamp,
        time_type: 'CLOSE'
      })
    }

    return {
      source_selection_id,
      new_selection: true,
      metric_line_changed: false,
      selection_name_changed: false,
      odds_change_amount: 0
    }
  }

  if (!existing_market) {
    return save_new_selection()
  }

  const existing_selection = await db('prop_market_selections_history')
    .where({
      source_id: existing_market.source_id,
      source_market_id: existing_market.source_market_id,
      source_selection_id: selection.source_selection_id
    })
    .orderBy('timestamp', 'desc')
    .first()

  if (!existing_selection) {
    return save_new_selection()
  }

  delete existing_selection.timestamp
  const differences = diff(existing_selection, selection)

  let odds_change_amount = 0
  let selection_name_changed = false
  let metric_line_changed = false

  if (differences && differences.length) {
    const update_on_change = [
      'selection_name',
      'selection_metric_line',
      'odds_american'
    ]
    const should_update = differences.some((difference) =>
      update_on_change.includes(difference.path[0])
    )

    if (should_update) {
      const {
        source_id,
        source_market_id,
        source_selection_id,
        selection_name,
        selection_metric_line,
        odds_decimal,
        odds_american
      } = selection
      await db('prop_market_selections_history')
        .insert({
          timestamp,
          source_id,
          source_market_id,
          source_selection_id,
          selection_name,
          selection_metric_line,
          odds_decimal,
          odds_american
        })
        .onConflict()
        .merge()

      differences.forEach((difference) => {
        if (difference.path[0] === 'selection_name') {
          selection_name_changed = true
        } else if (difference.path[0] === 'selection_metric_line') {
          metric_line_changed = true
        } else if (difference.path[0] === 'odds_american') {
          odds_change_amount = difference.rhs - difference.lhs
        }
      })
    }
  }

  if (!market.live) {
    await db('prop_market_selections_index')
      .insert({
        ...selection,
        timestamp,
        time_type: 'CLOSE'
      })
      .onConflict()
      .merge()
  }

  return {
    source_selection_id: selection.source_selection_id,
    new_selection: false,
    odds_change_amount,
    selection_name_changed,
    metric_line_changed
  }
}

export default async function ({
  timestamp,
  selections,
  existing_market,
  market
}) {
  const results = []
  for (const selection of selections) {
    try {
      const result = await insert_market_selection({
        timestamp,
        selection,
        existing_market,
        market
      })
      results.push(result)

      if (!market.live) {
        // remove any missing selections from `prop_market_selections_index`
        const existing_selections = await db('prop_market_selections_index')
          .where({
            source_market_id: existing_market.source_market_id,
            time_type: 'CLOSE'
          })
          .select('source_selection_id')

        const existing_selection_ids = existing_selections.map(
          (selection) => selection.source_selection_id
        )
        const new_selection_ids = selections.map((selection) =>
          selection.source_selection_id.toString()
        )
        const missing_selection_ids = existing_selection_ids.filter(
          (id) => !new_selection_ids.includes(id)
        )
        await db('prop_market_selections_index')
          .where({
            source_market_id: existing_market.source_market_id,
            time_type: 'CLOSE'
          })
          .whereIn('source_selection_id', missing_selection_ids)
          .del()
      }
    } catch (err) {
      log(selection)
      console.log(err)
      log(err)
    }
  }
  return results
}
