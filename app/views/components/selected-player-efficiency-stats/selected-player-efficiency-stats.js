import React from 'react'

import PlayerRowMetric from '@components/player-row-metric'
import { constants } from '@common'

export default class SelectedPlayerEfficiencyStats extends React.Component {
  render = () => {
    const { player, overall } = this.props
    const stats = player.stats.toJS()

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            Player Efficiency Stats
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Year</div>
          {player.pos1 === 'QB' &&
            <div className='row__group'>
              <div className='row__group-head'>Passing Efficiency</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>COMP%</div>
                <div className='player__row-metric'>TD%</div>
                <div className='player__row-metric'>INT%</div>
                <div className='player__row-metric'>INTW%</div>
              </div>
            </div>}
          {player.pos1 === 'QB' &&
            <div className='row__group'>
              <div className='row__group-head'>Passing Efficiency</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>YAC</div>
                <div className='player__row-metric'>YAC/C</div>
                <div className='player__row-metric'>YPA</div>
                <div className='player__row-metric'>DOT</div>
              </div>
            </div>}
          {player.pos1 === 'QB' &&
            <div className='row__group'>
              <div className='row__group-head'>Passing Air Yards</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>AY</div>
                <div className='player__row-metric'>AYPA</div>
                <div className='player__row-metric'>CAY/C</div>
                <div className='player__row-metric'>PACR</div>
              </div>
            </div>}
          {['QB', 'RB'].includes(player.pos1) &&
            <div className='row__group'>
              <div className='row__group-head'>Rushing Efficiency</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>YPC</div>
                <div className='player__row-metric'>ATT%</div>
                <div className='player__row-metric'>YDS%</div>
                <div className='player__row-metric'>BT</div>
                <div className='player__row-metric'>BT%</div>
              </div>
            </div>}
          {['RB', 'WR', 'TE'].includes(player.pos1) &&
            <div className='row__group'>
              <div className='row__group-head'>Receiving Efficiency</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>AY/TAR</div>
                <div className='player__row-metric'>YDS/AY</div>
                <div className='player__row-metric'>YDS/REC</div>
                <div className='player__row-metric'>YDS/TAR</div>
                <div className='player__row-metric'>YAC/REC</div>
              </div>
            </div>}
          {['RB', 'WR', 'TE'].includes(player.pos1) &&
            <div className='row__group'>
              <div className='row__group-head'>Receiving Opportunity</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>AY%</div>
                <div className='player__row-metric'>TAR%</div>
                <div className='player__row-metric'>WOPR</div>
                <div className='player__row-metric'>ADOT</div>
                <div className='player__row-metric'>DEEP%</div>
              </div>
            </div>}
        </div>
        <div className='player__selected-row'>
          <div className='row__name'>
            {constants.season.week ? constants.season.year : (constants.season.year - 1)}
          </div>
          {player.pos1 === 'QB' &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PlayerRowMetric stats={stats} overall={overall} type='pc_pct' />
                <PlayerRowMetric stats={stats} overall={overall} type='tdp_pct' />
                <PlayerRowMetric stats={stats} overall={overall} type='ints_pct' />
                <PlayerRowMetric stats={stats} overall={overall} type='intw_pct' />
              </div>
            </div>}
          {player.pos1 === 'QB' &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PlayerRowMetric stats={stats} overall={overall} type='pyac' />
                <PlayerRowMetric stats={stats} overall={overall} type='pyac_pc' />
                <PlayerRowMetric stats={stats} overall={overall} type='_ypa' />
                <PlayerRowMetric stats={stats} overall={overall} type='pdot_pa' />
              </div>
            </div>}
          {player.pos1 === 'QB' &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PlayerRowMetric stats={stats} overall={overall} type='pdot' />
                <PlayerRowMetric stats={stats} overall={overall} type='pcay_pc' />
                <PlayerRowMetric stats={stats} overall={overall} type='_aypa' />
                <PlayerRowMetric stats={stats} overall={overall} type='_pacr' />
              </div>
            </div>}
          {['QB', 'RB'].includes(player.pos1) &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PlayerRowMetric stats={stats} overall={overall} type='ry_pra' />
                <PlayerRowMetric stats={stats} overall={overall} type='_stra' />
                <PlayerRowMetric stats={stats} overall={overall} type='_stry' />
                <PlayerRowMetric stats={stats} overall={overall} type='mbt' />
                <PlayerRowMetric stats={stats} overall={overall} type='mbt_pt' />
              </div>
            </div>}
          {['RB', 'WR', 'TE'].includes(player.pos1) &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PlayerRowMetric stats={stats} overall={overall} type='_ayptrg' />
                <PlayerRowMetric stats={stats} overall={overall} type='_recypay' />
                <PlayerRowMetric stats={stats} overall={overall} type='_recyprec' />
                <PlayerRowMetric stats={stats} overall={overall} type='_recyptrg' />
                <PlayerRowMetric stats={stats} overall={overall} type='_ryacprec' />
              </div>
            </div>}
          {['RB', 'WR', 'TE'].includes(player.pos1) &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PlayerRowMetric stats={stats} overall={overall} type='_stray' />
                <PlayerRowMetric stats={stats} overall={overall} type='_sttrg' />
                <PlayerRowMetric stats={stats} overall={overall} type='_wopr' />
                <PlayerRowMetric stats={stats} overall={overall} type='rdot_ptrg' />
                <PlayerRowMetric stats={stats} overall={overall} type='dptrg_pct' />
              </div>
            </div>}
        </div>
      </div>
    )
  }
}
