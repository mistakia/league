import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { fixTeam } from '@common'
import PercentileMetric from '@components/percentile-metric'

export default class SelectedPlayerTeamSituationSplits extends React.Component {
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
          <Stat stat_key='q1p' />
          <Stat stat_key='q2p' />
          <Stat stat_key='q3p' />
          <Stat stat_key='q4p' />
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='q1ra' />
              <Stat stat_key='q1pa' />
              <Stat stat_key='q1ry' />
              <Stat stat_key='q1py' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='lcra' />
              <Stat stat_key='lcpa' />
              <Stat stat_key='lcry' />
              <Stat stat_key='lcpy' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='pap' />
              <Stat stat_key='papy' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <Stat stat_key='sga' />
              <Stat stat_key='sgy' />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__table-header'>
          <div className='row__group-head'>Team Season Situation Splits</div>
        </div>
        <div className='selected__table-header'>
          <div className='table__cell text'>Year</div>
          <div className='table__cell metric row__single-metric'>Q1P</div>
          <div className='table__cell metric row__single-metric'>Q2P</div>
          <div className='table__cell metric row__single-metric'>Q3P</div>
          <div className='table__cell metric row__single-metric'>Q4P</div>
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

SelectedPlayerTeamSituationSplits.propTypes = {
  team: PropTypes.string,
  stats: ImmutablePropTypes.record
}
