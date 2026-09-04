import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { List } from 'immutable'
import LinearProgress from '@mui/material/LinearProgress'

import { groupBy } from '#libs-shared'
import SelectedPlayerProjection from '@components/selected-player-projection'
import { current_season, external_data_sources } from '#constants'

export default class SelectedPlayerSeasonProjections extends React.Component {
  componentDidMount() {
    const pid = this.props.player_map.get('pid')
    this.props.load({ pid })
  }

  render = () => {
    const { player_map } = this.props

    const pos = player_map.get('primary_position')
    const loading_projections = player_map.get('loading_projections')
    const tables = []
    const projections = player_map.get('projections', new List()).toJS()
    if (loading_projections) {
      return <LinearProgress />
    }

    if (!projections.length) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            textTransform: 'uppercase',
            color: '#999'
          }}
        >
          no projections found
        </div>
      )
    }

    // Filter out average projections from the projections array since they get their own row
    const filtered_projections = projections.filter(
      (p) => p.source_id !== external_data_sources.AVERAGE
    )
    const projections_by_week = groupBy(filtered_projections, 'week')

    // `current_season.week` is the fantasy counter, and it is 0 from the end of
    // one season until the next regular season starts. No projection row is
    // ever week 0, so filtering on it rendered an empty tab for every player
    // through the whole preseason -- and silently, since `projections` was
    // non-empty and the no-projections branch above never fired.
    for (const week_key in projections_by_week) {
      const week = Number(week_key)
      if (week !== current_season.active_fantasy_week) continue

      const average_projections = player_map.getIn(
        ['projection', `${week}`],
        {}
      )

      tables.push(
        <SelectedPlayerProjection
          key={week}
          week={week}
          projections={projections_by_week[week]}
          pos={pos}
          projection={average_projections}
        />
      )
    }

    return <div className='selected__player-projections'>{tables}</div>
  }
}

SelectedPlayerSeasonProjections.propTypes = {
  player_map: ImmutablePropTypes.map,
  load: PropTypes.func
}
