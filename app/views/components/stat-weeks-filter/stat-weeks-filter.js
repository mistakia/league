import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import StatFilter from '@components/stat-filter'
import { current_season } from '@constants'
import {
  get_nfl_week_identifiers_for_year,
  parse_nfl_week_identifier,
  get_postseason_week_label
} from '@libs-shared/nfl-week-identifier.mjs'

const default_year = current_season.week
  ? current_season.year
  : current_season.year - 1

const parse_id = (id) => {
  const parsed = parse_nfl_week_identifier({ identifier: id })
  if (!parsed) return null
  const label =
    parsed.seas_type === 'POST'
      ? `${parsed.seas_type} ${get_postseason_week_label({ week: parsed.week })}`
      : `${parsed.seas_type} ${parsed.week}`
  return { id, label }
}

const REG_PARSED = get_nfl_week_identifiers_for_year({
  year: default_year,
  seas_type: 'REG'
})
  .map(parse_id)
  .filter(Boolean)
const POST_PARSED = get_nfl_week_identifiers_for_year({
  year: default_year,
  seas_type: 'POST'
})
  .map(parse_id)
  .filter(Boolean)

export default class StatWeeksFilter extends React.Component {
  render = () => {
    const values = [...REG_PARSED, ...POST_PARSED].map(({ id, label }) => ({
      label,
      value: id,
      selected: this.props.week.has(id)
    }))

    return <StatFilter type='weeks' label='WEEKS' values={values} />
  }
}

StatWeeksFilter.propTypes = {
  week: ImmutablePropTypes.set
}
