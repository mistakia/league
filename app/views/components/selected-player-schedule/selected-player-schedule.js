import React, { useState, useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

import SelectedPlayerMatchupTable from '@components/selected-player-matchup-table'
import PercentileMetric from '@components/percentile-metric'
import SelectedPlayerScheduleYearFilter from '@components/selected-player-schedule-year-filter'
import SelectedPlayerScheduleWeekFilter from '@components/selected-player-schedule-week-filter'
import SelectedPlayerScheduleTimePeriodFilter from '@components/selected-player-schedule-time-period-filter'

import './selected-player-schedule.styl'
import { current_season, nfl_weeks } from '@constants'

export default function SelectedPlayerSchedule({
  player_map,
  games,
  seasonlogs,
  schedule,
  load_nfl_team_seasonlogs,
  load_percentiles
}) {
  useEffect(() => {
    load_nfl_team_seasonlogs()
  }, [load_nfl_team_seasonlogs])

  const pos = player_map.get('pos')
  const team = player_map.get('team')
  const current_week = Math.max(current_season.week, 1)
  const [selected_week, set_selected_week] = useState(current_week)
  const [selected_years_for_schedule, set_selected_years_for_schedule] =
    useState(
      current_week < 4
        ? [current_season.year, current_season.year - 1]
        : [current_season.year]
    )
  const [selected_weeks_for_schedule, set_selected_weeks_for_schedule] =
    useState(nfl_weeks)
  const [filters_expanded, set_filters_expanded] = useState(false)
  const [selected_time_period, set_selected_time_period] = useState('')

  const handle_tab_change = (event, value) => set_selected_week(value)
  const handle_year_selection_change = (years) =>
    set_selected_years_for_schedule(years)
  const handle_week_selection_change = (weeks) =>
    set_selected_weeks_for_schedule(weeks)
  const handle_filters_toggle = () => set_filters_expanded(!filters_expanded)
  const handle_time_period_change = (value) => set_selected_time_period(value)

  const time_period_suffix = selected_time_period
    ? `_${selected_time_period}`
    : ''
  const percentile_key = `${pos}_AGAINST_ADJ${time_period_suffix}`
  const stat_key = `${pos}_AGAINST_ADJ${time_period_suffix}`

  useEffect(() => {
    if (percentile_key) {
      load_percentiles(percentile_key)
    }
  }, [percentile_key, load_percentiles])

  if (!games.length) {
    return null
  }
  const labels = []
  games.forEach((game, index) => {
    const opp = team === game.h ? game.v : game.h
    const pts = seasonlogs.getIn(['nfl_teams', opp, stat_key, 'pts'], '-')
    const rnk = seasonlogs.getIn(['nfl_teams', opp, stat_key, 'rnk'], '-')
    const isHome = opp === game.v
    const label = (
      <PercentileMetric
        className='schedule__tab'
        value={pts}
        percentile_key={percentile_key}
        field='pts'
      >
        <small>{`W${game.week}`}</small>
        <div>{`${isHome ? '' : '@'}${opp}`}</div>
        <div>{rnk}</div>
      </PercentileMetric>
    )
    labels.push(<Tab key={index} label={label} value={game.week} />)
  })

  const bye_week = schedule.getIn(['teams', team, 'bye']) || 0
  const bye_label = (
    <PercentileMetric className='schedule__tab'>
      <small>{`W${bye_week}`}</small>
      <div>BYE</div>
    </PercentileMetric>
  )
  const bye_item = <Tab key='bye' label={bye_label} value={bye_week} />

  labels.splice(bye_week - 1, 0, bye_item)

  return (
    <div className='selected-player-schedule-wrapper'>
      <div className='selected-player-schedule-tabs-row'>
        <Tabs
          value={selected_week}
          onChange={handle_tab_change}
          variant='scrollable'
          className='selected__player-schedule-tabs sticky__column'
          orientation='horizontal'
          indicatorColor='primary'
          textColor='inherit'
        >
          {labels}
        </Tabs>
        <div className='filters-toggle-button' onClick={handle_filters_toggle}>
          {filters_expanded ? 'hide filters' : 'show filters'}
        </div>
      </div>
      {filters_expanded && (
        <div className='selected-player-schedule-filters'>
          <SelectedPlayerScheduleYearFilter
            selected_years_for_schedule={selected_years_for_schedule}
            on_year_selection_change={handle_year_selection_change}
          />
          <SelectedPlayerScheduleWeekFilter
            selected_weeks_for_schedule={selected_weeks_for_schedule}
            on_week_selection_change={handle_week_selection_change}
          />
          <SelectedPlayerScheduleTimePeriodFilter
            selected_time_period={selected_time_period}
            on_time_period_change={handle_time_period_change}
          />
        </div>
      )}
      <div className='selected__table'>
        <SelectedPlayerMatchupTable
          week={selected_week}
          selected_years={selected_years_for_schedule}
          selected_weeks={selected_weeks_for_schedule}
          selected_time_period={selected_time_period}
        />
      </div>
    </div>
  )
}

SelectedPlayerSchedule.propTypes = {
  player_map: ImmutablePropTypes.map,
  games: PropTypes.array,
  seasonlogs: ImmutablePropTypes.map,
  schedule: ImmutablePropTypes.map,
  load_nfl_team_seasonlogs: PropTypes.func,
  load_percentiles: PropTypes.func
}
