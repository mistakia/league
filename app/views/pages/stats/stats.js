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

const careerlog_single_fields = {
  num_seasons: 'Seasons'
}

const careerlog_group_fields = {
  Record: {
    wins: 'Wins',
    losses: 'Losses',
    ties: 'Ties'
  },
  'All Play': {
    apWins: 'Wins',
    apLosses: 'Losses',
    apTies: 'Ties',
    best_season_all_play_pct: 'Best %'
  },
  Points: {
    pf: 'Total',
    pa: 'Against',
    pdiff: 'Diff',
    pmax: 'Max',
    pmin: 'Min',
    weekly_high_scores: 'Week Leader'
  },
  Potential: {
    pp: 'Points',
    pp_pct: '%',
    pw: 'Wins',
    pl: 'Losses'
  },
  'Overall Finish': {
    best_overall_finish: 'Best',
    worst_overall_finish: 'Worst'
  },
  'Regular Season': {
    regular_season_leader: 'Leader',
    best_season_win_pct: 'Best Win %',
    best_regular_season_finish: 'Best Finish',
    worst_regular_season_finish: 'Worst Finish'
  },
  'Post Season': {
    post_seasons: '#',
    num_byes: 'Byes'
  },
  Wildcards: {
    wildcards: '#',
    wildcard_wins: 'Wins',
    wildcard_highest_score: 'Max Points',
    wildcard_total_points: 'Total Points',
    wildcard_lowest_score: 'Min Points'
  },
  Championship: {
    championship_rounds: '#',
    championships: 'Wins',
    championship_highest_score: 'Max Points',
    championship_total_points: 'Total Points',
    championship_lowest_score: 'Min Points'
  }
}

function CareerLogRow({ user_careerlog, percentiles }) {
  const fields = Object.keys(careerlog_single_fields)
  const single_items = fields.map((field, index) => (
    <PercentileMetric
      key={index}
      scaled
      value={user_careerlog[field]}
      percentile={percentiles[field]}
    />
  ))

  const group_items = []
  for (const [key, value] of Object.entries(careerlog_group_fields)) {
    const field_items = []
    for (const field of Object.keys(value)) {
      field_items.push(
        <PercentileMetric
          key={field}
          scaled
          value={user_careerlog[field]}
          percentile={percentiles[field]}
        />
      )
    }
    group_items.push(
      <div key={key} className='row__group'>
        <div className='row__group-body'>{field_items}</div>
      </div>
    )
  }

  return (
    <div className='table__row'>
      <div className='table__cell text lead-cell sticky__column'>
        {user_careerlog.username}
      </div>
      {single_items}
      {group_items}
    </div>
  )
}

CareerLogRow.propTypes = {
  user_careerlog: PropTypes.object,
  percentiles: PropTypes.object
}

const season_fields = {
  Points: {
    pf: {
      label: 'Total',
      tooltip: 'Points scored'
    },
    pa: {
      label: 'Against',
      tooltip: 'Points against'
    },
    pdiff: {
      label: 'Diff',
      tooltip: 'Point differential'
    },
    pmax: {
      label: 'Max',
      tooltip: 'Maximum points for'
    },
    pmin: {
      label: 'Min',
      tooltip: 'Minimum points for'
    },
    pdev: {
      label: 'Stdev',
      tooltip: 'Points scored standard deviation'
    }
  },
  Potential: {
    pp: {
      label: 'Points',
      tooltip: 'Potential points. Points scored with optimal lineup.'
    },
    pp_pct: {
      label: '%',
      tooltip: 'Potential points percentage. Points scored with optimal lineup.'
    },
    pw: {
      label: 'Wins',
      tooltip: 'Potential wins. Wins with optimal lineup.'
    },
    pl: {
      label: 'Losses',
      tooltip: 'Potential losses. Losses with optimal lineup.'
    }
  },
  'All Play': {
    apWins: {
      label: 'Wins',
      tooltip: 'Wins verse all teams each week'
    },
    apLosses: {
      label: 'Losses',
      tooltip: 'Losses verse all teams each week'
    },
    apTies: {
      label: 'Ties',
      tooltip: 'Ties verse all teams each week'
    },
    all_play_win_pct: {
      label: 'Win %',
      tooltip: 'All Play Win %',
      fixed: 1
    }
  }
}

