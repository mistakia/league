import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { fixTeam } from '@common'
import PercentileMetric from '@components/percentile-metric'

export default class SelectedPlayerTeamStats extends React.Component {
  render = () => {
    const { team, stats } = this.props

    const teamStats = stats.teamStats.filter((t) => fixTeam(t.tname) === team)
    const sorted = teamStats.sort((a, b) => b.seas - a.seas)
    const items = []
    for (const [index, year] of sorted.entries()) {
      const percentiles = stats.teamStatsPercentiles[year.seas] || {}
      items.push(
        <div key={index} className='player__selected-row'>
          <div className='row__name'>{year.seas}</div>
          <PercentileMetric
            className='row__single-metric'
            stats={year}
            percentiles={percentiles}
            fixed={0}
            type='drv'
          />
          <PercentileMetric
            className='row__single-metric'
            stats={year}
            percentiles={percentiles}
            fixed={0}
            type='snpo'
          />
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='pa'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='py'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='tdp'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='pfd'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='spp'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='rzpa'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='rzpy'
              />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='ra'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='ry'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='tdr'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='rfd'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='srp'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='rzra'
              />
              <PercentileMetric
                stats={year}
                percentiles={percentiles}
                fixed={0}
                type='rzry'
              />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>Team Season Volume Splits</div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          <div className='table__cell metric row__single-metric'>DRV</div>
          <div className='table__cell metric row__single-metric'>SNP</div>
          <div className='row__group'>
            <div className='row__group-head'>Passing Volume</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>ATT</div>
              <div className='table__cell metric'>YDS</div>
              <div className='table__cell metric'>TD</div>
              <div className='table__cell metric'>FD</div>
              <div className='table__cell metric'>SUCC</div>
              <div className='table__cell metric'>RZATT</div>
              <div className='table__cell metric'>RZYDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Rushing Volume</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>ATT</div>
              <div className='table__cell metric'>YDS</div>
              <div className='table__cell metric'>TD</div>
              <div className='table__cell metric'>FD</div>
              <div className='table__cell metric'>SUCC</div>
              <div className='table__cell metric'>RZATT</div>
              <div className='table__cell metric'>RZYDS</div>
            </div>
          </div>
        </div>
        {items}
      </div>
    )
  }
}

SelectedPlayerTeamStats.propTypes = {
  stats: ImmutablePropTypes.record,
  team: PropTypes.string
}
