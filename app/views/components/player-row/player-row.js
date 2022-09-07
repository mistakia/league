import React from 'react'
import { Map, isImmutable } from 'immutable'
import Bugsnag from '@bugsnag/js'

import PlayerRowOpponent from '@components/player-row-opponent'
import EditableProjection from '@components/editable-projection'
import Position from '@components/position'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import PercentileMetric from '@components/percentile-metric'
import NFLTeam from '@components/nfl-team'
import TeamName from '@components/team-name'
import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import { constants } from '@common'
import PlayerLabel from '@components/player-label'
import PlayerTag from '@components/player-tag'
import { Team } from '@core/teams'

import './player-row.styl'

class PlayerRow extends Player {
  render = () => {
    const {
      playerMap,
      selectedPlayer,
      isStatsView,
      isSeasonView,
      isHosted,
      isWeekView,
      isStatsPassingAdvancedView,
      isStatsPassingPressureView,
      isStatsRushingView,
      week,
      isStatsReceivingView,
      percentiles,
      isLoggedIn,
      isRestOfSeasonView,
      selected, // inherited from Player class
      status,
      baselines,
      teamId,
      index,
      teams,
      highlight_teamIds
    } = this.props

    const pid = playerMap.get('pid')
    const tid = playerMap.get('tid')
    const team = teams.get(tid) || new Team()
    const nfl_team = playerMap.get('team')
    const pos = playerMap.get('pos')
    const isRostered = Boolean(tid)
    const isSelected = selectedPlayer === pid || selected === pid

    const seasonSummary = () => {
      const market_salary = playerMap.getIn(['market_salary', `${week}`])
      const market_salary_adj = playerMap.get('market_salary_adj', 0)
      const playerSalary = week === 0 && (
        <>
          <div className='table__cell metric'>
            ${playerMap.get('value', '--')}
          </div>
          {constants.isOffseason && (
            <div className='table__cell metric'>
              {Math.round(playerMap.getIn(['vorp_adj', `${week}`], 0))}
            </div>
          )}
          {constants.isOffseason && (
            <div className='table__cell metric'>
              ${Math.round(market_salary) || '--'}
            </div>
          )}
          {constants.isOffseason && (
            <div className='table__cell metric'>
              ${Math.round(market_salary_adj) || '--'}
            </div>
          )}
        </>
      )

      return (
        <div className='row__group'>
          <div className='row__group-body'>
            {isLoggedIn && playerSalary}
            <div className='table__cell metric'>
              {Math.round(playerMap.getIn(['vorp', `${week}`], 0))}
            </div>
            <div className='table__cell metric'>
              {playerMap.getIn(['points', `${week}`, 'total'], 0).toFixed(1)}
            </div>
          </div>
        </div>
      )
    }

    const seasonPassing = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='py' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='tdp' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='ints' week={week} />
          </div>
        </div>
      </div>
    )

