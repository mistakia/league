import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Map } from 'immutable'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'

import PageLayout from '@layouts/page'
import PercentileMetric from '@components/percentile-metric'
import { get_eligible_slots, toPercent } from '@libs-shared'
import SelectYear from '@components/select-year'

import './stats.styl'
import {
  current_season,
  roster_slot_types,
  fantasy_positions,
  create_empty_fantasy_team_stats
} from '@constants'

const careerlog_single_fields = {
  num_seasons: 'Seasons',
  division_wins: 'Division Wins'
}

const careerlog_group_fields = {
  Record: {
    wins: { label: 'Wins' },
    losses: { label: 'Losses' },
    ties: { label: 'Ties' }
  },
  'All Play': {
    apWins: { label: 'Wins' },
    apLosses: { label: 'Losses' },
    apTies: { label: 'Ties' },
    best_season_all_play_pct: { label: 'Best %', fixed: 1 }
  },
  Points: {
    pf: { label: 'Total' },
    pa: { label: 'Against' },
    pdiff: { label: 'Diff' },
    pmax: { label: 'Max' },
    pmin: { label: 'Min' },
    weekly_high_scores: { label: 'Week Leader' }
  },
  Potential: {
    pp: { label: 'Points' },
    pp_pct: { label: '%', fixed: 1 },
    pw: { label: 'Wins' },
    pl: { label: 'Losses' }
  },
  'Overall Finish': {
    best_overall_finish: { label: 'Best' },
    worst_overall_finish: { label: 'Worst' }
  },
  'Regular Season': {
    regular_season_leader: { label: 'Leader' },
    best_season_win_pct: { label: 'Best Win %', fixed: 1 },
    best_regular_season_finish: { label: 'Best Finish' },
    worst_regular_season_finish: { label: 'Worst Finish' }
  },
  'Post Season': {
    post_seasons: { label: '#' },
    num_byes: { label: 'Byes' }
  },
  Wildcards: {
    wildcards: { label: '#' },
    wildcard_wins: { label: 'Wins' },
    wildcard_highest_score: { label: 'Max Points' },
    wildcard_total_points: { label: 'Total Points' },
    wildcard_lowest_score: { label: 'Min Points' }
  },
  Championship: {
    championship_rounds: { label: '#' },
    championships: { label: 'Wins' },
    championship_highest_score: { label: 'Max Points' },
    championship_total_points: { label: 'Total Points' },
    championship_lowest_score: { label: 'Min Points' }
  }
}
function CareerLogRow({ user_careerlog, percentiles, key }) {
  const fields = Object.keys(careerlog_single_fields)
  const single_items = fields.map((field) => (
    <PercentileMetric
      key={`single_${field}`}
      scaled
      value={user_careerlog[field]}
      percentile={percentiles[field]}
    />
  ))

  const group_items = Object.entries(careerlog_group_fields).map(
    ([group_name, value]) => {
      const field_items = Object.entries(value).map(
        ([field, { label, fixed }]) => (
          <PercentileMetric
            key={`${group_name}-${field}`}
            scaled
            value={user_careerlog[field]}
            percentile={percentiles[field]}
            fixed={fixed}
          />
        )
      )

      return (
        <div key={`group_${group_name}`} className='row__group'>
          <div className='row__group-body'>{field_items}</div>
        </div>
      )
    }
  )

  return (
    <div key={key} className='table__row'>
      <div className='table__cell text lead-cell sticky__column'>
        <div className='table__cell-text'>{user_careerlog.username}</div>
      </div>
      {single_items}
      {group_items}
    </div>
  )
}

