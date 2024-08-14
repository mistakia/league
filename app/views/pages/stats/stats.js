import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Map } from 'immutable'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'

import PageLayout from '@layouts/page'
import PercentileMetric from '@components/percentile-metric'
import { constants, getEligibleSlots, toPercent } from '@libs-shared'
import SelectYear from '@components/select-year'

import './stats.styl'

function SummaryRow({ team, percentiles, year }) {
  const stats = team.get('stats', new Map(constants.createFantasyTeamStats()))

  const items = []
  const fields = [
    'pf',
    'pa',
    'pdiff',
    'pp',
    'pp_pct',
    'pw',
    'pl',
    'pmax',
    'pmin',
    'pdev'
  ]
  fields.forEach((field, index) => {
    items.push(
      <PercentileMetric
        key={index}
        scaled
        {...{ value: stats.get(field), percentile: percentiles[field] }}
      />
    )
  })

  return (
    <div className='table__row'>
      <div className='table__cell text lead-cell'>{team.name}</div>
      {items}
      <div className='row__group'>
        <div className='row__group-body'>
          <PercentileMetric
            scaled
            {...{
              value: stats.get('apWins'),
              percentile: percentiles.apWins
            }}
          />
          <PercentileMetric
            scaled
            {...{
              value: stats.get('apLosses'),
              percentile: percentiles.apLosses
            }}
          />
          <PercentileMetric
            scaled
            {...{
              value: stats.get('apTies'),
              percentile: percentiles.apTies
            }}
          />
          <div className='table__cell metric'>
            {toPercent(
              team.getIn(['stats', 'apWins'], 0) /
                (team.getIn(['stats', 'apWins'], 0) +
                  team.getIn(['stats', 'apLosses'], 0) +
                  team.getIn(['stats', 'apTies'], 0))
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
    const key = `pPos${position}`
    const value = team.getIn(['stats', key], 0)
    const percentile = percentiles[key]
    positionCells.push(
      <PercentileMetric key={index} scaled {...{ value, percentile }} />
    )
    positionCells.push(
      <div key={`${index}%`} className='table__cell metric'>
        {toPercent(value / team.getIn(['stats', 'pf'], 0))}
      </div>
    )
  }

  return (
    <div className='table__row'>
      <div className='table__cell text lead-cell'>{team.name}</div>
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
    const key = `pSlot${slot}`
    const value = team.getIn(['stats', key], 0)
    const percentile = percentiles[key]
    slotCells.push(
      <PercentileMetric key={index} scaled {...{ value, percentile }} />
    )
    slotCells.push(
      <div key={`${index}%`} className='table__cell metric'>
        {toPercent(value / team.getIn(['stats', 'pf'], 0))}
      </div>
    )
  }

  return (
    <div className='table__row'>
      <div className='table__cell text lead-cell'>{team.name}</div>
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

export default function StatsPage({
  league,
  teams,
  percentiles,
  year,
  loadLeagueTeamStats
}) {
  const navigate = useNavigate()
  const { lid } = useParams()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }
  }, [lid, navigate])

  useEffect(() => {
    loadLeagueTeamStats()
  }, [year, loadLeagueTeamStats])

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
      <div key={`${index}_pct`} className='table__cell metric'>
        %
      </div>
    )
  }

  const positionHeaders = []
  constants.positions.forEach((position, index) => {
    positionHeaders.push(
      <div key={index} className='table__cell metric'>
        {position}
      </div>
    )
    positionHeaders.push(
      <div key={`${index}_pct`} className='table__cell metric'>
        %
      </div>
    )
  })

  const sorted = teams.sort(
    (a, b) =>
      b.getIn(['stats', 'apWins'], 0) - a.getIn(['stats', 'apWins'], 0) ||
      b.getIn(['stats', 'pf'], 0) - a.getIn(['stats', 'pf'], 0)
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

  let stats_body
  if (year === constants.year && constants.week === 0) {
    stats_body = <div className='section empty' />
  } else {
    stats_body = (
      <>
        <div className='section'>
          <Toolbar>
            <div className='section-header-title'>League Stats</div>
          </Toolbar>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell text lead-cell'>Team</div>
              <Tooltip title='Points scored'>
                <div className='table__cell metric'>PF</div>
              </Tooltip>
              <Tooltip title='Points against'>
                <div className='table__cell metric'>PA</div>
              </Tooltip>
              <Tooltip title='Point differential'>
                <div className='table__cell metric'>DIFF</div>
              </Tooltip>
              <Tooltip title='Potential points. Points scored with optimal lineup.'>
                <div className='table__cell metric'>PP</div>
              </Tooltip>
              <Tooltip title='Percentage of potential points scored'>
                <div className='table__cell metric'>PP%</div>
              </Tooltip>
              <Tooltip title='Potential wins. Games that could have been won with optimal lineup'>
                <div className='table__cell metric'>P WINS</div>
              </Tooltip>
              <Tooltip title='Potential losses. Games that could have been lost with opponents optimal lineup'>
                <div className='table__cell metric'>P LOSSES</div>
              </Tooltip>
              <Tooltip title='Maximum points for'>
                <div className='table__cell metric'>MAX</div>
              </Tooltip>
              <Tooltip title='Minimum points for'>
                <div className='table__cell metric'>MIN</div>
              </Tooltip>
              <Tooltip title='Points scored standard deviation'>
                <div className='table__cell metric'>STDEV</div>
              </Tooltip>
              <div className='row__group'>
                <div className='row__group-head'>All Play Record</div>
                <div className='row__group-body'>
                  <div className='table__cell metric'>W</div>
                  <div className='table__cell metric'>L</div>
                  <div className='table__cell metric'>T</div>
                  <div className='table__cell metric'>PCT</div>
                </div>
              </div>
            </div>
            <div className='table__body'>{summaryRows}</div>
          </div>
        </div>
        <div className='section'>
          <Toolbar>
            <div className='section-header-title'>Lineup Stats</div>
          </Toolbar>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell text lead-cell'>Team</div>
              {slotHeaders}
            </div>
            <div className='table__body'>{slotRows}</div>
          </div>
        </div>
        <div className='section'>
          <Toolbar>
            <div className='section-header-title'>Positional Stats</div>
          </Toolbar>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell text lead-cell'>Team</div>
              {positionHeaders}
            </div>
            <div className='table__body'>{positionRows}</div>
          </div>
        </div>
      </>
    )
  }

  const body = (
    <div className='stats'>
      <SelectYear />
      {stats_body}
    </div>
  )

  return <PageLayout body={body} scroll />
}

StatsPage.propTypes = {
  teams: ImmutablePropTypes.map,
  league: PropTypes.object,
  percentiles: PropTypes.object,
  year: PropTypes.number,
  loadLeagueTeamStats: PropTypes.func
}
