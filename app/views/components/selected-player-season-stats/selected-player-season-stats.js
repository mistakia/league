import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

export default class SelectedPlayerSeasonStats extends React.Component {
  componentDidMount = () => {
    const pid = this.props.playerMap.get('pid')
    const position = this.props.playerMap.get('pos')
    this.props.load({ pid, position })
  }

  render = () => {
    const { stats, pos } = this.props
    const items = []

    const years = Object.keys(stats.overall).sort((a, b) => b - a)
    years.forEach((year, index) => {
      const games = Object.keys(stats.years[year]).length
      const p = stats.overall[year]
      const item = (
        <PlayerSelectedRow
          games={games}
          key={index}
          title={year}
          stats={p}
          pos={pos}
        />
      )
      items.push(item)
      // TODO year average
    })

    return (
      <div className='selected__section'>
        <div className='selected__table-header sticky__column'>
          <div className='row__group-head'>Regular Seasons</div>
        </div>
        <div className='selected__table-header'>
          <div className='table__cell text'>Year</div>
          <div className='table__cell metric'>G</div>
          <PlayerSelectedRowHeader pos={pos} />
        </div>
        {items}
      </div>
    )
  }
}

SelectedPlayerSeasonStats.propTypes = {
  stats: PropTypes.object,
  pos: PropTypes.string,
  playerMap: ImmutablePropTypes.map,
  load: PropTypes.func
}