CareerLogRow.propTypes = {
  user_careerlog: PropTypes.object,
  percentiles: PropTypes.object,
  key: PropTypes.string
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

function SummaryRow({ team, percentiles, year, key }) {
  const stats = team.get(
    'stats',
    new Map(create_empty_fantasy_team_stats())
  )

  const items = Object.entries(season_fields).map(([key, value]) => {
    const fields = Object.entries(value).map(([field, { fixed }]) => (
      <PercentileMetric
        key={`${key}-${field}`}
        scaled
        value={stats.get(field)}
        percentile={percentiles[field]}
        fixed={fixed}
      />
    ))

    return (
      <div key={`group_${key}`} className='row__group'>
        <div className='row__group-body'>{fields}</div>
      </div>
    )
  })

  return (
    <div key={key} className='table__row'>
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
  year: PropTypes.number,
  key: PropTypes.string
}

function PositionRow({ team, percentiles, year, key }) {
  const position_cells = fantasy_positions.map((position) => {
    const key = `pPos${position}`
    const value = team.getIn(['stats', key], 0)
    const percentile = percentiles[key]
    return [
      <PercentileMetric
        key={`metric_${position}`}
        scaled
        value={value}
        percentile={percentile}
      />,
      <div key={`percent_${position}`} className='table__cell metric'>
        {toPercent(value / team.getIn(['stats', 'pf'], 0))}
      </div>
    ]
  })

  return (
    <div key={key} className='table__row'>
      <div className='table__cell text lead-cell'>{team.name}</div>
      {position_cells}
    </div>
  )
}

PositionRow.propTypes = {
  team: ImmutablePropTypes.record,
  percentiles: PropTypes.object,
  year: PropTypes.number,
  key: PropTypes.string
}

function SlotRow({ team, slots, percentiles, key }) {
  const slot_cells = slots.map((s) => {
    const slot = roster_slot_types[s]
    const key = `pSlot${slot}`
    const value = team.getIn(['stats', key], 0)
    const percentile = percentiles[key]
    const total_points = team.getIn(['stats', 'pf'], 0)

    return [
      <PercentileMetric
        key={`percentile_${slot}`}
        scaled
        value={value}
        percentile={percentile}
      />,
      <div key={`percent_${slot}`} className='table__cell metric'>
        {toPercent(value / total_points)}
      </div>
    ]
  })

  return (
    <div key={key} className='table__row'>
      <div className='table__cell text lead-cell sticky__column'>
        {team.name}
      </div>
      {slot_cells}
    </div>
  )
}

SlotRow.propTypes = {
  team: ImmutablePropTypes.record,
  slots: PropTypes.array,
  percentiles: PropTypes.object,
  key: PropTypes.string
}

export default function StatsPage({
  league,
  teams,
  percentiles,
  year,
  load_league_team_stats,
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
    load_league_team_stats()
    load_league_careerlogs(lid)
  }, [year, load_league_team_stats, load_league_careerlogs, lid])

  const slot_headers = []
  const eligible_starter_slots = get_eligible_slots({ pos: 'ALL', league })
  const slots = [...new Set(eligible_starter_slots)]
  for (const slot of slots) {
    slot_headers.push(
      <div key={`slot_${slot}`} className='table__cell metric'>
        {roster_slot_types.slotName[roster_slot_types[slot]]}
      </div>
    )
    slot_headers.push(
      <div key={`slot_${slot}_pct`} className='table__cell metric'>
        %
      </div>
    )
  }

  const position_headers = []
  fantasy_positions.forEach((position) => {
    position_headers.push(
      <div key={`position_${position}`} className='table__cell metric'>
        {position}
      </div>
    )
    position_headers.push(
      <div key={`position_${position}_pct`} className='table__cell metric'>
        %
      </div>
    )
  })

  const sorted = teams.sort(
    (a, b) =>
      b.getIn(['stats', 'apWins'], 0) - a.getIn(['stats', 'apWins'], 0) ||
      b.getIn(['stats', 'pf'], 0) - a.getIn(['stats', 'pf'], 0)
  )

  const summary_rows = []
  for (const team of sorted.valueSeq()) {
    summary_rows.push(
      <SummaryRow
        key={`summary_${team.uid}`}
        team={team}
        percentiles={percentiles}
        year={year}
      />
    )
  }

  const slot_rows = []
  for (const team of sorted.valueSeq()) {
    slot_rows.push(
      <SlotRow
        key={`slot_${team.uid}`}
        team={team}
        slots={slots}
        percentiles={percentiles}
      />
    )
  }

  const position_rows = []
  for (const team of sorted.valueSeq()) {
    position_rows.push(
      <PositionRow
        key={`position_${team.uid}`}
        team={team}
        percentiles={percentiles}
        year={year}
      />
    )
  }

  let stats_body
  if (year === current_season.year && current_season.week === 0) {
    stats_body = <div className='section empty' />
  } else {
    const season_stats_header_items = Object.entries(season_fields).map(
      ([key, value]) => {
        const field_items = Object.values(value).map(({ label, tooltip }) => (
          <Tooltip title={tooltip} key={`${key}-${label}`}>
            <div className='table__cell metric'>{label}</div>
          </Tooltip>
        ))

        return (
          <div key={`group_${key}`} className='row__group'>
            <div className='row__group-head'>{key}</div>
            <div className='row__group-body'>{field_items}</div>
          </div>
        )
      }
    )

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
            <div className='table__body'>{summary_rows}</div>
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
              {slot_headers}
            </div>
            <div className='table__body'>{slot_rows}</div>
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
              {position_headers}
            </div>
            <div className='table__body'>{position_rows}</div>
          </div>
        </div>
      </>
    )
  }

  const careerLogRows = league_user_historical_ranks.map((user_careerlog) => (
    <CareerLogRow
      key={`careerlog_${user_careerlog.userid}`}
      user_careerlog={user_careerlog}
      percentiles={careerlog_percentiles}
    />
  ))

  const careerlog_single_field_items = Object.entries(
    careerlog_single_fields
  ).map(([key, value]) => (
    <div key={`single_${key}`} className='table__cell metric'>
      {value}
    </div>
  ))

  const careerlog_group_field_items = Object.entries(
    careerlog_group_fields
  ).map(([group_name, value]) => {
    const field_items = Object.entries(value).map(([field, { label }]) => (
      <div key={`${group_name}-${field}`} className='table__cell metric'>
        {label}
      </div>
    ))

    return (
      <div key={`group-${group_name}`} className='row__group'>
        <div className='row__group-head'>{group_name}</div>
        <div className='row__group-body'>{field_items}</div>
      </div>
    )
  })

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
  load_league_team_stats: PropTypes.func,
  league_user_historical_ranks: PropTypes.array,
  load_league_careerlogs: PropTypes.func,
  careerlog_percentiles: PropTypes.object
}
