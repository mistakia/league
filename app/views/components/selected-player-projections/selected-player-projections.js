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
    this.props.load(pid)
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

    const projections_by_week = groupBy(projections, 'week')
    for (const week_key in projections_by_week) {
      const week = parseInt(week_key, 10)
      if (week !== constants.week) continue

      tables.push(
        <SelectedPlayerProjection
          key={week}
          week={week}
          projections={projections_by_week[week]}
          pid={pid}
          pos={pos}
          projection={playerMap.getIn(['projection', week], {})}
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
