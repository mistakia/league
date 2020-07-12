import React from 'react'

import PlayerSelectedRow from '@components/player-selected-row'

export default class SelectedPlayerSeasonStats extends React.Component {
  render = () => {
    const { stats } = this.props
    const years = []
    for (const year in stats.overall) {
      const games = Object.keys(stats.years[year]).length
      const p = stats.overall[year]
      const item = (
        <PlayerSelectedRow games={games} key={year} title={year} stats={p} />
      )
      years.push(item)
      // TODO year average
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            Player Season Stats
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          <div className='row__single-metric'>G</div>
          <div className='row__group'>
            <div className='row__group-head'>Passing</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>YDS</div>
              <div className='player__row-metric'>TD</div>
              <div className='player__row-metric'>INT</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Rushing</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>CAR</div>
              <div className='player__row-metric'>YDS</div>
              <div className='player__row-metric'>TD</div>
              <div className='player__row-metric'>FUM</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Receiving</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>TAR</div>
              <div className='player__row-metric'>REC</div>
              <div className='player__row-metric'>YDS</div>
              <div className='player__row-metric'>TD</div>
            </div>
          </div>
        </div>
        {years}
      </div>
    )
  }
}
