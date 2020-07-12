import React from 'react'

import Source from '@components/source'
import EditableProjection from '@components/editable-projection'
import Position from '@components/position'
import Icon from '@components/icon'
import { weightProjections } from '@common'
import PlayerExpandedRow from '@components/player-expanded-row'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import PlayerRowMetric from '@components/player-row-metric'

import './player-row.styl'

export default class PlayerRow extends React.Component {
  handleClick = () => {
    this.props.select(this.props.player.player)
  }

  handleDeselectClick = () => {
    this.props.deselect()
  }

  handleClearClick = () => {
    this.props.delete(this.props.player.player)
  }

  render = () => {
    const {
      player, style, selected, stats, vbaseline, isSeasonProjectionView,
      isStatsPassingAdvancedView, isStatsPassingPressureView, isStatsRushingView,
      isStatsReceivingView
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

    const passingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.py} type='py' />
          <PlayerRowMetric value={player.stats.tdp} type='tdp' />
          <PlayerRowMetric value={player.stats.ints} type='ints' />
          <PlayerRowMetric value={player.stats.drppy} type='drppy' />
        </div>
      </div>
    )

    const passingEfficiency = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.pc_pct} type='pc_pct' />
          <PlayerRowMetric value={player.stats.tdp_pct} type='tdp_pct' />
          <PlayerRowMetric value={player.stats.ints_pct} type='ints_pct' />
          <PlayerRowMetric value={player.stats.intw_pct} type='intw_pct' />
        </div>
      </div>
    )

    const passingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.pyac} type='pyac' />
          <PlayerRowMetric value={player.stats.pyac_pc} type='pyac_pc' />
          <PlayerRowMetric value={player.stats._ypa} type='_ypa' />
          <PlayerRowMetric value={player.stats.pdot_pa} type='pdot_pa' />
        </div>
      </div>
    )

    const passingAiryards = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.ptay} type='ptay' />
          <PlayerRowMetric value={player.stats.pcay_pc} type='pcay_pc' />
          <PlayerRowMetric value={player.stats._aypa} type='_aypa' />
          <PlayerRowMetric value={player.stats._pacr} type='_pacr' />
        </div>
      </div>
    )

    const passingPressure = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.sk} type='sk' />
          <PlayerRowMetric value={player.stats.sky} type='sky' />
          <PlayerRowMetric value={player.stats.sk_pct} type='sk_pct' />
          <PlayerRowMetric value={player.stats.qbhi_pct} type='qbhi_pct' />
          <PlayerRowMetric value={player.stats.qbp_pct} type='qbp_pct' />
          <PlayerRowMetric value={player.stats.qbhu_pct} type='qbhu_pct' />
          <PlayerRowMetric value={player.stats.sk_pct} type='sk_pct' />
        </div>
      </div>
    )

    const rushingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.ry} type='ry' />
          <PlayerRowMetric value={player.stats.tdr} type='tdr' />
          <PlayerRowMetric value={player.stats.ry_pra} type='ry_pra' />
        </div>
      </div>
    )

    const rushingProductivity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.ra} type='ra' />
          <PlayerRowMetric value={player.stats.rfd} type='rfd' />
          <PlayerRowMetric value={player.stats.posra} type='posra' />
        </div>
      </div>
    )

    const rushingAfterContact = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.ryaco} type='ryaco' />
          <PlayerRowMetric value={player.stats.ryaco_pra} type='ryaco_pra' />
        </div>
      </div>
    )

    const rushingShare = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats._stra} type='_stra' />
          <PlayerRowMetric value={player.stats._stry} type='_stry' />
        </div>
      </div>
    )

    const rushingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats._fumlpra} type='_fumlpra' />
          <PlayerRowMetric value={player.stats.posra_pra} type='posra_pra' />
          <PlayerRowMetric value={player.stats.rasucc_pra} type='rasucc_pra' />
        </div>
      </div>
    )

    const rushingBrokenTackles = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.mbt} type='mbt' />
          <PlayerRowMetric value={player.stats.mbt_pt} type='mbt_pt' />
        </div>
      </div>
    )

    const receivingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.rec} type='rec' />
          <PlayerRowMetric value={player.stats.recy} type='recy' />
          <PlayerRowMetric value={player.stats.tdrec} type='tdrec' />
          <PlayerRowMetric value={player.stats.drp} type='drp' />
          <PlayerRowMetric value={player.stats.drprecy} type='drprecy' />
        </div>
      </div>
    )

    const receivingOppurtunity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats.trg} type='trg' />
          <PlayerRowMetric value={player.stats.dptrg_pct} type='dptrg_pct' />
          <PlayerRowMetric value={player.stats.rdot_ptrg} type='rdot_ptrg' />
          <PlayerRowMetric value={player.stats._strtay} type='_strtay' />
          <PlayerRowMetric value={player.stats._sttrg} type='_sttrg' />
          <PlayerRowMetric value={player.stats._wopr} type='_wopr' />
        </div>
      </div>
    )

    const receivingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <PlayerRowMetric value={player.stats._ayptrg} type='_ayptrg' />
          <PlayerRowMetric value={player.stats._recypay} type='_recypay' />
          <PlayerRowMetric value={player.stats._recyprec} type='_recyprec' />
          <PlayerRowMetric value={player.stats._recyptrg} type='_recyptrg' />
          <PlayerRowMetric value={player.stats._ryacprec} type='_ryacprec' />
        </div>
      </div>
    )

    const projections = []
    const years = []
    if (isSelected) {
      player.projections.forEach((p, index) => {
        const isUser = !p.sourceid
        const title = (isUser ? 'User' : <Source sourceId={p.sourceid} />)
        const action = (
          <div className='row__action'>
            {isUser && <div onClick={this.handleClearClick}><Icon name='clear' /></div>}
          </div>
        )

        const item = (
          <PlayerExpandedRow
            key={index}
            stats={p}
            title={title}
            action={action}
          />
        )
        projections.push(item)
      })

      const projAvg = weightProjections({
        projections: player.projections.filter(p => !p.userid),
        userId: 0
      })

      projections.push(
        <PlayerExpandedRow
          className='average__row'
          key='average'
          stats={projAvg}
          title='Average'
          action={(<div className='row__action' />)}
        />
      )

      for (const year in stats.overall) {
        const games = Object.keys(stats.years[year]).length
        const p = stats.overall[year]
        const item = (
          <PlayerExpandedRow games={games} key={year} title={year} stats={p} />
        )
        years.push(item)
      }

      // TODO year average
    }

    const expanded = (
      <div className='player__row-expanded'>
        <div className='expanded__action' onClick={this.handleDeselectClick}>
          <Icon name='clear' />
        </div>
        <div className='expanded__section'>
          <div className='expanded__section-header'>
            <div className='row__group-head'>
              Season Projections
            </div>
          </div>
          <div className='expanded__section-header'>
            <div className='row__name'>Source</div>
            <div className='row__group'>
              <div className='row__group-head'>Passing</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
                <div className='player__row-metric'>INT</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-head'>Rushing</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>CAR</div>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
                <div className='player__row-metric'>FUM</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-head'>Receiving</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>TAR</div>
                <div className='player__row-metric'>REC</div>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
              </div>
            </div>
            <div className='row__action' />
          </div>
          {projections}
        </div>
        <div className='expanded__section'>
          <div className='expanded__section-header'>
            <div className='row__group-head'>
              Season Stats
            </div>
          </div>
          <div className='expanded__section-header'>
            <div className='row__name'>Year</div>
            <div className='row__games'>G</div>
            <div className='row__group'>
              <div className='row__group-head'>Passing</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
                <div className='player__row-metric'>INT</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-head'>Rushing</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>CAR</div>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
                <div className='player__row-metric'>FUM</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-head'>Receiving</div>
              <div className='row__group-body'>
                <div className='player__row-metric'>TAR</div>
                <div className='player__row-metric'>REC</div>
                <div className='player__row-metric'>YDS</div>
                <div className='player__row-metric'>TD</div>
              </div>
            </div>
          </div>
          {years}
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
          {isSelected && expanded}
        </div>
      </div>
    )
  }
}
