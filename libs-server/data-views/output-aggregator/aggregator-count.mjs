// `count of periods clearing a threshold`, which is the per-period family's
// law at the counting scope: count the periods where the combine of that
// period clears the threshold. Every mechanic is shared with `mean` -- see
// per-period-aggregator.mjs, which is where the two are one factory rather
// than two implementations kept in agreement.
import { create_per_period_aggregator } from './per-period-aggregator.mjs'

const aggregator = create_per_period_aggregator({
  aggregation: 'count',
  requires_threshold: true
})

export const {
  consumes_params,
  get_cte_name,
  add_cte,
  join_cte,
  emit_outer_select
} = aggregator

export default aggregator
