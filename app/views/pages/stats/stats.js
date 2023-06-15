import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Map } from 'immutable'
import Toolbar from '@mui/material/Toolbar'

import PageLayout from '@layouts/page'
import PercentileMetric from '@components/percentile-metric'
import { constants, getEligibleSlots, toPercent } from '@common'
import SelectYear from '@components/select-year'

import './stats.styl'

function SummaryRow({ team, percentiles, year }) {
  const stats = team.getIn(
    ['stats', year],
    new Map(constants.createFantasyTeamStats())
  )

  const items = []
  const fields = [
    'pf',
    'pa',
    'pdiff',
    'pp',
    'pp_pct',
    'ppp',
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
      <div className='table__cell player__item-name'>{team.name}</div>
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
    const key = `pPos${position}`
    const value = team.getIn(['stats', year, key], 0)
    const percentile = percentiles[key]
    positionCells.push(
      <PercentileMetric key={index} scaled {...{ value, percentile }} />
    )
    positionCells.push(
      <div key={`${index}%`} className='table__cell metric'>
        {toPercent(value / team.getIn(['stats', year, 'pf'], 0))}
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
    const key = `pSlot${slot}`
    const value = team.getIn(['stats', year, key], 0)
    const percentile = percentiles[key]
    slotCells.push(
      <PercentileMetric key={index} scaled {...{ value, percentile }} />
    )
    slotCells.push(
      <div key={`${index}%`} className='table__cell metric'>
        {toPercent(value / team.getIn(['stats', year, 'pf'], 0))}
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

  let stats_body
  if (year === constants.year && constants.week === 0) {
    stats_body = <div className='section empty' />
  } else {
    stats_body = (
      <>
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
            <div className='table__body'>{summaryRows}</div>
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
            <div className='table__body'>{slotRows}</div>
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
