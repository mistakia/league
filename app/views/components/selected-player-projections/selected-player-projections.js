import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { List } from 'immutable'

import { groupBy } from '@common'
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
    const tables = []
    const projections = playerMap.get('projections', new List()).toJS()
    const projections_by_week = groupBy(projections, 'week')
    for (const week in projections_by_week) {
      const wk = parseInt(week, 10)
      tables.push(
        <SelectedPlayerProjection
          key={wk}
          week={wk}
          projections={projections_by_week[week]}
          pid={pid}
          pos={pos}
          projection={playerMap.getIn(['projection', wk], {})}
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