    const seasonRushing = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='ra' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='ry' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='tdr' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='fuml' week={week} />
          </div>
        </div>
      </div>
    )

    const seasonReceiving = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='trg' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='rec' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection playerMap={playerMap} type='recy' week={week} />
          </div>
          <div className='table__cell metric'>
            <EditableProjection
              playerMap={playerMap}
              type='tdrec'
              week={week}
            />
          </div>
        </div>
      </div>
    )

    const map =
      playerMap.get('stats', new Map()) || new Map(constants.createFullStats())
    if (!isImmutable(map)) {
      const err = Error('player stats properties is not a map')
      Bugsnag.notify(err)
    }
    const stats = isImmutable(map) ? map.toJS() : map

    const fantasyPoints = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={1}
            type='pts'
          />
        </div>
      </div>
    )

    const passingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='py'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='tdp'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='ints'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='drppy'
          />
        </div>
      </div>
    )

    const passingEfficiency = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='pc_pct'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='tdp_pct'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='ints_pct'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='intw_pct'
          />
        </div>
      </div>
    )

    const passingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='pyac'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='pyac_pc'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_ypa'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='pdot_pa'
          />
        </div>
      </div>
    )

    const passingAiryards = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='pdot'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='pcay_pc'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_pacr'
          />
        </div>
      </div>
    )

    const passingPressure = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='sk'
            fixed={0}
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='sky'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='sk_pct'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='qbhi_pct'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='qbp_pct'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='qbhu_pct'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_nygpa'
          />
        </div>
      </div>
    )

    const rushingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='ry'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='tdr'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='ry_pra'
          />
        </div>
      </div>
    )

    const rushingProductivity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='ra'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='rfd'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='posra'
          />
        </div>
      </div>
    )

    const rushingAfterContact = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='ryaco'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='ryaco_pra'
          />
        </div>
      </div>
    )

    const rushingShare = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_stra'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_stry'
          />
        </div>
      </div>
    )

    const rushingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_fumlpra'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='posra_pra'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='rasucc_pra'
          />
        </div>
      </div>
    )

    const rushingBrokenTackles = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='mbt'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='mbt_pt'
          />
        </div>
      </div>
    )

    const receivingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='rec'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='recy'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='tdrec'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='drp'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='drprecy'
          />
        </div>
      </div>
    )

    const receivingOpportunity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            fixed={0}
            type='trg'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='dptrg_pct'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_ayptrg'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='rdot'
            fixed={0}
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_stray'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_sttrg'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_wopr'
          />
        </div>
      </div>
    )

    const receivingEfficiency = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_recypay'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_recyprec'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_recyptrg'
          />
          <PercentileMetric
            stats={stats}
            percentiles={percentiles}
            type='_ryacprec'
          />
        </div>
      </div>
    )

    const classNames = ['player__row']
    if (isSelected) classNames.push('selected')
    if (isLoggedIn && !isRostered) classNames.push('fa')
    else if (highlight_teamIds.includes(tid))
      classNames.push(`draft-order-${team.get('do')}`)
    else if (tid === teamId) classNames.push('rostered')

    const projectionView = isRestOfSeasonView || isSeasonView || isWeekView

    if (isWeekView || isSeasonView) {
      const baseline_pid = baselines.getIn([`${week}`, pos, 'default'])

      if (pid === baseline_pid) {
        classNames.push('baseline__player')
      }
    }

    const name =
      window.innerWidth <= 600 ? playerMap.get('pname') : playerMap.get('name')

    return (
      <div className={classNames.join(' ')}>
        <div className='player__row-lead'>
          <div className='player__row-index'>{index + 1}</div>
          <div className='player__row-action watchlist'>
            <PlayerWatchlistAction pid={pid} />
          </div>
          <div className='player__row-pos'>
            <Position pos={pos} />
          </div>
          <div className='player__row-name cursor' onClick={this.handleClick}>
            <span>{name}</span>
            {constants.year === playerMap.get('start') && (
              <PlayerLabel label='R' type='rookie' description='Rookie' />
            )}
            <NFLTeam team={nfl_team} />
          </div>
          {isLoggedIn && (
            <div className='player__row-tag'>
              <PlayerTag tag={playerMap.get('tag')} />
            </div>
          )}
          {isLoggedIn && (
            <div className='player__row-action actions'>
              {Boolean(isHosted) && (
                <IconButton
                  small
                  text
                  onClick={this.handleContextClick}
                  icon='more'
                />
              )}
            </div>
          )}
          {isWeekView && (
            <PlayerRowOpponent team={nfl_team} pos={pos} week={week} />
          )}
          {isLoggedIn && (
            <div className='player__row-availability'>
              {isRostered ? (
                <TeamName abbrv tid={tid} />
              ) : status.waiver.active ||
                status.waiver.poach ||
                status.waiver.practice ||
                status.locked ? (
                'W'
              ) : (
                'FA'
              )}
            </div>
          )}
        </div>
        {projectionView && seasonSummary()}
        {projectionView && seasonPassing}
        {projectionView && seasonRushing}
        {projectionView && seasonReceiving}
        {isStatsView && fantasyPoints}
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
        {isStatsReceivingView && receivingEfficiency}
      </div>
    )
  }
}

export default connect(PlayerRow)
