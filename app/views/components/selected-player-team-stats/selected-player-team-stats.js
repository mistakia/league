import React from 'react'

import PlayerRowMetric from '@components/player-row-metric'

export default class SelectedPlayerTeamStats extends React.Component {
  render = () => {
    const { player, stats } = this.props

    const teamStats = stats.teamStats.filter(t => t.tname === player.team)
    const sorted = teamStats.sort((a, b) => b.seas - a.seas)
    const items = []
    for (const [index, year] of sorted.entries()) {
      const overall = stats.overallTeams[year.seas] || {}
      items.push(
        <div key={index} className='player__selected-row'>
          <div className='row__name'>
            {year.seas}
          </div>
          <PlayerRowMetric className='row__single-metric' stats={year} overall={overall} type='drv' />
          <PlayerRowMetric className='row__single-metric' stats={year} overall={overall} type='snpo' />
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='pa' />
              <PlayerRowMetric stats={year} overall={overall} type='py' />
              <PlayerRowMetric stats={year} overall={overall} type='tdp' />
              <PlayerRowMetric stats={year} overall={overall} type='pfd' />
              <PlayerRowMetric stats={year} overall={overall} type='spp' />
              <PlayerRowMetric stats={year} overall={overall} type='rzpa' />
              <PlayerRowMetric stats={year} overall={overall} type='rzpy' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='ra' />
              <PlayerRowMetric stats={year} overall={overall} type='ry' />
              <PlayerRowMetric stats={year} overall={overall} type='tdr' />
              <PlayerRowMetric stats={year} overall={overall} type='rfd' />
              <PlayerRowMetric stats={year} overall={overall} type='srp' />
              <PlayerRowMetric stats={year} overall={overall} type='rzra' />
              <PlayerRowMetric stats={year} overall={overall} type='rzry' />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            Team Season Volume Splits
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          <div className='row__single-metric'>DRV</div>
          <div className='row__single-metric'>SNP</div>
          <div className='row__group'>
            <div className='row__group-head'>Passing Volume</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>ATT</div>
              <div className='player__row-metric'>YDS</div>
              <div className='player__row-metric'>TD</div>
              <div className='player__row-metric'>FD</div>
              <div className='player__row-metric'>SUCC</div>
              <div className='player__row-metric'>RZATT</div>
              <div className='player__row-metric'>RZYDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Rushing Volume</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>ATT</div>
              <div className='player__row-metric'>YDS</div>
              <div className='player__row-metric'>TD</div>
              <div className='player__row-metric'>FD</div>
              <div className='player__row-metric'>SUCC</div>
              <div className='player__row-metric'>RZATT</div>
              <div className='player__row-metric'>RZYDS</div>
            </div>
          </div>
        </div>
        {items}
      </div>
    )
  }
}
