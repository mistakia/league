import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Map } from 'immutable'
import Toolbar from '@mui/material/Toolbar'

import PageLayout from '@layouts/page'
import PercentileMetric from '@components/percentile-metric'
import { constants, getEligibleSlots, toPercent } from '@common'
import StandingsSelectYear from '@components/standings-select-year'

import './stats.styl'

function SummaryRow({ team, percentiles, year }) {
  const stats = team
    .getIn(['stats', year], new Map(constants.createFantasyTeamStats()))
    .toJS()
  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pf' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pa' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pdiff' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pp' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pp_pct' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'ppp' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pw' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pl' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pmax' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pmin' }} />
      <PercentileMetric scaled {...{ stats, percentiles, type: 'pdev' }} />
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            scaled
            {...{ stats, percentiles, type: 'apWins' }}
          />
          <PercentileMetric
            scaled
            {...{ stats, percentiles, type: 'apLosses' }}
          />
          <PercentileMetric
            scaled
            {...{ stats, percentiles, type: 'apTies' }}
          />
          <div className='table__cell metric'>
            {toPercent(
              team.getIn(['stats', year, 'apWins'], 0) /
                (team.getIn(['stats', year, 'apWins'], 0) +
                  team.getIn(['stats', year, 'apLosses'], 0) +
                  team.getIn(['stats', year, 'apTies'], 0))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

SummaryRow.propTypes = {
  team: ImmutablePropTypes.record,
  percentiles: PropTypes.object,
  year: PropTypes.number
}

function PositionRow({ team, percentiles, year }) {
  const positionCells = []
  for (const [index, position] of constants.positions.entries()) {
    const type = `pPos${position}`
    const points = team.getIn(['stats', year, type], 0)
    positionCells.push(
      <PercentileMetric
        key={index}
        stats={team
          .getIn(['stats', year], new Map(constants.createFantasyTeamStats()))
          .toJS()}
        scaled
        {...{ percentiles, type }}
      />
    )
    positionCells.push(
      <div key={`${index}%`} className='table__cell metric'>
        {toPercent(points / team.getIn(['stats', year, 'pf'], 0))}
      </div>
    )
  }

  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      {positionCells}
    </div>
  )
}

PositionRow.propTypes = {
  team: ImmutablePropTypes.record,
  percentiles: PropTypes.object,
  year: PropTypes.number
}

function SlotRow({ team, slots, percentiles, year }) {
  const slotCells = []
  for (const [index, s] of slots.entries()) {
    const slot = constants.slots[s]
    const type = `pSlot${slot}`
    const points = team.getIn(['stats', year, type], 0)
    slotCells.push(
      <PercentileMetric
        key={index}
        stats={team
          .getIn(['stats', year], new Map(constants.createFantasyTeamStats()))
          .toJS()}
        scaled
        {...{ percentiles, type }}
      />
    )
    slotCells.push(
      <div key={`${index}%`} className='table__cell metric'>
        {toPercent(points / team.getIn(['stats', year, 'pf'], 0))}
      </div>
    )
  }

  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      {slotCells}
    </div>
  )
}

SlotRow.propTypes = {
  team: ImmutablePropTypes.record,
  slots: PropTypes.array,
  percentiles: PropTypes.object,
  year: PropTypes.number
}

export default class StatsPage extends React.Component {
  render = () => {
    const { league, teams, percentiles, year } = this.props

    const slotHeaders = []
    const eligibleStarterSlots = getEligibleSlots({ pos: 'ALL', league })
    const slots = [...new Set(eligibleStarterSlots)]
    for (const [index, slot] of slots.entries()) {
      slotHeaders.push(
        <div key={index} className='table__cell metric'>
          {constants.slotName[constants.slots[slot]]}
        </div>
      )
      slotHeaders.push(
        <div key={`${index}%`} className='table__cell metric'>
          %
        </div>
      )
    }

    const positionHeaders = []
    for (const position of constants.positions) {
      positionHeaders.push(
        <div key={position} className='table__cell metric'>
          {position}
        </div>
      )
      positionHeaders.push(
        <div key={`${position}%`} className='table__cell metric'>
          %
        </div>
      )
    }

    const sorted = teams.sort(
      (a, b) =>
        b.getIn(['stats', year, 'apWins'], 0) -
          a.getIn(['stats', year, 'apWins'], 0) ||
        b.getIn(['stats', year, 'pf'], 0) - a.getIn(['stats', year, 'pf'], 0)
    )

    const summaryRows = []
    for (const team of sorted.valueSeq()) {
      summaryRows.push(
        <SummaryRow
          key={team.uid}
          team={team}
          percentiles={percentiles}
          year={year}
        />
      )
    }

    const slotRows = []
    for (const team of sorted.valueSeq()) {
      slotRows.push(
        <SlotRow
          key={team.uid}
          team={team}
          slots={slots}
          year={year}
          percentiles={percentiles}
        />
      )
    }

    const positionRows = []
    for (const team of sorted.valueSeq()) {
      positionRows.push(
        <PositionRow
          key={team.uid}
          team={team}
          percentiles={percentiles}
          year={year}
        />
      )
    }

    const body = (
      <div className='stats'>
        <StandingsSelectYear />
        <div className='section'>
          <Toolbar>
            <div className='dashboard__section-header-title'>League Stats</div>
          </Toolbar>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell player__item-name'>Team</div>
              <div className='table__cell metric'>PF</div>
              <div className='table__cell metric'>PA</div>
              <div className='table__cell metric'>DIFF</div>
              <div className='table__cell metric'>PP</div>
              <div className='table__cell metric'>PP%</div>
              <div className='table__cell metric'>PP Pen</div>
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
          <Toolbar>
            <div className='dashboard__section-header-title'>Lineup Stats</div>
          </Toolbar>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell player__item-name'>Team</div>
              {slotHeaders}
            </div>
            {slotRows}
          </div>
        </div>
        <div className='section'>
          <Toolbar>
            <div className='dashboard__section-header-title'>
              Positional Stats
            </div>
          </Toolbar>
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

    return <PageLayout body={body} scroll />
  }
}

StatsPage.propTypes = {
  teams: ImmutablePropTypes.map,
  league: PropTypes.object,
  percentiles: PropTypes.object,
  year: PropTypes.number
}
