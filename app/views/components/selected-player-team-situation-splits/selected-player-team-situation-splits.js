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

      const quarter_points_stat_keys = ['q1p', 'q2p', 'q3p', 'q4p']
      const quarter_points_stat_items = quarter_points_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      const first_quarter_stat_keys = ['q1ra', 'q1pa', 'q1ry', 'q1py']
      const first_quarter_stat_items = first_quarter_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      const late_close_stat_keys = ['lcra', 'lcpa', 'lcry', 'lcpy']
      const late_close_stat_items = late_close_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      const play_action_stat_keys = ['pap', 'papy']
      const play_action_stat_items = play_action_stat_keys.map(
        (stat_key, index) => (
          <PercentileMetric
            key={index}
            value={seasonlog[stat_key]}
            percentile={percentiles[stat_key]}
          />
        )
      )

      const shotgun_stat_keys = ['sga', 'sgy']
      const shotgun_stat_items = shotgun_stat_keys.map((stat_key, index) => (
        <PercentileMetric
          key={index}
          value={seasonlog[stat_key]}
          percentile={percentiles[stat_key]}
        />
      ))

      items.push(
        <div key={index} className='player__selected-row'>
          <div className='table__cell text'>{seasonlog.year}</div>
          {quarter_points_stat_items}
          <div className='row__group'>
            <div className='row__group-body'>{first_quarter_stat_items}</div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>{late_close_stat_items}</div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>{play_action_stat_items}</div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>{shotgun_stat_items}</div>
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
