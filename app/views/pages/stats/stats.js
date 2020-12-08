import React from 'react'

import PageLayout from '@layouts/page'
import PercentileMetric from '@components/percentile-metric'
import { constants, getEligibleSlots, toPercent } from '@common'

import './stats.styl'

function SummaryRow ({ team, percentiles }) {
  const stats = team.get('stats').toJS()
  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pf' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pa' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pdiff' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pp' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pp_pct' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pw' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pl' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pmax' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pmin' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pdev' }} />
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric scaled {...{ stats, percentiles, type: 'apWins' }} />
          <PercentileMetric scaled {...{ stats, percentiles, type: 'apLosses' }} />
          <PercentileMetric scaled {...{ stats, percentiles, type: 'apTies' }} />
          <div className='table__cell metric'>{toPercent(team.getIn(['stats', 'apWins'], 0) / (team.getIn(['stats', 'apWins'], 0) + team.getIn(['stats', 'apLosses'], 0) + team.getIn(['stats', 'apTies'], 0)))}</div>
        </div>
      </div>
    </div>
  )
}

function PositionRow ({ team, percentiles }) {
  const positionCells = []
  for (const [index, position] of constants.positions.entries()) {
    const type = `pPos${position}`
    const points = team.getIn(['stats', type], 0)
    positionCells.push(
      <PercentileMetric
        key={index}
        stats={team.get('stats').toJS()}
        scaled
        {...{ percentiles, type }}
      />
    )
    positionCells.push(
      <div key={`${index}%`} className='table__cell metric'>{toPercent(points / team.getIn(['stats', 'pf'], 0))}</div>
    )
  }

  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      {positionCells}
    </div>
  )
}

function SlotRow ({ team, slots, percentiles }) {
  const slotCells = []
  for (const [index, s] of slots.entries()) {
    const slot = constants.slots[s]
    const type = `pSlot${slot}`
    const points = team.getIn(['stats', type], 0)
    slotCells.push(
      <PercentileMetric
        key={index}
        stats={team.get('stats').toJS()}
        scaled
        {...{ percentiles, type }}
      />
    )
    slotCells.push(<div key={`${index}%`} className='table__cell metric'>{toPercent(points / team.getIn(['stats', 'pf'], 0))}</div>)
  }

  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      {slotCells}
    </div>
  )
}

export default class StatsPage extends React.Component {
  render = () => {
    const { league, teams, percentiles } = this.props

    const slotHeaders = []
    const eligibleStarterSlots = getEligibleSlots({ pos: 'ALL', league })
    const slots = [...new Set(eligibleStarterSlots)]
    for (const [index, slot] of slots.entries()) {
      slotHeaders.push(<div key={index} className='table__cell metric'>{constants.slotName[constants.slots[slot]]}</div>)
      slotHeaders.push(<div key={`${index}%`} className='table__cell metric'>%</div>)
    }

    const positionHeaders = []
    for (const position of constants.positions) {
      positionHeaders.push(<div key={position} className='table__cell metric'>{position}</div>)
      positionHeaders.push(<div key={`${position}%`} className='table__cell metric'>%</div>)
    }

    const sorted = teams.sort((a, b) => b.getIn(['stats', 'apWins'], 0) - a.getIn(['stats', 'apWins'], 0) || b.getIn(['stats', 'pf'], 0) - a.getIn(['stats', 'pf'], 0))

    const summaryRows = []
    for (const team of sorted.valueSeq()) {
      summaryRows.push(<SummaryRow key={team.uid} team={team} percentiles={percentiles} />)
    }

    const slotRows = []
    for (const team of sorted.valueSeq()) {
      slotRows.push(
        <SlotRow
          key={team.uid}
          team={team}
          slots={slots}
          percentiles={percentiles}
        />
      )
    }

    const positionRows = []
    for (const team of sorted.valueSeq()) {
      positionRows.push(<PositionRow key={team.uid} team={team} percentiles={percentiles} />)
    }

    const body = (
      <div className='stats'>
        <div className='section'>
          <div className='dashboard__section-header-title'>League Stats</div>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell player__item-name'>Team</div>
              <div className='table__cell metric'>PF</div>
              <div className='table__cell metric'>PA</div>
              <div className='table__cell metric'>DIFF</div>
              <div className='table__cell metric'>PP</div>
              <div className='table__cell metric'>PP%</div>
              <div className='table__cell metric'>P WINS</div>
              <div className='table__cell metric'>P LOSSES</div>
              <div className='table__cell metric'>MAX</div>
              <div className='table__cell metric'>MIN</div>
              <div className='table__cell metric'>STDEV</div>
              <div className='player__row-group'>
                <div className='player__row-group-head'>All Play Record</div>
                <div className='player__row-group-body'>
                  <div className='table__cell metric'>W</div>
                  <div className='table__cell metric'>L</div>
                  <div className='table__cell metric'>T</div>
                  <div className='table__cell metric'>PCT</div>
                </div>
              </div>
            </div>
            {summaryRows}
          </div>
        </div>
        <div className='section'>
          <div className='dashboard__section-header-title'>Lineup Stats</div>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell player__item-name'>Team</div>
              {slotHeaders}
            </div>
            {slotRows}
          </div>
        </div>
        <div className='section'>
          <div className='dashboard__section-header-title'>Positional Stats</div>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell player__item-name'>Team</div>
              {positionHeaders}
            </div>
            {positionRows}
          </div>
        </div>
      </div>
    )

    return (
      <PageLayout body={body} scroll />
    )
  }
}
