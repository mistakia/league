import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { fixTeam } from '@libs-shared'
import PercentileMetric from '@components/percentile-metric'

export default class SelectedPlayerTeamPositionSplits extends React.Component {
  render = () => {
    const { team, stats } = this.props

    const teamStats = stats.teamStats.filter((t) => fixTeam(t.tname) === team)
    const sorted = teamStats.sort((a, b) => b.year - a.year)
    const items = []
    for (const [index, seasonlog] of sorted.entries()) {
      const percentiles = stats.teamStatsPercentiles[seasonlog.year] || {}

      const running_back_stat_keys = ['rba', 'rby']
      const running_back_stat_items = running_back_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      const wide_receiver_1_stat_keys = ['wr1a', 'wr1y']
      const wide_receiver_1_stat_items = wide_receiver_1_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      const wide_receiver_3_stat_keys = ['wr3a', 'wr3y']
      const wide_receiver_3_stat_items = wide_receiver_3_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      const tight_end_stat_keys = ['tea', 'tey']
      const tight_end_stat_items = tight_end_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      const quarterback_stat_keys = ['qba', 'qby']
      const quarterback_stat_items = quarterback_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      items.push(
        <div key={index} className='player__selected-row'>
          <div className='table__cell text'>{seasonlog.year}</div>
          <div className='row__group'>
            <div className='row__group-body'>{running_back_stat_items}</div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>{wide_receiver_1_stat_items}</div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>{wide_receiver_3_stat_items}</div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>{tight_end_stat_items}</div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>{quarterback_stat_items}</div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__table-header'>
          <div className='row__group-head'>Team Season Position Splits</div>
        </div>
        <div className='selected__table-header'>
          <div className='table__cell text'>Year</div>
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

SelectedPlayerTeamPositionSplits.propTypes = {
  team: PropTypes.string,
  stats: ImmutablePropTypes.record
}
