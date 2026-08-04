// Decimal places for a column instance, given the params that instance carries.
//
// The same measure renders differently depending on how it aggregates: a
// `count` output is a whole number of games or seasons, a `rate` output is
// fractional regardless of whether the underlying season total is an integer,
// and a column with no output keeps whatever its definition declares. Because
// this varies per instance and not per column id, the field definitions pass
// the returned function as `fixed` and react-table resolves it against each
// selected column's params.

const COUNT_FIXED = 0
const RATE_FIXED = 2

export const resolve_column_fixed = ({ default_fixed = null } = {}) => {
  const resolve = (params = {}) => {
    const aggregation = params?.output?.aggregation
    if (aggregation === 'count') return COUNT_FIXED
    if (aggregation === 'rate') return RATE_FIXED
    return default_fixed
  }
  return resolve
}

export default resolve_column_fixed
