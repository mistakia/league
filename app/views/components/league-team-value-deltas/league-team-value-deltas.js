import React, { useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import LeagueTeamValueOverTime from '@components/league-team-value-over-time'

import './league-team-value-deltas.styl'

function formatTimeShorthand(days) {
  if (days >= 365) {
    return `${Math.floor(days / 365)}Y`
  } else if (days >= 30) {
    return `${Math.floor(days / 30)}M`
  } else {
    return `${days}D`
  }
}

export default function LeagueTeamValueDeltas({
  team_value_deltas,
  load_league_team_daily_values,
  tid
}) {
  useEffect(() => {
    load_league_team_daily_values()
  }, [])

  if (!team_value_deltas) return null
  const delta_items = []
  const deltas = team_value_deltas.get('deltas', [])
  deltas.forEach((delta, i) => {
    const { days, delta_pct, delta_dollar_amount } = delta
    const pct = (delta_pct * 100).toFixed(2)
    const dollar_amount_abs = Math.abs(delta_dollar_amount).toFixed(2)

    const is_negative = delta_dollar_amount < 0

    const background_intensity = Math.min(
      Math.abs(delta_dollar_amount) / 30,
      0.2
    )
    const background = is_negative
      ? `rgba(255, 80, 0, ${background_intensity})`
      : `rgba(0, 200, 5, ${background_intensity})`
    const color =
      delta_dollar_amount > 0 ? 'rgba(0, 200, 5, 1)' : 'rgba(255, 80, 0, 1)'
    const style = { background, color }

    delta_items.push(
      <div key={i} className='league__team-value-deltas-item' style={style}>
        <div className='deltas-item-time'>{formatTimeShorthand(days)}</div>
        <div className='deltas-item-amount'>
          {is_negative ? '-' : ''}${dollar_amount_abs}
        </div>
        <div className='deltas-item-pct'>{pct}%</div>
      </div>
    )
  })

  return (
    <div className='league__team-value-deltas'>
      <LeagueTeamValueOverTime tid={tid} />
      {delta_items}
    </div>
  )
}

LeagueTeamValueDeltas.propTypes = {
  team_value_deltas: ImmutablePropTypes.map,
  load_league_team_daily_values: PropTypes.func,
  tid: PropTypes.number
}
