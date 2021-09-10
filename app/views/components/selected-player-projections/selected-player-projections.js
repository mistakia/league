import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import SelectedPlayerProjection from '@components/selected-player-projection'
import { groupBy } from '@common'

export default class SelectedPlayerSeasonProjections extends React.Component {
  componentDidMount() {
    const { player } = this.props.player
    this.props.load(player)
  }

  render = () => {
    const { player } = this.props

    const tables = []
    const weeks = groupBy(player.projections.toJS(), 'week')
    for (const wk in weeks) {
      const week = parseInt(wk, 0)
      tables.push(
        <SelectedPlayerProjection
          key={wk}
          week={week}
          projections={weeks[wk]}
          playerId={player.player}
          pos={player.pos}
          projection={player.getIn(['projection', wk])}
        />
      )
    }

    return <div className='selected__player-projections'>{tables}</div>
  }
}

SelectedPlayerSeasonProjections.propTypes = {
  player: ImmutablePropTypes.record,
  load: PropTypes.func
}
