import React from 'react'

import PlayerRowOpponent from '@components/player-row-opponent'
import EditableProjection from '@components/editable-projection'
import Position from '@components/position'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import PercentileMetric from '@components/percentile-metric'
import Team from '@components/team'
import TeamName from '@components/team-name'
import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import { constants } from '@common'
import PlayerLabel from '@components/player-label'

import './player-row.styl'

class PlayerRow extends Player {
  render = () => {
    const {
      player, selectedPlayer, vbaseline, isSeasonView, isHosted, isWeekView,
      isStatsPassingAdvancedView, isStatsPassingPressureView, isStatsRushingView, week,
      isStatsReceivingView, percentiles, isLoggedIn, isRestOfSeasonView, selected, status,
      baselines, teamId
    } = this.props

    const isSelected = selectedPlayer === player.player || selected === player.player

    const seasonSummary = () => {
      let inflation = null
      const value = player.values.getIn([`${week}`, vbaseline])
      if (isRestOfSeasonView || isSeasonView) {
        const type = isRestOfSeasonView ? 'inflation' : 'inflationSeason'
        const diff = player.values.getIn([type, vbaseline]) - value
        const classNames = ['value__inflation']
        const isPos = diff > 0
        if (isPos) classNames.push('positive')
        else classNames.push('negative')
        inflation = (
          <span className={classNames.join(' ')}>{isPos && '+'}{diff || ''}</span>
        )
      }

      return (
        <div className='row__group'>
          <div className='row__group-body'>
            {!constants.season.isRegularSeason &&
              <div className='table__cell metric'>
                ${Math.round(value) || '--'}
                {inflation}
              </div>}
            <div className='table__cell metric'>
              {Math.round(player.vorp.getIn([`${week}`, vbaseline]) || 0)}
            </div>
            <div className='table__cell metric'>
              {Math.round(player.vorp_adj.getIn([`${week}`, vbaseline]) || 0)}
            </div>
            <div className='table__cell metric'>
              {(player.points.getIn([`${week}`, 'total']) || 0).toFixed(1)}
            </div>
          </div>
        </div>
      )
    }

    const seasonPassing = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='py' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='tdp' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='ints' week={week} />
          </div>
        </div>
      </div>
    )

    const seasonRushing = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='ra' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='ry' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='tdr' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='fuml' week={week} />
          </div>
        </div>
      </div>
    )

    const seasonReceiving = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='trg' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='rec' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='recy' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection player={player} type='tdrec' week={week} />
          </div>
        </div>
      </div>
    )
    const stats = player.stats.toJS()
    const passingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='py' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='tdp' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='ints' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='drppy' />
        </div>
      </div>
    )

    const passingEfficiency = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='pc_pct' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='tdp_pct' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='ints_pct' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='intw_pct' />
        </div>
      </div>
    )

    const passingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='pyac' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='pyac_pc' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_ypa' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='pdot_pa' />
        </div>
      </div>
    )

    const passingAiryards = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='pdot' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='pcay_pc' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_pacr' />
        </div>
      </div>
    )

    const passingPressure = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='sk' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='sky' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='sk_pct' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='qbhi_pct' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='qbp_pct' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='qbhu_pct' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_nygpa' />
        </div>
      </div>
    )

    const rushingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='ry' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='tdr' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='ry_pra' />
        </div>
      </div>
    )

    const rushingProductivity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='ra' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='rfd' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='posra' />
        </div>
      </div>
    )

    const rushingAfterContact = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='ryaco' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='ryaco_pra' />
        </div>
      </div>
    )

    const rushingShare = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='_stra' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_stry' />
        </div>
      </div>
    )

    const rushingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='_fumlpra' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='posra_pra' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='rasucc_pra' />
        </div>
      </div>
    )

    const rushingBrokenTackles = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='mbt' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='mbt_pt' />
        </div>
      </div>
    )

    const receivingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='rec' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='recy' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='tdrec' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='drp' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='drprecy' />
        </div>
      </div>
    )

    const receivingOpportunity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='trg' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='dptrg_pct' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='rdot_ptrg' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_stray' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_sttrg' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_wopr' />
        </div>
      </div>
    )

    const receivingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric stats={stats} percentiles={percentiles} type='_ayptrg' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_recypay' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_recyprec' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_recyptrg' />
          <PercentileMetric stats={stats} percentiles={percentiles} type='_ryacprec' />
        </div>
      </div>
    )

    const classNames = ['player__row']
    if (isSelected) classNames.push('selected')
    if (!player.tid) classNames.push('fa')
    else if (player.tid === teamId) classNames.push('rostered')

    const projectionView = isRestOfSeasonView || isSeasonView || isWeekView

    if (isWeekView || isSeasonView) {
      const starterBaselinePlayerId = baselines.getIn([`${week}`, player.pos, 'starter'])
      if (player.player === starterBaselinePlayerId) classNames.push('starter__baseline')
    }

    return (
      <div className={classNames.join(' ')}>
        <div className='player__row-lead'>
          <div className='player__row-action'>
            <PlayerWatchlistAction playerId={player.player} />
          </div>
          <div className='player__row-pos'>
            <Position pos={player.pos} />
          </div>
          <div className='player__row-name cursor' onClick={this.handleClick}>
            <span>{player.name}</span>
            {(constants.season.year === player.draft_year) && <PlayerLabel label='R' type='rookie' description='Rookie' />}
            <Team team={player.team} />
          </div>
          {isLoggedIn &&
            <div className='player__row-action'>
              {!!isHosted && <IconButton small text onClick={this.handleContextClick} icon='more' />}
            </div>}
          {constants.season.week > 0 && <PlayerRowOpponent team={player.team} pos={player.pos} />}
          {isLoggedIn &&
            <div className='player__row-availability'>
              {player.tid
                ? <TeamName abbrv tid={player.tid} />
                : ((status.waiver.active || status.waiver.poach || status.waiver.practice || status.locked)
                  ? 'W' : 'FA')}
            </div>}
        </div>
        {projectionView && seasonSummary()}
        {projectionView && seasonPassing}
        {projectionView && seasonRushing}
        {projectionView && seasonReceiving}
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
        {isStatsReceivingView && receivingOpportunity}
        {isStatsReceivingView && receivingAdvanced}
      </div>
    )
  }
}

export default connect(PlayerRow)
