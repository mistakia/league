import db from '#db'

export default async function format_market_selection_id({
  source_id,
  source_market_id,
  source_selection_id
}) {
  const prop_market_selection_row = await db('prop_market_selections_index')
    .join('prop_markets_index', function () {
      this.on(
        'prop_market_selections_index.source_market_id',
        '=',
        'prop_markets_index.source_market_id'
      )
      this.andOn(
        'prop_market_selections_index.source_id',
        '=',
        'prop_markets_index.source_id'
      )
    })
    .where(
      'prop_market_selections_index.source_selection_id',
      source_selection_id
    )
    .where('prop_market_selections_index.source_id', source_id)
    .where('prop_market_selections_index.source_market_id', source_market_id)
    .select(
      'prop_market_selections_index.selection_pid',
      'prop_market_selections_index.selection_name',
      'prop_market_selections_index.selection_metric_line',
      'prop_market_selections_index.selection_type',
      'prop_markets_index.market_type',
      'prop_markets_index.source_event_id',
      'prop_markets_index.esbid',
      'prop_markets_index.year'
    )
    .first()

  if (!prop_market_selection_row) {
    return `/${source_id}/${source_market_id}/${source_selection_id}`
  }

  const {
    year,
    esbid,
    market_type,
    selection_pid,
    selection_type,
    selection_metric_line
  } = prop_market_selection_row

  let selection_id = `/${year}/${market_type}`

  if (esbid) {
    selection_id += `${esbid}/`
  }

  if (selection_pid) {
    selection_id += `${selection_pid}/`
  }

  if (selection_type) {
    selection_id += `${selection_type}/`
  }

  if (selection_metric_line) {
    selection_id += `${selection_metric_line}`
  }

  return selection_id
}
