import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Map } from 'immutable'

import { constants } from '@libs-shared'
import PercentileChart from '@components/percentile-chart'

// TODO - pass epa per play
// TODO - use percentile_key and percentile_field
const passing = ({ stats }) => (
  <div className='selected__section'>
    <div className='selected__table-header'>
      <div className='row__group-head'>Passing Efficiency</div>
    </div>
    <PercentileChart title='Comp %' stats={stats} type='pc_pct' />
    <PercentileChart title='TD %' stats={stats} type='tdp_pct' />
    <PercentileChart title='Int %' stats={stats} type='ints_pct' />
    <PercentileChart title='Int Worthy %' stats={stats} type='int_worthy_pct' />
    <PercentileChart title='YPA' stats={stats} type='_ypa' />
    <PercentileChart title='aDOT' stats={stats} type='pdot_pa' />
  </div>
)

// TODO - rush epa per play
// TODO - true yards per carry
// TODO - yards per touch
// TOOD - breakaway run rate
// TODO - first down rate
const rushing = ({ stats }) => (
  <div className='selected__section'>
    <div className='selected__table-header'>
      <div className='row__group-head'>Rushing Efficiency</div>
    </div>
    <PercentileChart title='Yards Per Carry' stats={stats} type='ry_pra' />
    <PercentileChart
      title='Yards Created Per Rush'
      stats={stats}
      type='ryaco_pra'
    />
    <PercentileChart title='Positive Rush Rate' stats={stats} type='posra' />
    <PercentileChart title='Successful Rush Rate' stats={stats} type='posra' />
    <PercentileChart
      title='Broken Tackles Per Touch'
      stats={stats}
      type='mbt_pt'
    />
    <PercentileChart title='Fumble Rate' stats={stats} type='_fumlpra' />
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
const receiving = ({ stats }) => (
  <div className='selected__section'>
    <div className='selected__table-header'>
      <div className='row__group-head'>Receiving Efficiency</div>
    </div>
    <PercentileChart title='Yards Per Target' stats={stats} type='_recyptrg' />
    <PercentileChart title='Yards Per Rec' stats={stats} type='recy_prec' />
    <PercentileChart title='Yards Per Game' stats={stats} type='recy_pg' />
    <PercentileChart title='DOT' stats={stats} type='_ayptrg' />
    <PercentileChart title='YAC Per Rec' stats={stats} type='_ryacprec' />
  </div>
)

const kicker = () => (
  <div className='selected__section'>
    <div className='selected__table-header'>
      <div className='row__group-head'>Kicker Efficiency</div>
    </div>
    <p>In Development</p>
  </div>
)

const defense = () => (
  <div className='selected__section'>
    <div className='selected__table-header'>
      <div className='row__group-head'>Defense Efficiency</div>
    </div>
    <p>In Development</p>
  </div>
)

export default class SelectedPlayerEfficiencyStats extends React.Component {
  render = () => {
    const { player_map } = this.props
    const stats = (
      player_map.get('stats', new Map()) || new Map(constants.createFullStats())
    ).toJS()
    const pos = player_map.get('pos')

    return (
      <div>
        {pos === 'QB' && passing({ stats })}
        {['QB', 'RB'].includes(pos) && rushing({ stats })}
        {['RB', 'WR', 'TE'].includes(pos) && receiving({ stats })}
        {pos === 'K' && kicker({ stats })}
        {pos === 'DST' && defense({ stats })}
      </div>
    )
  }
}

SelectedPlayerEfficiencyStats.propTypes = {
  player_map: ImmutablePropTypes.map
}
