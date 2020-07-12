import React from 'react'

import PlayerRowMetric from '@components/player-row-metric'

export default class SelectedPlayerTeamPositionSplits extends React.Component {
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
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='rba' />
              <PlayerRowMetric stats={year} overall={overall} type='rby' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='wr1a' />
              <PlayerRowMetric stats={year} overall={overall} type='wr1y' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='wr3a' />
              <PlayerRowMetric stats={year} overall={overall} type='wr3y' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='tea' />
              <PlayerRowMetric stats={year} overall={overall} type='tey' />
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-body'>
              <PlayerRowMetric stats={year} overall={overall} type='qba' />
              <PlayerRowMetric stats={year} overall={overall} type='qby' />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            Team Season Position Splits
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          <div className='row__group'>
            <div className='row__group-head'>RB Receiving</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>TRG</div>
              <div className='player__row-metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>WR1/2 Receiving</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>TRG</div>
              <div className='player__row-metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>WR3+ Receiving</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>TRG</div>
              <div className='player__row-metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>TE Receiving</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>TRG</div>
              <div className='player__row-metric'>YDS</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>QB Rushing</div>
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
