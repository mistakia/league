import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { List } from 'immutable'

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
    const projs = playerMap.get('projections', new List()).toJS()
    const weeks = projs.map((p) => parseInt(p.week, 10))
    for (const wk of weeks) {
      tables.push(
        <SelectedPlayerProjection
          key={wk}
          week={wk}
          projections={playerMap.getIn(['projections', wk])}
          playerId={pid}
          pos={pos}
          projection={playerMap.getIn(['projection', wk])}
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
