import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { fixTeam } from '@libs-shared'
import PercentileMetric from '@components/percentile-metric'

export default class SelectedPlayerTeamStats extends React.Component {
  render = () => {
    const { team, stats } = this.props

    const teamStats = stats.teamStats.filter((t) => fixTeam(t.tname) === team)
    const sorted = teamStats.sort((a, b) => b.year - a.year)
    const items = []
    for (const [index, seasonlog] of sorted.entries()) {
      const percentiles = stats.teamStatsPercentiles[seasonlog.year] || {}

      const passing_stat_keys = [
        'pa',
        'py',
        'tdp',
        'pfd',
        'spp',
        'rzpa',
        'rzpy'
      ]
      const passing_stat_items = passing_stat_keys.map((stat_key, index) => (
        <PercentileMetric
          key={index}
          value={seasonlog[stat_key]}
          percentile={percentiles[stat_key]}
        />
      ))

      const rushing_stat_keys = [
        'ra',
        'ry',
        'tdr',
        'rfd',
        'srp',
        'rzra',
        'rzry'
      ]
      const rushing_stat_items = rushing_stat_keys.map((stat_key, index) => (
        <PercentileMetric
          key={index}
          value={seasonlog[stat_key]}
          percentile={percentiles[stat_key]}
        />
      ))

      items.push(
        <div key={index} className='player__selected-row'>
          <div className='table__cell text'>{seasonlog.year}</div>
          <PercentileMetric
            value={seasonlog.drv}
            percentile={percentiles.drv}
            className='row__single-metric'
          />
          <PercentileMetric
            value={seasonlog.snpo}
            percentile={percentiles.snpo}
            className='row__single-metric'
          />
          <div className='row__group'>
            <div className='row__group-body'>{passing_stat_items}</div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>{rushing_stat_items}</div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__table-header'>
          <div className='row__group-head'>Team Season Volume Splits</div>
        </div>
        <div className='selected__table-header'>
          <div className='table__cell text'>Year</div>
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
