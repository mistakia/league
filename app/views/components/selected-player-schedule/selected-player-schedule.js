import React, { useState, useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

import { constants } from '@libs-shared'
import SelectedPlayerMatchupTable from '@components/selected-player-matchup-table'
import PercentileMetric from '@components/percentile-metric'

import './selected-player-schedule.styl'

export default function SelectedPlayerSchedule({
  player_map,
  games,
  seasonlogs,
  schedule,
  load_nfl_team_seasonlogs
}) {
  useEffect(() => {
    load_nfl_team_seasonlogs()
  }, [load_nfl_team_seasonlogs])

  const pos = player_map.get('pos')
  const team = player_map.get('team')
  const current_week = Math.max(constants.week, 1)
  const [selected_week, set_selected_week] = useState(current_week)

  const handleChange = (event, value) => set_selected_week(value)

  if (!games.length) {
    return null
  }

  const percentile_key = `${pos}_AGAINST_ADJ`
  const labels = []
  games.forEach((game, index) => {
    const opp = team === game.h ? game.v : game.h
    const pts = seasonlogs.getIn(
      ['nfl_teams', opp, `${pos}_AGAINST_ADJ`, 'pts'],
      '-'
    )
    const rnk = seasonlogs.getIn(
      ['nfl_teams', opp, `${pos}_AGAINST_ADJ`, 'rnk'],
      '-'
    )
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
    <div className='selected__table'>
      <Tabs
        value={selected_week}
        onChange={handleChange}
        variant='scrollable'
        className='selected__player-schedule-tabs sticky__column'
        orientation='horizontal'
        indicatorColor='primary'
        textColor='inherit'
      >
        {labels}
      </Tabs>
      <SelectedPlayerMatchupTable week={selected_week} />
    </div>
  )
}

SelectedPlayerSchedule.propTypes = {
  player_map: ImmutablePropTypes.map,
  games: PropTypes.array,
  seasonlogs: ImmutablePropTypes.map,
  schedule: ImmutablePropTypes.map,
  load_nfl_team_seasonlogs: PropTypes.func
}
