import React from 'react'

import PercentileMetric from '@components/percentile-metric'
import { constants } from '@common'

export default class SelectedPlayerEfficiencyStats extends React.Component {
  render = () => {
    const { player, percentiles } = this.props
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
          {player.pos === 'QB' &&
            <div className='row__group'>
              <div className='row__group-head'>Passing Efficiency</div>
              <div className='row__group-body'>
                <div className='table__cell metric'>COMP%</div>
                <div className='table__cell metric'>TD%</div>
                <div className='table__cell metric'>INT%</div>
                <div className='table__cell metric'>INTW%</div>
              </div>
            </div>}
          {player.pos === 'QB' &&
            <div className='row__group'>
              <div className='row__group-head'>Passing Efficiency</div>
              <div className='row__group-body'>
                <div className='table__cell metric'>YAC</div>
                <div className='table__cell metric'>YAC/C</div>
                <div className='table__cell metric'>YPA</div>
                <div className='table__cell metric'>DOT</div>
              </div>
            </div>}
          {player.pos === 'QB' &&
            <div className='row__group'>
              <div className='row__group-head'>Passing Air Yards</div>
              <div className='row__group-body'>
                <div className='table__cell metric'>AY</div>
                <div className='table__cell metric'>AYPA</div>
                <div className='table__cell metric'>CAY/C</div>
                <div className='table__cell metric'>PACR</div>
              </div>
            </div>}
          {['QB', 'RB'].includes(player.pos) &&
            <div className='row__group'>
              <div className='row__group-head'>Rushing Efficiency</div>
              <div className='row__group-body'>
                <div className='table__cell metric'>YPC</div>
                <div className='table__cell metric'>ATT%</div>
                <div className='table__cell metric'>YDS%</div>
                <div className='table__cell metric'>BT</div>
                <div className='table__cell metric'>BT%</div>
              </div>
            </div>}
          {['RB', 'WR', 'TE'].includes(player.pos) &&
            <div className='row__group'>
              <div className='row__group-head'>Receiving Efficiency</div>
              <div className='row__group-body'>
                <div className='table__cell metric'>AY/TAR</div>
                <div className='table__cell metric'>YDS/AY</div>
                <div className='table__cell metric'>YDS/REC</div>
                <div className='table__cell metric'>YDS/TAR</div>
                <div className='table__cell metric'>YAC/REC</div>
              </div>
            </div>}
          {['RB', 'WR', 'TE'].includes(player.pos) &&
            <div className='row__group'>
              <div className='row__group-head'>Receiving Opportunity</div>
              <div className='row__group-body'>
                <div className='table__cell metric'>AY%</div>
                <div className='table__cell metric'>TAR%</div>
                <div className='table__cell metric'>WOPR</div>
                <div className='table__cell metric'>ADOT</div>
                <div className='table__cell metric'>DEEP%</div>
              </div>
            </div>}
        </div>
        <div className='player__selected-row'>
          <div className='row__name'>
            {constants.season.week ? constants.season.year : (constants.season.year - 1)}
          </div>
          {player.pos === 'QB' &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PercentileMetric stats={stats} percentiles={percentiles} type='pc_pct' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='tdp_pct' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='ints_pct' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='intw_pct' />
              </div>
            </div>}
          {player.pos === 'QB' &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PercentileMetric stats={stats} percentiles={percentiles} type='pyac' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='pyac_pc' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_ypa' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='pdot_pa' />
              </div>
            </div>}
          {player.pos === 'QB' &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PercentileMetric stats={stats} percentiles={percentiles} type='pdot' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='pcay_pc' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_aypa' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_pacr' />
              </div>
            </div>}
          {['QB', 'RB'].includes(player.pos) &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PercentileMetric stats={stats} percentiles={percentiles} type='ry_pra' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_stra' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_stry' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='mbt' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='mbt_pt' />
              </div>
            </div>}
          {['RB', 'WR', 'TE'].includes(player.pos) &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PercentileMetric stats={stats} percentiles={percentiles} type='_ayptrg' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_recypay' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_recyprec' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_recyptrg' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_ryacprec' />
              </div>
            </div>}
          {['RB', 'WR', 'TE'].includes(player.pos) &&
            <div className='row__group'>
              <div className='row__group-body'>
                <PercentileMetric stats={stats} percentiles={percentiles} type='_stray' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_sttrg' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='_wopr' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='rdot_ptrg' />
                <PercentileMetric stats={stats} percentiles={percentiles} type='dptrg_pct' />
              </div>
            </div>}
        </div>
      </div>
    )
  }
}
