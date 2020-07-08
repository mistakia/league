import React from 'react'

import Source from '@components/source'
import EditableProjection from '@components/editable-projection'
import Position from '@components/position'
import Icon from '@components/icon'
import { weightProjections } from '@common'
import PlayerExpandedRow from '@components/player-expanded-row'
import PlayerWatchlistAction from '@components/player-watchlist-action'

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
          <div className='player__row-metric'>{player.stats.py}</div>
          <div className='player__row-metric'>{player.stats.tdp}</div>
          <div className='player__row-metric'>{player.stats.ints}</div>
          <div className='player__row-metric'>{player.stats.drppy}</div>
        </div>
      </div>
    )

    const passingEfficiency = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.pc_pct}</div>
          <div className='player__row-metric'>{player.stats.tdp_pct}</div>
          <div className='player__row-metric'>{player.stats.ints_pct}</div>
          <div className='player__row-metric'>{player.stats.intw_pct}</div>
        </div>
      </div>
    )

    const passingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.pyac}</div>
          <div className='player__row-metric'>{player.stats.pyac_pc}</div>
          <div className='player__row-metric'>{player.stats._ypa}</div>
          <div className='player__row-metric'>{player.stats.pdot_pa}</div>
        </div>
      </div>
    )

    const passingAiryards = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.ptay}</div>
          <div className='player__row-metric'>{player.stats.pcay_pc}</div>
          <div className='player__row-metric'>{player.stats._aypa}</div>
          <div className='player__row-metric'>{player.stats._pacr}</div>
        </div>
      </div>
    )

    const passingPressure = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.sk}</div>
          <div className='player__row-metric'>{player.stats.sky}</div>
          <div className='player__row-metric'>{player.stats.sk_pct}</div>
          <div className='player__row-metric'>{player.stats.qbhi_pct}</div>
          <div className='player__row-metric'>{player.stats.qbp_pct}</div>
          <div className='player__row-metric'>{player.stats.qbhu_pct}</div>
          <div className='player__row-metric'>{player.stats.sk_pct}</div>
        </div>
      </div>
    )

    const rushingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.ry}</div>
          <div className='player__row-metric'>{player.stats.tdr}</div>
          <div className='player__row-metric'>{player.stats.ry_pra}</div>
        </div>
      </div>
    )

    const rushingProductivity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.ra}</div>
          <div className='player__row-metric'>{player.stats.rfd}</div>
          <div className='player__row-metric'>{player.stats.posra}</div>
        </div>
      </div>
    )

    const rushingAfterContact = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.ryaco}</div>
          <div className='player__row-metric'>{player.stats.ryaco_pra}</div>
        </div>
      </div>
    )

    const rushingShare = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats._stra}</div>
          <div className='player__row-metric'>{player.stats._stry}</div>
        </div>
      </div>
    )

    const rushingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats._fumlpra}</div>
          <div className='player__row-metric'>{player.stats.posra_pra}</div>
          <div className='player__row-metric'>{player.stats.rasucc_pra}</div>
        </div>
      </div>
    )

    const rushingBrokenTackles = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.mbt}</div>
          <div className='player__row-metric'>{player.stats.mbt_pt}</div>
        </div>
      </div>
    )

    const receivingBasic = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.rec}</div>
          <div className='player__row-metric'>{player.stats.recy}</div>
          <div className='player__row-metric'>{player.stats.tdrec}</div>
          <div className='player__row-metric'>{player.stats.drp}</div>
          <div className='player__row-metric'>{player.stats.drprecy}</div>
        </div>
      </div>
    )

    const receivingOppurtunity = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats.trg}</div>
          <div className='player__row-metric'>{player.stats.dptrg_pct}</div>
          <div className='player__row-metric'>{player.stats.rdot_ptrg}</div>
          <div className='player__row-metric'>{player.stats._strtay}</div>
          <div className='player__row-metric'>{player.stats._sttrg}</div>
          <div className='player__row-metric'>{player.stats._wopr}</div>
        </div>
      </div>
    )

    const receivingAdvanced = (
      <div className='row__group'>
        <div className='row__group-body'>
          <div className='player__row-metric'>{player.stats._ayptrg}</div>
          <div className='player__row-metric'>{player.stats._recypay}</div>
          <div className='player__row-metric'>{player.stats._recyprec}</div>
          <div className='player__row-metric'>{player.stats._recyptrg}</div>
          <div className='player__row-metric'>{player.stats._ryacprec}</div>
        </div>
      </div>
    )

    const projections = []
    const years = []
    if (isSelected) {
      player.projections.forEach((p, index) => {
        const isUser = !!p.userid
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
