import React from 'react'

import PercentileChart from '@components/percentile-chart'

// TODO - pass epa per play
const passing = ({ stats, percentiles }) => (
  <div className='selected__section'>
    <div className='selected__section-header'>
      <div className='row__group-head'>Passing Efficiency</div>
    </div>
    <PercentileChart
      title='Comp %'
      stats={stats}
      percentiles={percentiles}
      type='pc_pct'
    />
    <PercentileChart
      title='TD %'
      stats={stats}
      percentiles={percentiles}
      type='tdp_pct'
    />
    <PercentileChart
      title='Int %'
      stats={stats}
      percentiles={percentiles}
      type='ints_pct'
    />
    <PercentileChart
      title='Int Worthy %'
      stats={stats}
      percentiles={percentiles}
      type='intw_pct'
    />
    <PercentileChart
      title='YPA'
      stats={stats}
      percentiles={percentiles}
      type='_ypa'
    />
    <PercentileChart
      title='aDOT'
      stats={stats}
      percentiles={percentiles}
      type='pdot_pa'
    />
  </div>
)

// TODO - rush epa per play
// TODO - true yards per carry
// TODO - yards per touch
// TOOD - breakaway run rate
// TODO - first down rate
const rushing = ({ stats, percentiles }) => (
  <div className='selected__section'>
    <div className='selected__section-header'>
      <div className='row__group-head'>Rushing Efficiency</div>
    </div>
    <PercentileChart
      title='Yards Per Carry'
      stats={stats}
      percentiles={percentiles}
      type='ry_pra'
    />
    <PercentileChart
      title='Yards Created Per Rush'
      stats={stats}
      percentiles={percentiles}
      type='ryaco_pra'
    />
    <PercentileChart
      title='Positive Rush Rate'
      stats={stats}
      percentiles={percentiles}
      type='posra'
    />
    <PercentileChart
      title='Successful Rush Rate'
      stats={stats}
      percentiles={percentiles}
      type='posra'
    />
    <PercentileChart
      title='Broken Tackles Per Touch'
      stats={stats}
      percentiles={percentiles}
      type='mbt_pt'
    />
    <PercentileChart
      title='Fumble Rate'
      stats={stats}
      percentiles={percentiles}
      type='_fumlpra'
    />
  </div>
)

// TODO - recv epa per play
// TODO - yards per route run
// TODO - catch rate
// TODO - true catch rate
// TODO - target seperation
// TODO - drop rate
// TODO - contested catch rate
// TODO - qb rating when targeted
// TODO - first down rate
const receiving = ({ stats, percentiles }) => (
  <div className='selected__section'>
    <div className='selected__section-header'>
      <div className='row__group-head'>Receiving Efficiency</div>
    </div>
    <PercentileChart
      title='Yards Per Target'
      stats={stats}
      percentiles={percentiles}
      type='_recyptrg'
    />
    <PercentileChart
      title='Yards Per Rec'
      stats={stats}
      percentiles={percentiles}
      type='recy_prec'
    />
    <PercentileChart
      title='Yards Per Game'
      stats={stats}
      percentiles={percentiles}
      type='recy_pg'
    />
    <PercentileChart
      title='aDOT'
      stats={stats}
      percentiles={percentiles}
      type='rdot_ptrg'
    />
    <PercentileChart
      title='YAC Per Rec'
      stats={stats}
      percentiles={percentiles}
      type='_ryacprec'
    />
  </div>
)

const kicker = () => (
  <div className='selected__section'>
    <div className='selected__section-header'>
      <div className='row__group-head'>Kicker Efficiency</div>
    </div>
    <p>In Development</p>
  </div>
)

const defense = () => (
  <div className='selected__section'>
    <div className='selected__section-header'>
      <div className='row__group-head'>Defense Efficiency</div>
    </div>
    <p>In Development</p>
  </div>
)

export default class SelectedPlayerEfficiencyStats extends React.Component {
  render = () => {
    const { player, percentiles } = this.props
    const stats = player.stats.toJS()

    return (
      <div>
        {player.pos === 'QB' && passing({ stats, percentiles })}
        {['QB', 'RB'].includes(player.pos) && rushing({ stats, percentiles })}
        {['RB', 'WR', 'TE'].includes(player.pos) &&
          receiving({ stats, percentiles })}
        {player.pos === 'K' && kicker({ stats, percentiles })}
        {player.pos === 'DST' && defense({ stats, percentiles })}
      </div>
    )
  }
}
