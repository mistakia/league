import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { fixTeam } from '@common'
import PercentileMetric from '@components/percentile-metric'

export default class SelectedPlayerTeamPositionSplits extends React.Component {
  render = () => {
    const { team, stats } = this.props

    const teamStats = stats.teamStats.filter((t) => fixTeam(t.tname) === team)
    const sorted = teamStats.sort((a, b) => b.year - a.year)
    const items = []
    for (const [index, seasonlog] of sorted.entries()) {
      const percentiles = stats.teamStatsPercentiles[seasonlog.year] || {}
      const Stat = ({ stat_key, ...params }) => (
        <PercentileMetric
          value={seasonlog[stat_key]}
          percentile={percentiles[stat_key]}
          {...params}
        />
      )

      items.push(
        <div key={index} className='player__selected-row'>
          <div className='table__cell text'>{seasonlog.year}</div>
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='rba' />
              <Stat stat_key='rby' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='wr1a' />
              <Stat stat_key='wr1y' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='wr3a' />
              <Stat stat_key='wr3y' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='tea' />
              <Stat stat_key='tey' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='qba' />
              <Stat stat_key='qby' />
            </div>
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
