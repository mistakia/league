import React from 'react'

import PercentileMetric from '@components/percentile-metric'

export default class SelectedPlayerTeamSituationSplits extends React.Component {
  render = () => {
    const { player, stats } = this.props

    const teamStats = stats.teamStats.filter(t => t.tname === player.team)
    const sorted = teamStats.sort((a, b) => b.seas - a.seas)
    const items = []
    for (const [index, year] of sorted.entries()) {
      const percentiles = stats.teamStatsPercentiles[year.seas] || {}
      items.push(
        <div key={index} className='player__selected-row'>
          <div className='row__name'>
            {year.seas}
          </div>
          <PercentileMetric className='row__single-metric' stats={year} percentiles={percentiles} type='q1p' />
          <PercentileMetric className='row__single-metric' stats={year} percentiles={percentiles} type='q2p' />
          <PercentileMetric className='row__single-metric' stats={year} percentiles={percentiles} type='q3p' />
          <PercentileMetric className='row__single-metric' stats={year} percentiles={percentiles} type='q4p' />
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric stats={year} percentiles={percentiles} type='q1ra' />
              <PercentileMetric stats={year} percentiles={percentiles} type='q1pa' />
              <PercentileMetric stats={year} percentiles={percentiles} type='q1ry' />
              <PercentileMetric stats={year} percentiles={percentiles} type='q1py' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric stats={year} percentiles={percentiles} type='lcra' />
              <PercentileMetric stats={year} percentiles={percentiles} type='lcpa' />
              <PercentileMetric stats={year} percentiles={percentiles} type='lcry' />
              <PercentileMetric stats={year} percentiles={percentiles} type='lcpy' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric stats={year} percentiles={percentiles} type='pap' />
              <PercentileMetric stats={year} percentiles={percentiles} type='papy' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric stats={year} percentiles={percentiles} type='sga' />
              <PercentileMetric stats={year} percentiles={percentiles} type='sgy' />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            Team Season Situation Splits
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          <div className='row__single-metric'>Q1P</div>
          <div className='row__single-metric'>Q2P</div>
          <div className='row__single-metric'>Q3P</div>
          <div className='row__single-metric'>Q4P</div>
          <div className='row__group'>
            <div className='row__group-head'>Quarter 1 Splits</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>RA</div>
              <div className='table__cell metric'>PA</div>
              <div className='table__cell metric'>RY</div>
              <div className='table__cell metric'>PY</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Late/Close Splits</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>RA</div>
              <div className='table__cell metric'>PA</div>
              <div className='table__cell metric'>RY</div>
              <div className='table__cell metric'>PY</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Play Action</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>ATT</div>
              <div className='table__cell metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Shotgun</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>ATT</div>
              <div className='table__cell metric'>YDS</div>
            </div>
          </div>
        </div>
        {items}
      </div>
    )
  }
}
