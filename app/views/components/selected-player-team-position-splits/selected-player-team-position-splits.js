import React from 'react'

import PercentileMetric from '@components/percentile-metric'

export default class SelectedPlayerTeamPositionSplits extends React.Component {
  render = () => {
    const { player, stats } = this.props

    const teamStats = stats.teamStats.filter((t) => t.tname === player.team)
    const sorted = teamStats.sort((a, b) => b.seas - a.seas)
    const items = []
    for (const [index, year] of sorted.entries()) {
      const percentiles = stats.teamStatsPercentiles[year.seas] || {}
      items.push(
        <div key={index} className='player__selected-row'>
          <div className='row__name'>{year.seas}</div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='rba'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='rby'
              />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='wr1a'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='wr1y'
              />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='wr3a'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='wr3y'
              />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='tea'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='tey'
              />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='qba'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                type='qby'
              />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>Team Season Position Splits</div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          <div className='row__group'>
            <div className='row__group-head'>RB Receiving</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>TRG</div>
              <div className='table__cell metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>WR1/2 Receiving</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>TRG</div>
              <div className='table__cell metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>WR3+ Receiving</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>TRG</div>
              <div className='table__cell metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>TE Receiving</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>TRG</div>
              <div className='table__cell metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>QB Rushing</div>
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
