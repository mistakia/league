import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { List } from 'immutable'
import LinearProgress from '@mui/material/LinearProgress'

import { groupBy, constants } from '@libs-shared'
import SelectedPlayerProjection from '@components/selected-player-projection'

export default class SelectedPlayerSeasonProjections extends React.Component {
  componentDidMount() {
    const pid = this.props.playerMap.get('pid')
    this.props.load({ pid })
  }

  render = () => {
    const { playerMap } = this.props

    const pid = playerMap.get('pid')
    const pos = playerMap.get('pos')
    const loading_projections = playerMap.get('loading_projections')
    const tables = []
    const projections = playerMap.get('projections', new List()).toJS()
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
      (p) => p.sourceid !== constants.sources.AVERAGE
    )
    const projections_by_week = groupBy(filtered_projections, 'week')

    for (const week_key in projections_by_week) {
      const week = Number(week_key)
      if (week !== constants.week) continue

      const average_projections = playerMap.getIn(['projection', `${week}`], {})

      tables.push(
        <SelectedPlayerProjection
          key={week}
          week={week}
          projections={projections_by_week[week]}
          pid={pid}
          pos={pos}
          projection={average_projections}
        />
      )
    }

    return <div className='selected__player-projections'>{tables}</div>
  }
}

SelectedPlayerSeasonProjections.propTypes = {
  playerMap: ImmutablePropTypes.map,
  load: PropTypes.func
}
