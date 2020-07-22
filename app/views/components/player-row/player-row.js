import React from 'react'

import EditableProjection from '@components/editable-projection'
import Position from '@components/position'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import PlayerRowMetric from '@components/player-row-metric'

import './player-row.styl'

export default class PlayerRow extends React.Component {
  handleClick = () => {
    this.props.select(this.props.player.player)
  }

  render = () => {
    const {
      player, style, selected, vbaseline, isSeasonProjectionView,
      isStatsPassingAdvancedView, isStatsPassingPressureView, isStatsRushingView,
      isStatsReceivingView, overall
    } = this.props

    const isSelected = selected === player.player

    const seasonProjectionSummary = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>
            ${Math.round(player.values[vbaseline])}
          </div>
          <div className='player__row-metric'>
            {Math.round(player.vorp[vbaseline] || 0)}
          </div>
          <div className='player__row-metric'>
            {(player.points.total || 0).toFixed(1)}
          </div>
        </div>
      </div>
    )

    const passingProjection = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='py' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='tdp' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='ints' />
          </div>
        </div>
      </div>
    )

    const rushingProjection = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='ra' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='ry' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='tdr' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='fuml' />
          </div>
        </div>
      </div>
    )

    const receivingProjection = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='trg' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='rec' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='recy' />
          </div>
          <div className='player__row-metric'>
            <EditableProjection player={player} type='tdrec' />
          </div>
        </div>
      </div>
    )
    const { stats } = player
    const passingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='py' />
          <PlayerRowMetric stats={stats} overall={overall} type='tdp' />
          <PlayerRowMetric stats={stats} overall={overall} type='ints' />
          <PlayerRowMetric stats={stats} overall={overall} type='drppy' />
        </div>
      </div>
    )

    const passingEfficiency = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='pc_pct' />
          <PlayerRowMetric stats={stats} overall={overall} type='tdp_pct' />
          <PlayerRowMetric stats={stats} overall={overall} type='ints_pct' />
          <PlayerRowMetric stats={stats} overall={overall} type='intw_pct' />
        </div>
      </div>
    )

    const passingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='pyac' />
          <PlayerRowMetric stats={stats} overall={overall} type='pyac_pc' />
          <PlayerRowMetric stats={stats} overall={overall} type='_ypa' />
          <PlayerRowMetric stats={stats} overall={overall} type='pdot_pa' />
        </div>
      </div>
    )

    const passingAiryards = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='ptay' />
          <PlayerRowMetric stats={stats} overall={overall} type='_aypa' />
          <PlayerRowMetric stats={stats} overall={overall} type='pcay_pc' />
          <PlayerRowMetric stats={stats} overall={overall} type='_pacr' />
        </div>
      </div>
    )

    const passingPressure = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='sk' />
          <PlayerRowMetric stats={stats} overall={overall} type='sky' />
          <PlayerRowMetric stats={stats} overall={overall} type='sk_pct' />
          <PlayerRowMetric stats={stats} overall={overall} type='qbhi_pct' />
          <PlayerRowMetric stats={stats} overall={overall} type='qbp_pct' />
          <PlayerRowMetric stats={stats} overall={overall} type='qbhu_pct' />
          <PlayerRowMetric stats={stats} overall={overall} type='_nygpa' />
        </div>
      </div>
    )

    const rushingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='ry' />
          <PlayerRowMetric stats={stats} overall={overall} type='tdr' />
          <PlayerRowMetric stats={stats} overall={overall} type='ry_pra' />
        </div>
      </div>
    )

    const rushingProductivity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='ra' />
          <PlayerRowMetric stats={stats} overall={overall} type='rfd' />
          <PlayerRowMetric stats={stats} overall={overall} type='posra' />
        </div>
      </div>
    )

    const rushingAfterContact = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='ryaco' />
          <PlayerRowMetric stats={stats} overall={overall} type='ryaco_pra' />
        </div>
      </div>
    )

    const rushingShare = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='_stra' />
          <PlayerRowMetric stats={stats} overall={overall} type='_stry' />
        </div>
      </div>
    )

    const rushingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='_fumlpra' />
          <PlayerRowMetric stats={stats} overall={overall} type='posra_pra' />
          <PlayerRowMetric stats={stats} overall={overall} type='rasucc_pra' />
        </div>
      </div>
    )

    const rushingBrokenTackles = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='mbt' />
          <PlayerRowMetric stats={stats} overall={overall} type='mbt_pt' />
        </div>
      </div>
    )

    const receivingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='rec' />
          <PlayerRowMetric stats={stats} overall={overall} type='recy' />
          <PlayerRowMetric stats={stats} overall={overall} type='tdrec' />
          <PlayerRowMetric stats={stats} overall={overall} type='drp' />
          <PlayerRowMetric stats={stats} overall={overall} type='drprecy' />
        </div>
      </div>
    )

    const receivingOppurtunity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='trg' />
          <PlayerRowMetric stats={stats} overall={overall} type='dptrg_pct' />
          <PlayerRowMetric stats={stats} overall={overall} type='rdot_ptrg' />
          <PlayerRowMetric stats={stats} overall={overall} type='_strtay' />
          <PlayerRowMetric stats={stats} overall={overall} type='_sttrg' />
          <PlayerRowMetric stats={stats} overall={overall} type='_wopr' />
        </div>
      </div>
    )

    const receivingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric stats={stats} overall={overall} type='_ayptrg' />
          <PlayerRowMetric stats={stats} overall={overall} type='_recypay' />
          <PlayerRowMetric stats={stats} overall={overall} type='_recyprec' />
          <PlayerRowMetric stats={stats} overall={overall} type='_recyptrg' />
          <PlayerRowMetric stats={stats} overall={overall} type='_ryacprec' />
        </div>
      </div>
    )

    const classNames = ['player__row']
    if (isSelected) classNames.push('selected')

    return (
      <div style={style}>
        <div className={classNames.join(' ')}>
          <div className='player__row-main' onClick={this.handleClick}>
            <div className='player__row-action'>
              <PlayerWatchlistAction playerId={player.player} />
            </div>
            <div className='player__row-pos'>
              <Position pos={player.pos1} />
            </div>
            <div className='player__row-name'>{player.name}</div>
            {isSeasonProjectionView && seasonProjectionSummary}
            {isSeasonProjectionView && passingProjection}
            {isSeasonProjectionView && rushingProjection}
            {isSeasonProjectionView && receivingProjection}
            {isStatsPassingAdvancedView && passingBasic}
            {isStatsPassingAdvancedView && passingEfficiency}
            {isStatsPassingAdvancedView && passingAdvanced}
            {isStatsPassingAdvancedView && passingAiryards}
            {isStatsPassingPressureView && passingPressure}
            {isStatsRushingView && rushingBasic}
            {isStatsRushingView && rushingProductivity}
            {isStatsRushingView && rushingAfterContact}
            {isStatsRushingView && rushingShare}
            {isStatsRushingView && rushingAdvanced}
            {isStatsRushingView && rushingBrokenTackles}
            {isStatsReceivingView && receivingBasic}
            {isStatsReceivingView && receivingOppurtunity}
            {isStatsReceivingView && receivingAdvanced}
          </div>
        </div>
      </div>
    )
  }
}
