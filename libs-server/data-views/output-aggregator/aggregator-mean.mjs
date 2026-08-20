// `mean per period`: the average, across periods, of the per-period value.
//
// MEAN IS NOT A SPELLING OF RATE and the two are deliberately both offered.
// `rate` divides by a DENOMINATOR UNIT -- `('game', 'rate')` divides by games
// PLAYED, read off `player_gamelogs where is_active` -- while `mean` divides by
// the periods that CARRY MEASURE ROWS. Measured on 2023 REG receiving yards,
// 366 of 482 players disagree between the two: Pickens is 67.059 as a rate and
// 71.250 as a mean, because a game he played and did not catch a pass in is in
// one denominator and not the other. An earlier draft of this design made them
// mutually exclusive on the premise that they coincide; that premise was false
// and the exclusion is void.
//
// It carries no threshold: a mean is a reduction over every period, where a
// count is a reduction over the periods a threshold selects.
import { create_per_period_aggregator } from './per-period-aggregator.mjs'

const aggregator = create_per_period_aggregator({
  aggregation: 'mean',
  requires_threshold: false
})

export const {
  consumes_params,
  get_cte_name,
  add_cte,
  join_cte,
  emit_outer_select
} = aggregator

export default aggregator
