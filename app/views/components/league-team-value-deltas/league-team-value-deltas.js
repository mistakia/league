import React, { useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import LeagueTeamValueOverTime from '@components/league-team-value-over-time'

import './league-team-value-deltas.styl'

const placeholder_deltas = [
  { days: 7, label: '7D' },
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
  { days: 365, label: '1Y' },
  { days: 730, label: '2Y' }
]

export default function LeagueTeamValueDeltas({
  team_value_deltas,
  load_league_team_daily_values,
  tid
}) {
  useEffect(() => {
    load_league_team_daily_values()
  }, [load_league_team_daily_values])

  const deltas = team_value_deltas ? team_value_deltas.get('deltas', []) : []

  const delta_items = placeholder_deltas.map(({ days, label }) => {
    const delta = deltas.find((d) => d.days === days)

    if (delta) {
      const { delta_pct, delta_dollar_amount } = delta
      const pct = (delta_pct * 100).toFixed(2)
      // const dollar_amount_abs = Math.abs(delta_dollar_amount).toFixed(2)
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

      return (
        <div
          key={days}
          className='league__team-value-deltas-item'
          style={style}
        >
          <div className='deltas-item-time'>{label}</div>
          <div className='deltas-item-pct'>{pct}%</div>
          {/* <div className='deltas-item-amount'>
            {is_negative ? '-' : ''}${dollar_amount_abs}
          </div> */}
        </div>
      )
    } else {
      return (
        <div key={days} className='league__team-value-deltas-item placeholder'>
          <div className='deltas-item-time'>{label}</div>
          <div className='deltas-item-pct'>-- %</div>
          {/* <div className='deltas-item-amount' /> */}
        </div>
      )
    }
  })

  return (
    <div className='league__team-value-deltas'>
      <LeagueTeamValueOverTime tid={tid} />
      <div className='league__team-value-deltas-items'>{delta_items}</div>
    </div>
  )
}

LeagueTeamValueDeltas.propTypes = {
  team_value_deltas: ImmutablePropTypes.map,
  load_league_team_daily_values: PropTypes.func,
  tid: PropTypes.number
}
