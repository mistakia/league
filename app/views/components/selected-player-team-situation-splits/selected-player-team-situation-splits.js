import React from 'react'

import PlayerRowMetric from '@components/player-row-metric'

export default class SelectedPlayerTeamSituationSplits extends React.Component {
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
          <PlayerRowMetric className='row__single-metric' stats={year} overall={overall} type='q1p' />
          <PlayerRowMetric className='row__single-metric' stats={year} overall={overall} type='q2p' />
          <PlayerRowMetric className='row__single-metric' stats={year} overall={overall} type='q3p' />
          <PlayerRowMetric className='row__single-metric' stats={year} overall={overall} type='q4p' />
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='q1ra' />
              <PlayerRowMetric stats={year} overall={overall} type='q1pa' />
              <PlayerRowMetric stats={year} overall={overall} type='q1ry' />
              <PlayerRowMetric stats={year} overall={overall} type='q1py' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='lcra' />
              <PlayerRowMetric stats={year} overall={overall} type='lcpa' />
              <PlayerRowMetric stats={year} overall={overall} type='lcry' />
              <PlayerRowMetric stats={year} overall={overall} type='lcpy' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='pap' />
              <PlayerRowMetric stats={year} overall={overall} type='papy' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='sga' />
              <PlayerRowMetric stats={year} overall={overall} type='sgy' />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            Team Season Situation Splits
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          <div className='row__single-metric'>Q1P</div>
          <div className='row__single-metric'>Q2P</div>
          <div className='row__single-metric'>Q3P</div>
          <div className='row__single-metric'>Q4P</div>
          <div className='row__group'>
            <div className='row__group-head'>Quarter 1 Splits</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>RA</div>
              <div className='player__row-metric'>PA</div>
              <div className='player__row-metric'>RY</div>
              <div className='player__row-metric'>PY</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Late/Close Splits</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>RA</div>
              <div className='player__row-metric'>PA</div>
              <div className='player__row-metric'>RY</div>
              <div className='player__row-metric'>PY</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Play Action</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>ATT</div>
              <div className='player__row-metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Shotgun</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>ATT</div>
              <div className='player__row-metric'>YDS</div>
            </div>
          </div>
        </div>
        {items}
      </div>
    )
  }
}
