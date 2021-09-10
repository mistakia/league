import React from 'react'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

export default class SelectedPlayerSeasonStats extends React.Component {
  render = () => {
    const { stats, pos } = this.props
    const years = []
    for (const year in stats.overall) {
      const games = Object.keys(stats.years[year]).length
      const p = stats.overall[year]
      const item = (
        <PlayerSelectedRow
          games={games}
          key={year}
          title={year}
          stats={p}
          pos={pos}
        />
      )
      years.push(item)
      // TODO year average
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>Seasons</div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          <div className='row__single-metric'>G</div>
          <PlayerSelectedRowHeader pos={pos} />
        </div>
        {years}
      </div>
    )
  }
}

SelectedPlayerSeasonStats.propTypes = {
  stats: PropTypes.object,
  pos: PropTypes.string
}