function SummaryRow({ team, percentiles, year }) {
  const stats = team.get('stats', new Map(constants.createFantasyTeamStats()))

  const items = []
  for (const [key, value] of Object.entries(season_fields)) {
    const fields = []
    for (const [field, { fixed }] of Object.entries(value)) {
      fields.push(
        <PercentileMetric
          key={field}
          scaled
          {...{
            value: stats.get(field),
            percentile: percentiles[field],
            fixed
          }}
        />
      )
    }
    items.push(
      <div key={key} className='row__group'>
        <div className='row__group-body'>{fields}</div>
      </div>
    )
  }

  return (
    <div className='table__row'>
      <div className='table__cell text lead-cell sticky__column'>
        {team.name}
      </div>
      {items}
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
      <div className='table__cell text lead-cell sticky__column'>
        {team.name}
      </div>
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
  loadLeagueTeamStats,
  league_user_historical_ranks,
  load_league_careerlogs,
  careerlog_percentiles
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
    load_league_careerlogs(lid)
  }, [year, loadLeagueTeamStats, load_league_careerlogs, lid])

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
    const season_stats_header_items = []
    for (const [key, value] of Object.entries(season_fields)) {
      const field_items = []
      for (const { label, tooltip } of Object.values(value)) {
        field_items.push(
          <Tooltip title={tooltip}>
            <div className='table__cell metric'>{label}</div>
          </Tooltip>
        )
      }
      season_stats_header_items.push(
        <div key={key} className='row__group'>
          <div className='row__group-head'>{key}</div>
          <div className='row__group-body'>{field_items}</div>
        </div>
      )
    }

    stats_body = (
      <>
        <div className='section'>
          <Toolbar>
            <div className='section-header-title'>League Stats</div>
          </Toolbar>
          <div className='table__container'>
            <div className='table__row table__head'>
              <div className='table__cell text lead-cell sticky__column'>
                Team
              </div>
              {season_stats_header_items}
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
              <div className='table__cell text lead-cell sticky__column'>
                Team
              </div>
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
              <div className='table__cell text lead-cell sticky__column'>
                Team
              </div>
              {positionHeaders}
            </div>
            <div className='table__body'>{positionRows}</div>
          </div>
        </div>
      </>
    )
  }

  const careerLogRows = league_user_historical_ranks.map(
    (user_careerlog) => (
      <CareerLogRow
        key={user_careerlog.userid}
        user_careerlog={user_careerlog}
        percentiles={careerlog_percentiles}
      />
    )
  )

  const careerlog_single_field_items = []
  for (const [key, value] of Object.entries(careerlog_single_fields)) {
    careerlog_single_field_items.push(
      <div key={key} className='table__cell metric'>
        {value}
      </div>
    )
  }

  const careerlog_group_field_items = []
  for (const [key, value] of Object.entries(careerlog_group_fields)) {
    const field_items = []
    for (const label of Object.values(value)) {
      field_items.push(<div className='table__cell metric'>{label}</div>)
    }
    careerlog_group_field_items.push(
      <div key={key} className='row__group'>
        <div className='row__group-head'>{key}</div>
        <div className='row__group-body'>{field_items}</div>
      </div>
    )
  }
  const careerlog_body = (
    <div className='section'>
      <Toolbar>
        <div className='section-header-title'>Career Stats</div>
      </Toolbar>
      <div className='table__container'>
        <div className='table__row table__head'>
          <div className='table__cell text lead-cell sticky__column'>
            Manager
          </div>
          {careerlog_single_field_items}
          {careerlog_group_field_items}
        </div>
        <div className='table__body'>{careerLogRows}</div>
      </div>
    </div>
  )
  const body = (
    <div className='stats'>
      {careerlog_body}
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
  loadLeagueTeamStats: PropTypes.func,
  league_user_historical_ranks: PropTypes.array,
  load_league_careerlogs: PropTypes.func,
  careerlog_percentiles: PropTypes.object
}
